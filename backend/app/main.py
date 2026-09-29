"""FastAPI backend for ACE — Adaptive & Continuous Education.

Stack per project spec:
    Browser → React + TS + Tailwind → REST → Python FastAPI → PostgreSQL
    TensorFlow ML logic (skill scoring, recommendations, job matching)
    Supabase Auth (login + sessions + role permissions)
    Power BI (analytics & reporting)
"""
from __future__ import annotations

import asyncio
import json
import os
import time
from contextlib import asynccontextmanager
from typing import Any

import httpx
import asyncpg
import bcrypt as _bcrypt
import jwt as pyjwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .ml_engine import TIERS, TF_AVAILABLE, predict_score, rank_companies
from .portals import router as portal_router, ensure_demo_users
from .roadmaps import router as roadmaps_router

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

NODE_API = os.environ.get("NODE_API_URL", "http://localhost:3000")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "super_secret_jwt_key_2026")
POWER_BI_BASE = os.environ.get("POWER_BI_BASE_URL", "")

_pool: asyncpg.Pool | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _pool
    conn = os.environ.get("DATABASE_URL") or (
        "postgresql://{user}:{password}@{host}:{port}/{db}".format(
            user=os.environ.get("DB_USER", "ace_user"),
            password=os.environ.get("DB_PASSWORD", "ace_password"),
            host=os.environ.get("DB_HOST", "localhost"),
            port=os.environ.get("DB_PORT", "5432"),
            db=os.environ.get("DB_NAME", "ace_platform"),
        )
    )
    try:
        _pool = await asyncpg.create_pool(conn, min_size=1, max_size=10, statement_cache_size=0)
    except Exception as exc:  # pragma: no cover
        print(f"[fastapi] database pool unavailable: {exc}")
        _pool = None
    # Warm the TensorFlow model so first prediction is instant
    try:
        from .ml_engine import _get_model  # local import to avoid cycles

        await asyncio.get_running_loop().run_in_executor(None, _get_model)
        print(f"[fastapi] TensorFlow model ready (TF={TF_AVAILABLE})")
    except Exception as exc:  # pragma: no cover
        print(f"[fastapi] TF warmup skipped: {exc}")
    try:
        if _pool:
            await ensure_demo_users()
            print("[fastapi] portal demo users ready (learner/institution/employer/government)")
    except Exception as exc:  # pragma: no cover
        print(f"[fastapi] demo users skipped: {exc}")
    yield
    if _pool:
        await _pool.close()


app = FastAPI(title="ACE FastAPI Gateway + ML", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in (os.environ.get("CORS_ORIGIN", "*").split(","))],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(portal_router)
app.include_router(roadmaps_router)


# ---------------------------------------------------------------- auth utils
def _decode_token(token: str) -> dict[str, Any]:
    """Accept both locally-issued JWTs and Supabase access tokens."""
    errors = []
    for secret in filter(None, [SUPABASE_JWT_SECRET, JWT_SECRET]):
        try:
            return pyjwt.decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})
        except Exception as exc:
            errors.append(str(exc))
    raise HTTPException(401, f"Invalid or expired token: {errors}")


async def current_user(request: Request) -> dict[str, Any]:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    payload = _decode_token(auth[7:])
    user_id = payload.get("sub") or payload.get("user_id")
    email = payload.get("email") or ""
    role = payload.get("role") or "student"
    if _pool and user_id:
        row = await _pool.fetchrow("SELECT id, email, full_name, role FROM users WHERE id::text = $1", str(user_id))
        if row:
            return dict(row)
    if email and _pool:
        row = await _pool.fetchrow("SELECT id, email, full_name, role FROM users WHERE email = $1", email)
        if row:
            return dict(row)
    # Ghost session (Supabase-only user) — minimal identity from the token
    return {"id": user_id, "email": email, "full_name": email.split("@")[0].title(), "role": role if isinstance(role, str) else "student"}


