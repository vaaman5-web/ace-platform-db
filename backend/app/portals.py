"""ACE × Skill-Farming portal layer.

Role-based portals (learner / institution / employer / government), 1-click
demo identities, and district-level analytics for the government portal —
all served from the same FastAPI gateway + PostgreSQL as the rest of ACE.
"""
from __future__ import annotations

import json
import os
import time
from typing import Any

import bcrypt as _bcrypt
import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

import os

# Load the repo-root .env before reading JWT secrets (same as app.main)
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

JWT_SECRET = os.environ.get("JWT_SECRET", "super_secret_jwt_key_2026")

# Late-bound at request time to avoid a circular import with app.main
_pool = None


def _get_pool():
    global _pool
    if _pool is None:
        from .main import _pool as p
        _pool = p
    return _pool


def _decode_token(token: str) -> dict[str, Any]:
    import os

    import jwt as _jwt

    secrets = [s for s in (
        os.environ.get("SUPABASE_JWT_SECRET"),
        os.environ.get("JWT_SECRET", "super_secret_jwt_key_2026"),
    ) if s]
    errors = []
    for secret in secrets:
        try:
            return _jwt.decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})
        except Exception as exc:
            errors.append(str(exc))
    raise HTTPException(401, f"Invalid or expired token: {errors}")


async def current_user(request: Request) -> dict[str, Any]:
    from .main import _resolve_user_via_pool

    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    payload = _decode_token(auth[7:])
    return await _resolve_user_via_pool(payload)


router = APIRouter(prefix="/api/portal")

PORTAL_ROLES = ("learner", "institution", "employer", "government")

DEMO_USERS = [
    {"email": "rohan.sharma@skillfarming.org", "full_name": "Rohan Sharma", "role": "student", "portal": "learner",
     "password": "Demo@1234", "meta": {"target_role": "Full Stack Web Developer", "target_wage": "₹6.5 LPA", "college": "Government College of Engineering, Pune (COEP)"}},
    {"email": "admin@apexacademy.edu.in", "full_name": "Apex Academy", "role": "institution", "portal": "institution",
     "password": "Demo@1234", "meta": {"batches": 6, "trainees": 214}},
    {"email": "talent@infracloud.io", "full_name": "Anand Kulkarni (InfraCloud)", "role": "employer", "portal": "employer",
     "password": "Demo@1234", "meta": {"company": "InfraCloud Technologies", "openings": 4}},
    {"email": "governance@skillmission.gov.in", "full_name": "MSSDS State Analytics", "role": "government", "portal": "government",
     "password": "Demo@1234", "meta": {"districts": 36}},
]


async def ensure_demo_users() -> None:
    """Idempotently create the four 1-click demo identities."""
    pool = _get_pool()
    if not pool:
        return
    async with pool.acquire() as conn:
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS portal VARCHAR(20)")
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS portal_meta JSONB NOT NULL DEFAULT '{}'::jsonb")
        # Legacy schema restricts role to ('student','admin') — widen for the 4 portals
        try:
            await conn.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check")
        except Exception:
            pass
        for u in DEMO_USERS:
            row = await conn.fetchrow("SELECT id FROM users WHERE email = $1", u["email"])
            if row:
                await conn.execute("UPDATE users SET role = $2, portal = $3, portal_meta = $4::jsonb WHERE email = $1",
                                   u["email"], u["role"], u["portal"], json.dumps(u["meta"]))
            else:
                await conn.execute(
                    """INSERT INTO users (email, password_hash, full_name, role, portal, portal_meta)
                       VALUES ($1, $2, $3, $4, $5, $6::jsonb)""",
                    u["email"],
                    _bcrypt.hashpw(u["password"].encode(), _bcrypt.gensalt(rounds=12)).decode(),
                    u["full_name"], u["role"], u["portal"], json.dumps(u["meta"]),
                )


class DemoLoginIn(BaseModel):
    portal: str


@router.post("/demo-login")
async def demo_login(body: DemoLoginIn):
    """1-click demo access — returns a JWT for the requested portal identity."""
    if body.portal not in PORTAL_ROLES:
        raise HTTPException(400, "Unknown portal")
    await ensure_demo_users()
    demo = next(u for u in DEMO_USERS if u["portal"] == body.portal)
    async with _get_pool().acquire() as conn:
        row = await conn.fetchrow("SELECT id::text AS id, email, full_name, role, portal, portal_meta FROM users WHERE email = $1", demo["email"])
    token = pyjwt.encode(
        {"sub": row["id"], "email": row["email"], "role": row["role"], "portal": body.portal,
         "iat": int(time.time()), "exp": int(time.time()) + 7 * 86400},
        JWT_SECRET, algorithm="HS256",
    )
    return {"user": dict(row), "token": token, "demo_password": demo["password"]}


@router.get("/me")
async def portal_me(user: dict[str, Any] = Depends(current_user)):
    async with _get_pool().acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id::text AS id, email, full_name, role, portal, portal_meta FROM users WHERE id::text = $1",
            str(user.get("id")),
        )
    if not row:
        raise HTTPException(404, "Portal profile not found")
    d = dict(row)
    d["portal_meta"] = json.loads(d.get("portal_meta") or "{}")
    d["portal"] = d.get("portal") or PORTAL_ROLES[0]
    return d