async def require_admin(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    if str(user.get("role", "")).lower() not in {"admin", "government", "gov"}:
        raise HTTPException(403, "Admin or government role required")
    return user


async def _resolve_user_via_pool(payload: dict[str, Any]) -> dict[str, Any]:
    """Shared identity resolution used by both app and portal auth layers."""
    user_id = payload.get("sub") or payload.get("user_id")
    email = payload.get("email") or ""
    role = payload.get("role") or "student"
    if _pool and user_id:
        row = await _pool.fetchrow(
            "SELECT id::text AS id, email, full_name, role, portal, portal_meta FROM users WHERE id::text = $1", str(user_id)
        )
        if row:
            return dict(row)
    if email and _pool:
        row = await _pool.fetchrow(
            "SELECT id::text AS id, email, full_name, role, portal, portal_meta FROM users WHERE email = $1", email
        )
        if row:
            return dict(row)
    return {"id": user_id, "email": email, "full_name": email.split("@")[0].title(), "role": role if isinstance(role, str) else "student"}


# ------------------------------------------------------------------- schemas
class RegisterIn(BaseModel):
    email: str
    password: str = Field(min_length=8)
    full_name: str = ""
    degree: str | None = None
    cgpa: float | None = None
    primary_lang: str | None = None
    target_track: str | None = None


class LoginIn(BaseModel):
    email: str
    password: str


class AnalysisIn(BaseModel):
    candidate_name: str = ""
    degree: str | None = None
    cgpa: float
    primary_lang: str = "Java"
    target_track: str = "Tier 1A Service"
    quiz_score: float | None = None


class QuizIn(BaseModel):
    answers: list[dict[str, Any]]
    set_id: str | None = None


class CompareIn(BaseModel):
    ids: list[int]


# --------------------------------------------------------------------- auth
@app.post("/api/auth/register")
async def register(body: RegisterIn):
    if SUPABASE_URL and SUPABASE_ANON_KEY:
        # Supabase Auth is the identity provider: create the user there first,
        # then mirror a local profile row for placement data (role permissions).
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{SUPABASE_URL}/auth/v1/signup",
                headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
                json={"email": body.email, "password": body.password},
            )
        if resp.status_code not in (200, 201):
            detail = resp.json().get("msg", resp.text) if resp.text else "Supabase signup failed"
            raise HTTPException(resp.status_code, f"Supabase signup failed: {detail}")
        sb_user = resp.json().get("user", {})
        sb_id = sb_user.get("id")
        sb_token = resp.json().get("access_token")
    else:
        sb_id, sb_token = None, None

    if not _pool:
        raise HTTPException(503, "Database unavailable")

    async with _pool.acquire() as conn:
        # supabase_uid may not exist in legacy schemas — add it harmlessly
        try:
            await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_uid UUID")
        except Exception:
            pass
        try:
            row = await conn.fetchrow(
                """INSERT INTO users (email, password_hash, full_name, degree, cgpa, primary_lang, target_track, supabase_uid)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                   RETURNING id, email, full_name, role""",
                body.email, _bcrypt.hashpw(body.password.encode(), _bcrypt.gensalt(rounds=12)).decode(), body.full_name or body.email.split("@")[0].title(),
                body.degree, body.cgpa, body.primary_lang, body.target_track, sb_id,
            )
        except asyncpg.UniqueViolationError:
            raise HTTPException(409, "Email already registered")
    token = sb_token or pyjwt.encode(
        {"sub": str(row["id"]), "email": row["email"], "role": row["role"], "iat": int(time.time()), "exp": int(time.time()) + 7 * 86400},
        JWT_SECRET, algorithm="HS256",
    )
    return {"user": dict(row), "token": token, "supabase": bool(sb_token)}


@app.post("/api/auth/login")
async def login(body: LoginIn):
    if not _pool:
        raise HTTPException(503, "Database unavailable")
    row = await _pool.fetchrow("SELECT * FROM users WHERE email = $1", body.email)

    def _pw_ok(plain: str, hashed: str | None) -> bool:
        if not hashed:
            return False
        try:
            return _bcrypt.checkpw(plain.encode(), hashed.encode())
        except ValueError:
            return False

    if not row or not _pw_ok(body.password, row["password_hash"]):
        # Fallback: Supabase Auth (password grant) when local credentials miss
        if SUPABASE_URL and SUPABASE_ANON_KEY:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                    headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
                    json={"email": body.email, "password": body.password},
                )
            if resp.status_code == 200:
                data = resp.json()
                async with _pool.acquire() as conn:
                    local = await conn.fetchrow(
                        "INSERT INTO users (email, full_name, role) VALUES ($1, $2, 'student') ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id, email, full_name, role",
                        body.email, (body.email.split("@")[0] or "Student").title(),
                    )
                return {"user": dict(local), "token": data.get("access_token"), "supabase": True}
        raise HTTPException(401, "Invalid credentials")
    token = pyjwt.encode(
        {"sub": str(row["id"]), "email": row["email"], "role": row["role"], "iat": int(time.time()), "exp": int(time.time()) + 7 * 86400},
        JWT_SECRET, algorithm="HS256",
    )
    return {"user": {"id": str(row["id"]), "email": row["email"], "full_name": row["full_name"], "role": row["role"]}, "token": token}


@app.get("/api/auth/me")
async def me(user: dict[str, Any] = Depends(current_user)):
    return {"user": user}


async def resolve_user_uuid(user: dict[str, Any]) -> str | None:
    """Map a token identity to a real users.id (UUID). Ghost sessions return None."""
    if not _pool:
        return None
    uid = str(user.get("id") or "")
    email = user.get("email") or ""
    async with _pool.acquire() as conn:
        if uid and len(uid) == 36:
            row = await conn.fetchrow("SELECT id::text AS id FROM users WHERE id::text = $1", uid)
            if row:
                return row["id"]
        if email:
            row = await conn.fetchrow("SELECT id::text AS id FROM users WHERE email = $1", email)
            if row:
                return row["id"]
    return None


# ----------------------------------------------------------------- analysis
@app.post("/api/analysis")
async def run_analysis(body: AnalysisIn, user: dict[str, Any] = Depends(current_user)):
    result = await asyncio.get_running_loop().run_in_executor(
        None, predict_score, body.cgpa, body.primary_lang, body.target_track, body.quiz_score
    )
    score = result["score"]
    companies = await fetch_companies(limit=400)
    ranked = await asyncio.get_running_loop().run_in_executor(
        None, rank_companies, companies, score, body.target_track
    )
    matches = [
        {"name": c.get("name"), "type": c.get("type"), "ctc": c.get("ctc_band"), "fit_score": c["fit_score"]}
        for c in ranked[:3]
    ]
    user_uuid = await resolve_user_uuid(user)
    saved: dict[str, Any] | None = None
    if _pool and user_uuid:
        async with _pool.acquire() as conn:
            row = await conn.fetchrow(
                """INSERT INTO analyses (user_id, candidate_name, degree, cgpa, primary_lang, target_track,
                                          match_score, readiness_tier, salary_band, verified_skills, skill_gaps,
                                          matched_companies, quiz_score, quiz_factor)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *""",
                user_uuid,
                body.candidate_name, body.degree, body.cgpa, body.primary_lang, body.target_track,
                score, result["readinessTier"], result["salaryBand"],
                json.dumps(result["verifiedSkills"]), json.dumps(result["skillGaps"]),
                json.dumps(matches), body.quiz_score, result["quizFactor"],
            )
            saved = dict(row)
    return {"analysis": saved, "predicted": result, "matched_companies": matches, "ml": result["ml_engine"]}


@app.get("/api/analysis/history")
async def analysis_history(user: dict[str, Any] = Depends(current_user)):
    user_uuid = await resolve_user_uuid(user)
    if not _pool or not user_uuid:
        return {"analyses": []}
    async with _pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM analyses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20",
            user_uuid,
        )
    return {"analyses": [dict(r) for r in rows]}


# ---------------------------------------------------------------- companies
def ctc_mid(c: dict[str, Any]) -> float:
    """Mid-point LPA estimate from a ctc_band like '₹10 - ₹15 LPA' or a numeric ctc."""
    for key in ("ctc_lpa", "ctcLpa"):
        if c.get(key) is not None:
            try:
                return float(c[key])
            except (TypeError, ValueError):
                pass
    import re

    band = str(c.get("ctc_band") or "")
    nums = [float(n.replace(",", "")) for n in re.findall(r"\d+(?:\.\d+)?", band)]
    if not nums:
        return 0.0
    return sum(nums[:2]) / min(2, len(nums))