# ----------------------------------------------------------------- learner
@router.get("/learner/dashboard")
async def learner_dashboard(user: dict[str, Any] = Depends(current_user)):
    """Landing data for the Learner Portal — profile, target career, jobs, courses, gaps."""
    from .main import fetch_companies, rank_companies
    from .ml_engine import predict_score

    pool = _get_pool()
    meta: dict[str, Any] = {}
    async with pool.acquire() as conn:
        await _ensure_learner_tables(conn)
        row = await conn.fetchrow("SELECT portal_meta, full_name FROM users WHERE id::text = $1", str(user.get("id")))
        meta = json.loads(row["portal_meta"] or "{}") if row else {}
        goal = await conn.fetchrow("SELECT role, wage, college FROM learner_goals WHERE learner_user_id::text = $1", str(user.get("id")))
        goal = dict(goal) if goal else None
        enrs = [dict(r) for r in await conn.fetch("SELECT course_title, provider, progress_pct, last_score, enrolled_on FROM course_enrollments WHERE learner_user_id::text = $1 ORDER BY id DESC", str(user.get("id")))]
        my_apps = [dict(r) for r in await conn.fetch("SELECT id, company_name, role, stage, applied_on, interview_at FROM job_applications WHERE candidate = $1 ORDER BY id DESC", (row or {}).get("full_name") if row else "Learner")]
        quiz = await conn.fetchrow("SELECT answers FROM quiz_attempts WHERE user_id::text = $1 ORDER BY created_at DESC LIMIT 1", str(user.get("id")))
    track = "Tier 1A Service"
    # Score-driven matching: use the learner's REAL latest assessment score.
    # quiz_attempts.total_score currently stores the sum of selected option
    # indices, and the Node AI quiz generator grades with the answer key we
    # don't have here — so estimate a 0-100 skill score from the readiness
    # factor column (0.7 baseline → 1.1 ceiling) which IS score-aware.
    skill_score = 62.0  # neutral default before first assessment
    try:
        from .main import _pool as main_pool
        async with main_pool.acquire() as conn:
            q2 = await conn.fetchrow("SELECT readiness_factor FROM quiz_attempts WHERE user_id::text = $1 ORDER BY created_at DESC LIMIT 1", str(user.get("id")))
            if q2 and q2["readiness_factor"] is not None:
                skill_score = round(max(35.0, min(95.0, (float(q2["readiness_factor"]) - 0.55) * 200.0)), 1)
    except Exception:
        pass
    pred = await _run_predict(7.5, "Java", track)
    pred["score"] = round((pred["score"] * 0.5) + (skill_score * 0.5), 1)  # blend profile score with measured score
    companies = await fetch_companies(limit=400)
    ranked_all = rank_companies(companies, pred["score"], track)
    seen: set[str] = set()
    ranked = []
    for c in ranked_all:
        if c["name"] not in seen:
            seen.add(c["name"])
            ranked.append(c)
    ranked = ranked[:8]
    # per-company 'why this match' breakdown for the UI
    import math as _math
    tier_words = track.lower().split()
    jobs = []
    for c in ranked:
        diff = {"EASY": 1.0, "MEDIUM": 2.0, "HARD": 3.0}.get((c.get("difficulty_cat") or "MEDIUM").upper(), 2.0)
        affinity = round(100 * _math.exp(-((pred["score"] - diff * 25) ** 2) / (2 * 20 ** 2)))
        ctc = c.get("ctc_lpa") or 0
        try:
            ctc = float(ctc)
        except (TypeError, ValueError):
            ctc = 0.0
        type_match = 100 if any(w in str(c.get("type", "")).lower() for w in tier_words) else 55
        jobs.append({
            "name": c["name"], "type": c["type"], "ctc": c["ctc_band"], "match": c["fit_score"],
            "skills": c.get("key_skills"), "rounds": c.get("rounds_desc"), "difficulty": c.get("difficulty_cat"),
            "why": {
                "readiness": affinity,
                "track_fit": type_match,
                "salary_band": round(min(100.0, (ctc / 30.0) * 100)) if ctc else 60,
                "assessed_score": pred["score"],
                "band": "Dream" if c.get("fit_score", 0) >= 80 else "Strong" if c.get("fit_score", 0) >= 65 else "Reach",
            },
        })
    prog = round(sum(e["progress_pct"] for e in enrs) / max(1, len(enrs))) if enrs else 68
    return {
        "name": (row or {}).get("full_name", "Learner"),
        "progress_pct": max(35, prog),
        "attendance_pct": 80,
        "attendance_note": "40/50 sessions",
        "rank_masked": {"status": "Inactive", "recover_url": "#recovery", "challenges_done": 2, "challenges_total": 4, "days_left": 14},
        "profile_complete": 100 if goal else 80,
        "target": {
            "role": (goal or {}).get("role") or meta.get("target_role", "Full Stack Web Developer"),
            "college": (goal or {}).get("college") or meta.get("college", "Government College of Engineering, Pune (COEP)"),
            "wage": (goal or {}).get("wage") or meta.get("target_wage", "₹6.5 LPA"),
        },
        "jobs": jobs,
        "courses": [
            {"course_title": e["course_title"], "provider": e["provider"], "progress_pct": e["progress_pct"], "last_score": e["last_score"], "enrolled_on": str(e["enrolled_on"])} for e in enrs[:3]
        ] or [
            {"course_title": "Advanced SQL", "provider": "Apex Institute of Technology", "progress_pct": 85, "last_score": 94, "enrolled_on": "2026-04-12"},
            {"course_title": "Applied Data Structures", "provider": "National Skill Academy", "progress_pct": 65, "last_score": 88, "enrolled_on": "2026-05-02"},
            {"course_title": "Cloud Systems & DevOps", "provider": "InfraCloud Academy", "progress_pct": 85, "last_score": 98, "enrolled_on": "2026-05-18"},
        ],
        "strengths": [
            {"skill": "Core Java & OOP", "domain": "Language Core", "pct": 82},
            {"skill": "Advanced SQL & Querying", "domain": "DBMS", "pct": 78},
            {"skill": "Linear Structures", "domain": "DSA", "pct": 70},
        ],
        "gaps": [
            {"skill": "Graph Algorithms", "domain": "DSA", "pct": 35},
            {"skill": "System Design & REST APIs", "domain": "Web APIs", "pct": 42},
            {"skill": "Docker & Cloud Services", "domain": "Cloud", "pct": 30},
        ],
        "predicted": pred,
        "tests": [
            {"title": "Mock Test: SQL Query Plans", "date": "25 May 2026", "minutes": 45},
            {"title": "Practice Test: Graph DFS & BFS", "date": "27 May 2026", "minutes": 40},
            {"title": "Comprehensive Skill Readiness Mock", "date": "31 May 2026", "minutes": 45},
        ],
        "journey": {
            "assessed": quiz is not None,
            "skill_score": skill_score,
            "enrolled": len(enrs) > 0,
            "applied": len(my_apps) > 0,
            "assessments": 1 if quiz is not None else 0,
            "enrollments": len(enrs),
            "applications": len(my_apps),
            "last_score": skill_score,
        },
    }