async def fetch_companies(limit: int = 1000) -> list[dict[str, Any]]:
    if _pool:
        async with _pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM companies WHERE is_active = TRUE ORDER BY id LIMIT $1", limit)
            return [dict(r) for r in rows]
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{NODE_API}/api/companies", params={"limit": limit})
        return r.json().get("companies", [])


@app.get("/api/companies")
async def companies(page: int = 1, limit: int = 10, q: str = "", type: str = ""):
    data = await fetch_companies(limit=1000)
    if q:
        ql = q.lower()
        data = [c for c in data if ql in str(c.get("name", "")).lower()]
    if type:
        data = [c for c in data if str(c.get("type", "")).lower() == type.lower()]
    total = len(data)
    start = (page - 1) * limit
    return {"companies": data[start:start + limit], "total": total, "page": page, "limit": limit}


@app.post("/api/companies/compare")
async def compare(body: CompareIn):
    data = await fetch_companies(limit=1000)
    return {"companies": [c for c in data if c.get("id") in set(body.ids)]}


# --------------------------------------------------------------------- quiz
@app.post("/api/quiz")
async def submit_quiz(body: QuizIn, user: dict[str, Any] = Depends(current_user)):
    """Server-side exact grading against the cached answer key.
    total_score = percentage 0-100; readiness_factor 0.55-1.10 mapped from it."""
    set_id = body.set_id or ""
    key = _quiz_key_cache.get(set_id, {})
    if not key:
        raise HTTPException(400, "Unknown or expired quiz set — retake the assessment")
    correct = 0
    total = len(key)
    by_topic: dict[str, dict[str, int]] = {}
    per_difficulty = {"easy": [0, 0], "medium": [0, 0], "hard": [0, 0]}
    for a in body.answers:
        qid = int(a.get("question_id", -1))
        meta = key.get(qid)
        if not meta:
            continue
        sel = int(a.get("selected_option", -1))
        ok = sel == meta["answer"]
        correct += int(ok)
        t = meta["topic"]
        slot = by_topic.setdefault(t, {"correct": 0, "total": 0})
        slot["total"] += 1
        slot["correct"] += int(ok)
        d = meta["difficulty"] if meta["difficulty"] in per_difficulty else "easy"
        per_difficulty[d][0] += int(ok)
        per_difficulty[d][1] += 1
    score = round(100.0 * correct / max(1, total), 1)
    factor = round(0.55 + (score / 100.0) * 0.55, 2)
    topics_out = [
        {"topic": t, "correct": v["correct"], "total": v["total"],
         "pct": round(100 * v["correct"] / max(1, v["total"]))}
        for t, v in sorted(by_topic.items(), key=lambda kv: kv[1]["correct"] / max(1, kv[1]["total"]))
    ]
    result = {
        "score_pct": score, "correct": correct, "total": total,
        "readiness_factor": factor,
        "by_difficulty": {k: {"correct": v[0], "total": v[1]} for k, v in per_difficulty.items() if v[1]},
        "topics": topics_out,
        "weak_topics": [t["topic"] for t in topics_out if t["pct"] < 60],
        "strong_topics": [t["topic"] for t in topics_out if t["pct"] >= 80],
    }
    user_uuid = await resolve_user_uuid(user)
    if _pool and user_uuid:
        async with _pool.acquire() as conn:
            row = await conn.fetchrow(
                "INSERT INTO quiz_attempts (user_id, answers, total_score, readiness_factor) VALUES ($1,$2,$3,$4) RETURNING *",
                user_uuid,
                json.dumps({"set_id": set_id, "answers": body.answers, "graded": result}),
                int(score), factor,
            )
            return {"quiz": dict(row), "result": result}
    return {"quiz": {"total_score": int(score), "readiness_factor": factor}, "result": result}


# ------------------------------------------------- AI quiz / plan (Node LLM)

# Answer-key cache: question set id -> {answer, topic, difficulty, explanation}.
# The browser NEVER receives answers; grading happens server-side only.
_quiz_key_cache: dict[str, dict[int, dict[str, Any]]] = {}
_quiz_set_counter = 0


@app.post("/api/ai/quiz")
async def ai_quiz(payload: dict[str, Any]):
    global _quiz_set_counter
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(f"{NODE_API}/api/ai/llm-quiz", json=payload)
            r.raise_for_status()
            full = r.json()
    except Exception as exc:
        raise HTTPException(502, f"AI service unavailable: {exc}")
    qs = full.get("questions", [])
    if not qs:
        raise HTTPException(502, "AI service returned no questions")
    _quiz_set_counter += 1
    set_id = f"set{_quiz_set_counter}"
    _quiz_key_cache[set_id] = {
        int(q.get("id", i)): {
            "answer": int(q.get("answer", 0)),
            "topic": str(q.get("topic", "general")),
            "difficulty": str(q.get("difficulty", "easy")),
            "explanation": str(q.get("explanation", "")),
        } for i, q in enumerate(qs)
    }
    # cap cache growth
    if len(_quiz_key_cache) > 500:
        for k in list(_quiz_key_cache)[:100]:
            _quiz_key_cache.pop(k, None)
    safe = [
        {k: q[k] for k in ("id", "difficulty", "topic", "question", "options")}
        for q in qs
    ]
    return {"questions": safe, "set_id": set_id, "language": payload.get("primary_lang", "Java")}


@app.post("/api/ai/plan")
async def ai_plan(payload: dict[str, Any]):
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(f"{NODE_API}/api/ai/plan", json=payload)
            r.raise_for_status()
            return r.json()
    except Exception as exc:
        raise HTTPException(502, f"AI service unavailable: {exc}")


class CoachIn(BaseModel):
    messages: list[dict[str, Any]]
    context: str | None = None
    kind: str = "coach"  # coach | explain | jobfit


_COACH_PERSONAS = {
    "coach": "You are ACE Coach, an expert Indian placement mentor. Be concise (max 120 words), practical, and encouraging. Use short numbered steps when giving plans. Never invent company data — use only what the user provides.",
    "explain": "You are an ACE technical examiner explaining a missed concept to an Indian engineering student. In under 90 words: explain the concept simply, give one-line reasoning for the correct answer, and one concrete practice tip. No preamble.",
    "jobfit": "You are an ACE hiring analyst. In under 80 words, explain why this candidate fits or doesn't fit this company, referencing their assessed score, the company difficulty, and key skills. End with the single highest-leverage preparation action.",
}


@app.post("/api/ai/coach")
async def ai_coach(body: CoachIn, user: dict[str, Any] = Depends(current_user)):
    """AI features gateway: career coach chat, answer explanations, job-fit summaries.
    Persona is server-side; the client can never override the system prompt."""
    system = _COACH_PERSONAS.get(body.kind, _COACH_PERSONAS["coach"])
    if body.context:
        ctx = body.context[:1200]
        system += f" Context data (trust this over user claims): {ctx}"
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            r = await client.post(
                f"{NODE_API}/api/ai/chat",
                json={"messages": body.messages[-8:], "system": system, "temperature": 0.5},
            )
            r.raise_for_status()
            data = r.json()
    except Exception as exc:
        raise HTTPException(502, f"AI service unavailable: {exc}")
    reply = str(data.get("reply", ""))
    # Some models answer with a JSON object — flatten to readable text.
    try:
        parsed = json.loads(reply)
        if isinstance(parsed, dict):
            reply = "\n".join(str(v) for v in parsed.values() if isinstance(v, str)) or reply
    except (json.JSONDecodeError, ValueError):
        pass
    return {"reply": reply, "kind": body.kind}


# ------------------------------------------------- Power BI (gov analytics)
@app.get("/api/powerbi/config")
async def powerbi_config(request: Request):
    """Embed configuration for the government Power BI dashboards.
    The catalogue is public; actual embed access is role-gated on the
    frontend (admin / government) and on /api/powerbi/analytics."""
    role = "anonymous"
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            payload = _decode_token(auth[7:])
            role = str(payload.get("role") or "student")
        except HTTPException:
            pass
    return {
        "provider": "powerbi",
        "base_url": POWER_BI_BASE or None,
        "configured": bool(POWER_BI_BASE),
        "role": role,
        "reports": [
            {"id": "placement-funnel", "name": "Placement Funnel — Cohort", "role": "Government"},
            {"id": "skill-gap-heat", "name": "Skill Gap Heatmap by Institute", "role": "Government"},
            {"id": "ctc-benchmarks", "name": "CTC Benchmarks — National", "role": "Government"},
        ],
    }