async def _run_predict(cgpa: float, lang: str, track: str) -> dict[str, Any]:
    import asyncio

    from .ml_engine import predict_score

    return await asyncio.get_running_loop().run_in_executor(None, predict_score, cgpa, lang, track, None)


# ------------------------------------------------- learner catalog & outcomes
@router.get("/learner/catalog")
async def learner_catalog(user: dict[str, Any] = Depends(current_user)):
    """Full course catalog — the 4 legacy ACE pathways × their training domains."""
    uid = str(user.get("id"))
    enrolled: set[str] = set()
    async with _get_pool().acquire() as conn:
        await _ensure_learner_tables(conn)
        rows = await conn.fetch("SELECT course_title FROM course_enrollments WHERE learner_user_id::text = $1", uid)
        enrolled = {r["course_title"] for r in rows}
    catalog = [
        {"id": 1, "title": "Advanced SQL & Database Architecture", "provider": "Apex Institute of Technology", "cat": "DATA & ANALYTICS", "weeks": 8, "hours": 64, "mode": "Hybrid", "modules": ["Relational Design & 3NF", "Window Functions", "Query Plans & Indexing"], "skills": "SQL, DBMS, Analytics"},
        {"id": 2, "title": "Applied Data Structures & Algorithmic Problem Solving", "provider": "National Skill Academy", "cat": "SOFTWARE & FULL STACK", "weeks": 10, "hours": 80, "mode": "Online", "modules": ["Linear Structures", "Graph Traversal", "Dynamic Programming"], "skills": "DSA, Java, Problem Solving"},
        {"id": 3, "title": "Cloud Systems & DevOps", "provider": "InfraCloud Academy", "cat": "CLOUD & INFRA", "weeks": 6, "hours": 48, "mode": "Online", "modules": ["Docker & Containers", "CI/CD Pipelines", "Caching & Scale"], "skills": "Docker, CI/CD, Cloud"},
        {"id": 4, "title": "Full-Stack Web Architectures", "provider": "Apex Institute of Technology", "cat": "SOFTWARE & FULL STACK", "weeks": 12, "hours": 96, "mode": "Hybrid", "modules": ["REST API Design", "State Management", "Async Execution"], "skills": "Web Architectures, REST, System Design"},
        {"id": 5, "title": "Core Engineering: Electrical Diagnostics", "provider": "MSSDS Trade Center", "cat": "TECHNICAL TRADES", "weeks": 8, "hours": 60, "mode": "In-Person", "modules": ["Motor Control", "Star-Delta Wiring", "LOTO Safety"], "skills": "Electrical Roles, Safety"},
        {"id": 6, "title": "Analytics & Predictive Pipelines", "provider": "National Skill Academy", "cat": "DATA & ANALYTICS", "weeks": 9, "hours": 72, "mode": "Online", "modules": ["Pandas Transformations", "Predictive Pipelines", "Dashboards"], "skills": "Python, Pandas, Analytics"},
    ]
    for c in catalog:
        c["enrolled"] = c["title"] in enrolled
    return {"catalog": catalog, "enrolled_count": len(enrolled)}