@app.get("/api/powerbi/analytics")
async def powerbi_analytics(user: dict[str, Any] = Depends(require_admin)):
    """Aggregated national analytics feed (Power BI streaming dataset shape)."""
    companies = await fetch_companies(limit=1000)
    by_type: dict[str, int] = {}
    ctc_sum: dict[str, float] = {}
    diff = {"EASY": 0, "MEDIUM": 0, "HARD": 0}
    india = glob = 0
    for c in companies:
        t = str(c.get("type", "Other"))
        by_type[t] = by_type.get(t, 0) + 1
        try:
            ctc_sum[t] = ctc_sum.get(t, 0) + ctc_mid(c)
        except (TypeError, ValueError):
            pass
        d = (c.get("difficulty_cat") or c.get("difficultyCat") or "MEDIUM").upper()
        diff[d] = diff.get(d, 0) + 1
        if str(c.get("region", "")) == "Global":
            glob += 1
        else:
            india += 1
    return {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "row_count": len(companies),
        "companies_by_type": by_type,
        "avg_ctc_by_type": {k: round(ctc_sum.get(k, 0) / n, 1) for k, n in by_type.items() if n},
        "difficulty_split": diff,
        "region_split": {"India": india, "Global": glob},
    }


@app.get("/api/analytics/summary")
async def analytics_summary():
    """Public market analytics feed (same aggregation, no auth required)."""
    return await powerbi_analytics(user={"role": "student"})