@router.get("/learner/outcomes")
async def learner_outcomes(user: dict[str, Any] = Depends(current_user)):
    """Career outcomes: live stats + TF skill-demand forecast + personal placements."""
    from .main import outcomes_stats, forecast_skill_demand

    stats = await outcomes_stats()
    try:
        fc = await forecast_skill_demand()
        skills = fc.get("skills", [])[:6]
    except Exception:
        skills = []
    mine: list[dict[str, Any]] = []
    async with _get_pool().acquire() as conn:
        rows = await conn.fetch("SELECT program_name, trainee_name, placed, employer, ctc_lpa FROM training_outcomes WHERE LOWER(trainee_name) LIKE '%rohan%' LIMIT 5")
        mine = [dict(r) for r in rows]
    return {
        "stats": stats,
        "skills": skills,
        "mine": mine,
        "path": [
            {"stage": "Assessment Completed", "done": True, "detail": "Capability matrix scored & saved"},
            {"stage": "Gap Analysis", "done": True, "detail": "DBMS / DSA / Web API gaps identified"},
            {"stage": "Targeted Training", "done": False, "detail": "2 priority recommendations pending"},
            {"stage": "Employment", "done": False, "detail": "Target: Full Stack Web Developer · ₹6.5 LPA"},
        ],
    }


# ---------------------------------------------------- verified learner actions


async def _ensure_learner_tables(conn) -> None:
    """Portal action tables (idempotent)."""
    await conn.execute("CREATE TABLE IF NOT EXISTS job_applications (id SERIAL PRIMARY KEY, candidate VARCHAR(150) NOT NULL, role VARCHAR(200) NOT NULL, stage VARCHAR(30) NOT NULL DEFAULT 'Under Review', match_pct INT NOT NULL DEFAULT 0, applied_on DATE NOT NULL DEFAULT CURRENT_DATE, exam_score INT, interview_at TIMESTAMPTZ, employer_email VARCHAR(255), company_name VARCHAR(150), ctc_band VARCHAR(60), learner_user_id UUID)")
    await conn.execute("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS company_name VARCHAR(150)")
    await conn.execute("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS ctc_band VARCHAR(60)")
    await conn.execute("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS learner_user_id UUID")
    await conn.execute("CREATE TABLE IF NOT EXISTS course_enrollments (id SERIAL PRIMARY KEY, learner_user_id UUID, learner_name VARCHAR(150) NOT NULL, course_title VARCHAR(200) NOT NULL, provider VARCHAR(150) NOT NULL, weeks INT, hours INT, mode VARCHAR(30), enrolled_on DATE NOT NULL DEFAULT CURRENT_DATE, progress_pct INT NOT NULL DEFAULT 0, last_score INT)")
    await conn.execute("CREATE TABLE IF NOT EXISTS job_postings (id SERIAL PRIMARY KEY, employer_email VARCHAR(255) NOT NULL, title VARCHAR(200) NOT NULL, location VARCHAR(120) NOT NULL DEFAULT 'Pune (Hybrid)', job_type VARCHAR(60) NOT NULL DEFAULT 'Private Tech & Core', applicants INT NOT NULL DEFAULT 0, posted_on DATE NOT NULL DEFAULT CURRENT_DATE)")
    await conn.execute("CREATE TABLE IF NOT EXISTS learner_goals (learner_user_id UUID PRIMARY KEY, role VARCHAR(200) NOT NULL, wage VARCHAR(60), college VARCHAR(250), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())")

@router.get("/learner/gap-matrix")
async def learner_gap_matrix(role: str = "Backend Developer", user: dict[str, Any] = Depends(current_user)):
    """Current capability vs target-role requirements (10-point bands)."""
    from .main import outcomes_stats
    from .ml_engine import TIERS

    cfg = TIERS.get("Tier 1A Service", TIERS["Tier 1A Service"])
    domains = [
        {"domain": "DBMS", "current": 7, "required": 7, "topics": "Advanced SQL, Normalization, Query Tuning"},
        {"domain": "DSA", "current": 5, "required": 8, "topics": "Graph Algorithms, Hash Maps, Optimization"},
        {"domain": "Web APIs", "current": 4, "required": 8, "topics": "RESTful APIs, System Design"},
        {"domain": "Cloud", "current": 3, "required": 6, "topics": "Docker & Cloud Services, Caching Layers"},
    ]
    pool = _get_pool()
    recs = [
        {"rank": 1, "title": "Applied Data Structures & Algorithmic Problem Solving", "weeks": 10, "hours": 80, "provider": "National Skill Academy", "mode": "Online", "modules": 10},
        {"rank": 2, "title": "Full-Stack Web Architectures", "weeks": 12, "hours": 96, "provider": "Apex Institute of Technology", "mode": "Hybrid", "modules": 12},
        {"rank": 3, "title": "Cloud Systems & DevOps", "weeks": 6, "hours": 48, "provider": "InfraCloud Academy", "mode": "Online", "modules": 6},
    ]
    if pool:
        async with pool.acquire() as conn:
            await _ensure_learner_tables(conn)
            enrolled = {r["course_title"] for r in await conn.fetch("SELECT course_title FROM course_enrollments WHERE learner_user_id::text = $1", str(user.get("id")))}
            for r in recs:
                r["enrolled"] = r["title"] in enrolled
    return {
        "target_role": role,
        "market_demand": "Very High",
        "wage_band": cfg["salary"],
        "domains": domains,
        "priority_gaps": [d["domain"] for d in domains if d["current"] < d["required"]],
        "recommendations": recs,
    }


# ---------------------------------------------------- learner write actions
class ApplyIn(BaseModel):
    company: str
    role: str = ""
    ctc_band: str = ""
    match: int = 0


class EnrollIn(BaseModel):
    course_title: str
    provider: str = ""
    weeks: int | None = None
    hours: int | None = None
    mode: str = "Online"


class GoalIn(BaseModel):
    role: str
    wage: str = ""
    college: str = ""


@router.post("/learner/apply")
async def learner_apply(body: ApplyIn, user: dict[str, Any] = Depends(current_user)):
    """Learner clicks View & Apply → row lands in the Employer portal pipeline."""
    pool = _get_pool()
    if not pool:
        raise HTTPException(503, "Database unavailable")
    name = user.get("full_name") or "Learner"
    async with pool.acquire() as conn:
        await _ensure_learner_tables(conn)
        dup = await conn.fetchval("SELECT id FROM job_applications WHERE candidate = $1 AND company_name = $2", name, body.company)
        if dup:
            raise HTTPException(409, f"Already applied to {body.company}")
        row = await conn.fetchrow(
            "INSERT INTO job_applications (candidate, role, stage, match_pct, employer_email, company_name, ctc_band, learner_user_id) VALUES ($1,$2,'Under Review',$3,$4,$5,$6,$7) RETURNING *",
            name, body.role or "Software Engineer", body.match, "talent@infracloud.io", body.company, body.ctc_band, user.get("id"),
        )
    return {"application": dict(row), "message": f"Application submitted to {body.company} — status: Under Review"}


@router.get("/learner/applications")
async def learner_applications(user: dict[str, Any] = Depends(current_user)):
    pool = _get_pool()
    if not pool:
        return {"applications": []}
    async with pool.acquire() as conn:
        await _ensure_learner_tables(conn)
        rows = await conn.fetch("SELECT * FROM job_applications WHERE candidate = $1 ORDER BY applied_on DESC", user.get("full_name") or "Learner")
    return {"applications": [dict(r) for r in rows]}


@router.post("/learner/enroll")
async def learner_enroll(body: EnrollIn, user: dict[str, Any] = Depends(current_user)):
    pool = _get_pool()
    if not pool:
        raise HTTPException(503, "Database unavailable")
    async with pool.acquire() as conn:
        await _ensure_learner_tables(conn)
        dup = await conn.fetchval("SELECT id FROM course_enrollments WHERE learner_user_id::text = $1 AND course_title = $2", str(user.get("id")), body.course_title)
        if dup:
            raise HTTPException(409, f"Already enrolled in {body.course_title}")
        row = await conn.fetchrow(
            "INSERT INTO course_enrollments (learner_user_id, learner_name, course_title, provider, weeks, hours, mode) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
            user.get("id"), user.get("full_name") or "Learner", body.course_title, body.provider or "MSSDS Partner", body.weeks, body.hours, body.mode,
        )
    return {"enrollment": dict(row), "message": f"Enrolled: {body.course_title} — added to your dashboard"}


@router.post("/learner/goal")
async def learner_goal(body: GoalIn, user: dict[str, Any] = Depends(current_user)):
    pool = _get_pool()
    if not pool:
        raise HTTPException(503, "Database unavailable")
    async with pool.acquire() as conn:
        await _ensure_learner_tables(conn)
        await conn.execute(
            """INSERT INTO learner_goals (learner_user_id, role, wage, college, updated_at)
               VALUES ($1,$2,$3,$4, now())
               ON CONFLICT (learner_user_id) DO UPDATE SET role = $2, wage = $3, college = $4, updated_at = now()""",
            user.get("id"), body.role, body.wage, body.college,
        )
    return {"goal": {"role": body.role, "wage": body.wage, "college": body.college}, "message": "Career goal updated"}


# ------------------------------------------------------- AI narrative helpers
async def _ai_narrative(kind: str, context: str, user: dict[str, Any]) -> str:
    """Shared AI narration via the Node LLM (persona fixed server-side)."""
    import httpx

    from .main import NODE_API

    personas = {
        "gov": "You are an MSSDS policy analyst. In under 110 words, give 3 crisp, data-driven insights from the district statistics provided for Maharashtra skilling programs. Reference actual numbers. End with the single most important recommended action.",
        "employer": "You are an ACE hiring analyst. In under 90 words, summarize this applicant pool for the recruiter: distribution across stages, standout candidates, and one concrete action to fill roles faster.",
        "institution": "You are an ACE training-quality advisor. In under 90 words, assess this institution's batches: attendance health, verification status, and one action to improve outcomes.",
        "answer": "You are an ACE examiner. In 60 words explain why this answer is correct and how to remember the concept.",
    }
    system = personas.get(kind, personas["gov"]) + " Reply in plain prose only — no JSON, no markdown."
    last_err: Exception | None = None
    for attempt, ctx_len in enumerate((1100, 500)):
        try:
            async with httpx.AsyncClient(timeout=45) as client:
                r = await client.post(
                    f"{NODE_API}/api/ai/chat",
                    json={
                        "messages": [{"role": "user", "content": f"Generate the narrative now. Context data: {context[:ctx_len]}"}],
                        "system": system,
                        "temperature": 0.4,
                    },
                )
                r.raise_for_status()
                data = r.json()
            reply = str(data.get("reply", "")).strip()
            if reply:
                try:
                    import json as _json

                    parsed = _json.loads(reply)
                    if isinstance(parsed, dict):
                        parts = [str(v) for v in parsed.values() if isinstance(v, str)]
                        flat = [str(v) for v in parsed.values() if isinstance(v, list)]
                        reply = chr(10).join(parts + ["- " + str(x) for v in flat for x in v]) or reply
                except Exception:
                    pass
                return reply
        except Exception as exc:
            last_err = exc
    raise HTTPException(502, f"AI service unavailable: {last_err}")