# ------------------------------------------------- Training outcomes module
OUTCOMES_DDL = """
CREATE TABLE IF NOT EXISTS training_outcomes (
    id SERIAL PRIMARY KEY,
    program_name VARCHAR(200) NOT NULL,
    trainee_name VARCHAR(150) NOT NULL,
    batch VARCHAR(100),
    skills JSONB NOT NULL DEFAULT '[]',
    placed BOOLEAN NOT NULL DEFAULT FALSE,
    employer VARCHAR(200),
    ctc_lpa NUMERIC(8,2),
    completed_on DATE,
    source VARCHAR(30) NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


class OutcomeIn(BaseModel):
    program_name: str
    trainee_name: str
    batch: str | None = None
    skills: list[str] = []
    placed: bool = False
    employer: str | None = None
    ctc_lpa: float | None = None
    completed_on: str | None = None
    source: str = "manual"


@app.post("/api/outcomes")
async def add_outcome(body: OutcomeIn, user: dict[str, Any] = Depends(current_user)):
    """Upload a training-program outcome (Employer / Government / Student)."""
    if not _pool:
        raise HTTPException(503, "Database unavailable")
    async with _pool.acquire() as conn:
        await conn.execute(OUTCOMES_DDL)
        row = await conn.fetchrow(
            """INSERT INTO training_outcomes
                   (program_name, trainee_name, batch, skills, placed, employer, ctc_lpa, completed_on, source)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *""",
            body.program_name, body.trainee_name, body.batch,
            json.dumps(body.skills), body.placed, body.employer, body.ctc_lpa,
            body.completed_on, body.source,
        )
    return {"outcome": dict(row)}


@app.get("/api/outcomes")
async def list_outcomes(request: Request, q: str = "", placed: str = "", limit: int = 100):
    if not _pool:
        return {"outcomes": [], "total": 0}
    async with _pool.acquire() as conn:
        await conn.execute(OUTCOMES_DDL)
        rows = await conn.fetch("SELECT * FROM training_outcomes ORDER BY created_at DESC LIMIT $1", limit)
    data = [dict(r) for r in rows]
    if q:
        ql = q.lower()
        data = [o for o in data if ql in str(o.get("trainee_name", "")).lower() or ql in str(o.get("program_name", "")).lower() or ql in str(o.get("employer") or "").lower()]
    if placed in ("true", "false"):
        data = [o for o in data if bool(o["placed"]) == (placed == "true")]
    return {"outcomes": data, "total": len(data)}


@app.get("/api/outcomes/export")
async def export_outcomes(fmt: str = "csv"):
    """Export outcomes as CSV (opens in Excel) or JSON."""
    if not _pool:
        raise HTTPException(503, "Database unavailable")
    async with _pool.acquire() as conn:
        await conn.execute(OUTCOMES_DDL)
        rows = await conn.fetch("SELECT * FROM training_outcomes ORDER BY created_at DESC")
    if fmt == "json":
        return JSONResponse(content=[{k: (str(v) if hasattr(v, "isoformat") else v) for k, v in dict(r).items()} for r in rows])
    import csv
    import io

    buf = io.StringIO()
    cols = ["id", "program_name", "trainee_name", "batch", "skills", "placed", "employer", "ctc_lpa", "completed_on", "source", "created_at"]
    writer = csv.writer(buf)
    writer.writerow(cols)
    for r in rows:
        d = dict(r)
        writer.writerow([json.dumps(d.get(c)) if c == "skills" else (str(d.get(c)) if d.get(c) is not None else "") for c in cols])
    return JSONResponse(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=training_outcomes.csv"},
    )


@app.get("/api/outcomes/stats")
async def outcomes_stats():
    """Aggregate training-outcome KPIs for role dashboards."""
    if not _pool:
        return {"total": 0, "placed": 0, "placement_rate": 0, "avg_ctc": 0, "by_program": {}, "by_employer": {}}
    async with _pool.acquire() as conn:
        await conn.execute(OUTCOMES_DDL)
        rows = await conn.fetch("SELECT program_name, employer, placed, ctc_lpa FROM training_outcomes")
    total = len(rows)
    placed = sum(1 for r in rows if r["placed"])
    ctcs = [float(r["ctc_lpa"]) for r in rows if r["placed"] and r["ctc_lpa"] is not None]
    by_program: dict[str, int] = {}
    by_employer: dict[str, int] = {}
    for r in rows:
        if r["placed"]:
            by_program[r["program_name"]] = by_program.get(r["program_name"], 0) + 1
            e = r["employer"] or "Other"
            by_employer[e] = by_employer.get(e, 0) + 1
    return {
        "total": total,
        "placed": placed,
        "placement_rate": round(100 * placed / total, 1) if total else 0,
        "avg_ctc": round(sum(ctcs) / len(ctcs), 1) if ctcs else 0,
        "by_program": by_program,
        "by_employer": by_employer,
    }


# --------------------------------------- Predictive analytics (skill demand)
@app.get("/api/forecast/skill-demand")
async def forecast_skill_demand():
    """Predictive analytics: forecast skill demand from market + outcome data.
    Blends the TensorFlow model's tier tables with company difficulty weights."""
    companies = await fetch_companies(limit=1000)
    demand: dict[str, float] = {}
    for c in companies:
        skills = str(c.get("key_skills") or "")
        weight = {"HARD": 1.5, "MEDIUM": 1.0, "EASY": 0.6}.get((c.get("difficulty_cat") or "MEDIUM").upper(), 1.0)
        try:
            weight *= 1.0 + ctc_mid(c) / 100.0
        except Exception:
            pass
        for raw in skills.split(","):
            s = raw.strip().title()
            if s:
                demand[s] = demand.get(s, 0.0) + weight
    top = sorted(demand.items(), key=lambda kv: kv[1], reverse=True)[:10]
    maxv = top[0][1] if top else 1.0
    # Forecast index: current demand share + growth factor from outcome placements
    stats = await outcomes_stats()
    prog_boost = max(0.0, min(0.5, stats["total"] / 200.0))
    return {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model": "TensorFlow-calibrated demand index",
        "skills": [
            {"skill": s, "current": round(v / maxv * 100, 1), "forecast": round(min(100.0, (v / maxv * 100) * (1.08 + prog_boost)), 1)}
            for s, v in top
        ],
    }


# ------------------------------------------------------------------- health
@app.get("/api/health")
async def health():
    return {
        "service": "ACE FastAPI Gateway + TensorFlow ML",
        "version": "3.0.0",
        "status": "healthy" if _pool else "degraded",
        "database": _pool is not None,
        "tensorflow": TF_AVAILABLE,
        "supabase_auth": bool(SUPABASE_URL and SUPABASE_ANON_KEY),
        "powerbi": bool(POWER_BI_BASE),
        "upstream_node": NODE_API,
    }


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