@router.get("/government/ai-insights")
async def government_ai_insights(user: dict[str, Any] = Depends(current_user)):
    data = await government_analytics(user)
    ctx = "; ".join(
        f"{d['district']}: enrolled {d['enrolled']}, completion {d['completion_pct']}%, employed {d['employed']}, wage {d['avg_wage']}"
        for d in data["districts"][:12]
    )
    narrative = await _ai_narrative("gov", ctx, user)
    return {"narrative": narrative}


@router.get("/employer/ai-summary")
async def employer_ai_summary(user: dict[str, Any] = Depends(current_user)):
    d = await employer_dashboard(user)
    parts = [f"{s}: {sum(1 for p in d['pipeline'] if p['stage'] == s)}" for s in d["stages"]]
    ctx = "Applicant pipeline by stage — " + ", ".join(parts) + f". Total applicants: {len(d['pipeline'])}. Talent pool: " + "; ".join(f"{t['name']} ({t['match']}%, {t['status']})" for t in d["talent_pool"])
    narrative = await _ai_narrative("employer", ctx, user)
    return {"narrative": narrative}


@router.get("/institution/ai-summary")
async def institution_ai_summary(user: dict[str, Any] = Depends(current_user)):
    d = await institution_dashboard(user)
    ctx = "; ".join(
        f"batch {b['code']} ({b['course']}): {b['trainees']} trainees, attendance {b['present_pct']}%, verified={b['verified']}"
        for b in d["batches"]
    ) + f". Average attendance: {d['kpi']['avg_attendance']}%. Verified batches: {d['kpi']['verified']}/{d['kpi']['batches']}."
    narrative = await _ai_narrative("institution", ctx, user)
    return {"narrative": narrative}

# ------------------------------------------------------- activity / notifications
@router.get("/activity")
async def portal_activity(user: dict[str, Any] = Depends(current_user)):
    """Cross-portal activity feed: applications, interviews, enrollments, assessments."""
    pool = _get_pool()
    if not pool:
        return {"items": []}
    uid = str(user.get("id"))
    name = user.get("full_name") or "Learner"
    items: list[dict[str, Any]] = []
    async with pool.acquire() as conn:
        await _ensure_learner_tables(conn)
        is_learner = user.get("portal") == "learner" or user.get("role") == "student"
        if is_learner:
            for r in await conn.fetch("SELECT company_name, role, stage, applied_on FROM job_applications WHERE candidate = $1 ORDER BY id DESC LIMIT 6", name):
                items.append({"icon": "🎯", "title": f"Application · {r['company_name']}", "detail": f"{r['role']} — stage: {r['stage']}", "when": str(r["applied_on"]), "tab": "Job Marketplace"})
            for r in await conn.fetch("SELECT company_name, role, interview_at FROM job_applications WHERE candidate = $1 AND interview_at IS NOT NULL ORDER BY interview_at DESC LIMIT 4", name):
                items.append({"icon": "📅", "title": f"Interview · {r['company_name']}", "detail": f"{r['role']} — {str(r['interview_at'])[:16].replace('T', ' ')} UTC", "when": str(r["interview_at"])[:10], "tab": "Job Marketplace"})
            for r in await conn.fetch("SELECT course_title, provider, enrolled_on FROM course_enrollments WHERE learner_user_id::text = $1 ORDER BY id DESC LIMIT 4", uid):
                items.append({"icon": "📚", "title": f"Enrolled · {r['course_title']}", "detail": r["provider"], "when": str(r["enrolled_on"]), "tab": "Course Catalog"})
            for r in await conn.fetch("SELECT total_score, created_at FROM quiz_attempts WHERE user_id::text = $1 ORDER BY created_at DESC LIMIT 3", uid):
                items.append({"icon": "🧠", "title": f"Assessment scored · {int(float(r['total_score']))} pts", "detail": "Readiness factor updated", "when": str(r["created_at"])[:10], "tab": "Start Assessment"})
        else:
            for r in await conn.fetch("SELECT candidate, role, stage, applied_on FROM job_applications ORDER BY id DESC LIMIT 6"):
                items.append({"icon": "🎯", "title": f"{r['candidate']} · {r['company_name'] or '—'}", "detail": f"{r['role']} — stage: {r['stage']}", "when": str(r["applied_on"]), "tab": "Applicant Pipeline"})
            for r in await conn.fetch("SELECT learner_name, course_title, enrolled_on FROM course_enrollments ORDER BY id DESC LIMIT 4"):
                items.append({"icon": "📚", "title": f"{r['learner_name']} enrolled", "detail": r["course_title"], "when": str(r["enrolled_on"]), "tab": "Outcome Feed"})
    items.sort(key=lambda x: x["when"], reverse=True)
    return {"items": items[:12]}


# --------------------------------------------------------------- employer
@router.get("/employer/dashboard")
async def employer_dashboard(user: dict[str, Any] = Depends(current_user)):
    async with _get_pool().acquire() as conn:
        await _ensure_learner_tables(conn)
        await conn.execute("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS company_name VARCHAR(150)")
        await conn.execute("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS ctc_band VARCHAR(60)")
        await conn.execute("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS learner_user_id UUID")
        rows = await conn.fetch("SELECT * FROM job_applications ORDER BY applied_on DESC, id DESC")
    pipeline = [dict(r) for r in rows]
    stages = ["Under Review", "Shortlisted", "Corporate Exam", "Interview", "Selected"]
    counts = {s: sum(1 for p in pipeline if p["stage"] == s) for s in stages}
    talent = [
        {"name": "Rohan Sharma", "match": 90, "skills": ["Java", "SQL", "React"], "status": "Verified"},
        {"name": "Arjun Mehta", "match": 84, "skills": ["Python", "Pandas", "Docker"], "status": "Verified"},
        {"name": "Priya Deshmukh", "match": 81, "skills": ["SQL", "Analytics"], "status": "In Training"},
    ]
    return {
        "recruiter": user.get("full_name", "Recruiter"),
        "kpi": {"active_openings": 4, "applicants": len(pipeline), "interviews": counts["Interview"], "offers": counts["Selected"]},
        "pipeline": pipeline,
        "stages": stages,
        "talent_pool": talent,
        "postings": [
            {"title": "Junior Backend Engineer", "location": "Pune (Hybrid)", "type": "Private Tech & Core", "applicants": 2},
            {"title": "Scientific Assistant / Technical Officer", "location": "Mumbai Suburban", "type": "Government", "applicants": 1},
        ],
    }


class StageIn(BaseModel):
    stage: str


class InterviewIn(BaseModel):
    when: str  # ISO datetime


class PostingIn(BaseModel):
    title: str
    location: str = "Pune (Hybrid)"
    job_type: str = "Private Tech & Core"


def _employer_access(user: dict[str, Any]) -> bool:
    return user.get("role") == "employer" or user.get("portal") == "employer"


@router.post("/employer/applications/{app_id}/stage")
async def employer_set_stage(app_id: int, body: StageIn, user: dict[str, Any] = Depends(current_user)):
    stages = ["Under Review", "Shortlisted", "Corporate Exam", "Interview", "Selected"]
    if body.stage not in stages:
        raise HTTPException(400, f"Stage must be one of {stages}")
    async with _get_pool().acquire() as conn:
        row = await conn.fetchrow("UPDATE job_applications SET stage = $1 WHERE id = $2 RETURNING *", body.stage, app_id)
    if not row:
        raise HTTPException(404, "Application not found")
    return {"application": dict(row), "message": f"{row['candidate']} → {body.stage}"}


@router.post("/employer/applications/{app_id}/interview")
async def employer_schedule_interview(app_id: int, body: InterviewIn, user: dict[str, Any] = Depends(current_user)):
    from datetime import datetime

    when = datetime.fromisoformat(body.when.replace("Z", "+00:00"))
    async with _get_pool().acquire() as conn:
        row = await conn.fetchrow("UPDATE job_applications SET interview_at = $1, stage = CASE WHEN stage IN ('Under Review','Shortlisted') THEN 'Interview' ELSE stage END WHERE id = $2 RETURNING *", when, app_id)
    if not row:
        raise HTTPException(404, "Application not found")
    return {"application": dict(row), "message": f"Interview scheduled for {row['candidate']}"}


@router.post("/employer/postings")
async def employer_create_posting(body: PostingIn, user: dict[str, Any] = Depends(current_user)):
    async with _get_pool().acquire() as conn:
        await _ensure_learner_tables(conn)
        row = await conn.fetchrow(
            "INSERT INTO job_postings (employer_email, title, location, job_type) VALUES ($1,$2,$3,$4) RETURNING *",
            user.get("email") or "talent@infracloud.io", body.title, body.location, body.job_type,
        )
    return {"posting": dict(row), "message": f"Job posted: {body.title}"}


@router.get("/employer/postings")
async def employer_list_postings(user: dict[str, Any] = Depends(current_user)):
    async with _get_pool().acquire() as conn:
        await _ensure_learner_tables(conn)
        rows = await conn.fetch("SELECT * FROM job_postings ORDER BY id DESC")
    return {"postings": [dict(r) for r in rows]}


# ------------------------------------------------------------- government
MAHARASHTRA_DISTRICTS = [
    ("Pune", 4850, 4210, 3578, "82%", "₹5–8 LPA"), ("Mumbai Suburban", 5420, 4650, 4045, "84%", "₹6–9 LPA"),
    ("Mumbai City", 3950, 3435, 2988, "85%", "₹6–10 LPA"), ("Nagpur", 3120, 2680, 2224, "80%", "₹4–7 LPA"),
    ("Nashik", 2650, 2305, 1867, "78%", "₹4–6 LPA"), ("Chhatrapati Sambhajinagar", 2240, 1926, 1540, "76%", "₹3.5–6 LPA"),
    ("Thane", 3480, 3027, 2542, "81%", "₹4.5–7.5 LPA"), ("Kolhapur", 1890, 1663, 1330, "77%", "₹3.5–5.5 LPA"),
    ("Solapur", 1720, 1479, 1124, "72%", "₹3–5 LPA"), ("Amravati", 1540, 1324, 993, "71%", "₹3–4.8 LPA"),
    ("Nanded", 1380, 1173, 868, "69%", "₹2.8–4.5 LPA"), ("Satara", 1260, 1096, 865, "75%", "₹3–5 LPA"),
]


@router.get("/government/analytics")
async def government_analytics(user: dict[str, Any] = Depends(current_user)):
    rows = []
    total = completed = employed = 0
    for name, enrolled, comp, emp, retention, wage in MAHARASHTRA_DISTRICTS:
        rows.append({
            "district": name, "enrolled": enrolled, "completed": comp,
            "completion_pct": round(100 * comp / enrolled), "employed": emp,
            "conversion_pct": round(100 * emp / comp), "retention_6m": retention, "avg_wage": wage,
        })
        total += enrolled; completed += comp; employed += emp
    return {
        "state": "Maharashtra",
        "kpi": {
            "enrolled": total, "certified": completed, "completion_pct": round(100 * completed / total),
            "employed": employed, "conversion_pct": round(100 * employed / completed),
            "retention_6m": "78%", "active_districts": len(MAHARASHTRA_DISTRICTS), "wage_band": "₹4.8–7.5L",
        },
        "districts": rows,
    }


@router.get("/government/export")
async def government_export():
    """District analytics CSV for policy export."""
    import csv
    import io

    data = await government_analytics(user={"role": "government"})
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["district", "enrolled", "completed", "completion_pct", "employed", "conversion_pct", "retention_6m", "avg_wage"])
    for d in data["districts"]:
        w.writerow([d["district"], d["enrolled"], d["completed"], d["completion_pct"], d["employed"], d["conversion_pct"], d["retention_6m"], d["avg_wage"]])
    from fastapi.responses import Response

    return Response(buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=maharashtra_district_analytics.csv"})


# ------------------------------------------------------------ institution
@router.get("/institution/dashboard")
async def institution_dashboard(user: dict[str, Any] = Depends(current_user)):
    pool = _get_pool()
    async with pool.acquire() as conn:
        await _ensure_learner_tables(conn)
        await conn.execute("CREATE TABLE IF NOT EXISTS institution_batches (id SERIAL PRIMARY KEY, code VARCHAR(40) NOT NULL, course VARCHAR(200) NOT NULL, trainees INT NOT NULL DEFAULT 0, present_pct INT NOT NULL DEFAULT 0, verified BOOLEAN NOT NULL DEFAULT FALSE)")
        cnt = await conn.fetchval("SELECT count(*) FROM institution_batches")
        if not cnt:
            for b in [
                ("BAT-2026-A1", "Advanced SQL & Database Architecture", 42, 88, True),
                ("BAT-2026-B2", "Applied Data Structures", 38, 81, True),
                ("BAT-2026-C1", "Cloud Systems & DevOps", 30, 90, False),
                ("BAT-2026-D1", "Full-Stack Web Architectures", 36, 84, False),
            ]:
                await conn.execute("INSERT INTO institution_batches (code, course, trainees, present_pct, verified) VALUES ($1,$2,$3,$4,$5)", *b)
        rows = await conn.fetch("SELECT * FROM institution_batches ORDER BY id")
        feed = await conn.fetch(
            "SELECT course_title, learner_name, progress_pct FROM course_enrollments ORDER BY id DESC LIMIT 6"
        )
    batches = [dict(r) for r in rows]
    outcome_feed = [
        {"trainee": o["learner_name"], "status": f"Enrolled · {o['progress_pct']}%", "employer": o["course_title"], "ctc": None}
        for o in (feed or [])
    ] or [
        {"trainee": "Rohan Sharma", "status": "Placed", "employer": "InfraCloud Technologies", "ctc": "₹6.5 LPA"},
        {"trainee": "Arjun Mehta", "status": "In Training", "employer": None, "ctc": None},
    ]
    return {
        "institution": user.get("full_name", "Institution"),
        "kpi": {"batches": len(batches), "trainees": sum(b["trainees"] for b in batches),
                "avg_attendance": round(sum(b["present_pct"] for b in batches) / max(1, len(batches))),
                "verified": sum(1 for b in batches if b["verified"])},
        "batches": batches,
        "outcome_feed": outcome_feed,
    }


class VerifyIn(BaseModel):
    verified: bool


@router.post("/institution/batches/{batch_id}/verify")
async def institution_verify_batch(batch_id: int, body: VerifyIn, user: dict[str, Any] = Depends(current_user)):
    async with _get_pool().acquire() as conn:
        row = await conn.fetchrow("UPDATE institution_batches SET verified = $1 WHERE id = $2 RETURNING *", body.verified, batch_id)
    if not row:
        raise HTTPException(404, "Batch not found")
    return {"batch": dict(row), "message": f"Batch {row['code']} {'verified ✓' if body.verified else 'verification revoked'}"}
