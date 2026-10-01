# ACE Deployment Guide (Vercel + Render)

## Why Vercel was returning 500

This repo's root is an **Express.js server** (`server.js`). Vercel treats any repo
without `vercel.json` as a Serverless project: it wraps `server.js` in a Lambda,
but that file:

1. calls `app.listen(3000)` — servers cannot listen in serverless; and
2. runs a PostgreSQL health-check at boot and `process.exit(1)` on failure —
   no database is reachable from a bare Lambda.

Result: every request → `500 INTERNAL_SERVER_ERROR`.

## The fix (already applied)

`vercel.json` now tells Vercel to build **only the React app**
(`frontend/ → public/app`) and serve it as a **static site** with SPA
rewrites. No serverless function is created.

- Build: `cd frontend && npm ci && npm run build`
- Output: `public/app`
- Rewrites keep `/app/*` deep links working.

## Backend cannot live on Vercel

The stack needs **two always-on servers** (Express LLM proxy + FastAPI/TensorFlow)
plus PostgreSQL. Vercel serverless cannot run `listen()` or TensorFlow warmups.
Deploy the backend to **Render** (free tier works):

### Option A — Blueprint (recommended)

1. Push this repo to GitHub (the `render.yaml` blueprint is committed at the root).
2. Render Dashboard → **New → Blueprint** → select the repo → **Apply**.
   Render reads `render.yaml` and creates both Docker services:
   - **ace-node** — root `./Dockerfile`, Express + LLM proxy, health `/api/health`.
   - **ace-fastapi** — `./backend/Dockerfile`, FastAPI + TensorFlow, health `/api/health`
     (its CMD honors Render's `PORT` env).
3. Render prompts once for the `sync: false` variables — paste
   `DATABASE_URL`, `JWT_SECRET`, and at least one LLM API key
   (see table below). The service-to-service URLs (`FASTAPI_URL`,
   `NODE_API_URL`) are pre-filled in the blueprint from the service names
   `ace-node` / `ace-fastapi` — if Render renames the URLs, update those values.
4. Or create two **Web Services** manually (blueprint not required):
   - **ACE Node**: Root dir `/`, Docker, port 3000.
   - **ACE FastAPI**: Root dir `backend/`, Docker, port 8001.

### Environment variables (Render → Web Service → Environment)

Both services need:

| Variable | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host/db` | Neon/Supabase/Render Postgres. **Render needs `-sslmode=require`** appended. |
| `JWT_SECRET` | any long random string | same value on both services |
| `CORS_ORIGIN` | `https://aceskills.vercel.app` | comma-separated origins is supported |
| `NODE_API_URL` | `https://ace-node.onrender.com` | **set on FastAPI only** |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` / `GROQ_API_KEY` | key | any one powers the AI features |

Node service additionally: `FASTAPI_URL=https://ace-fastapi.onrender.com`

### Frontend env (Vercel → Project → Settings → Environment Variables)

| Variable | Example |
|---|---|
| `VITE_FASTAPI_URL` | `https://ace-fastapi.onrender.com` |

Without it the app calls `/api/*` same-origin (fine for local dev, dead on
Vercel) — **this is required**.

> ⚠️ Render free tier sleeps after 15 min idle → first request takes ~50s.
> Ping `https://<your-app>.onrender.com/api/health` before a demo.

## Local development

Unchanged: `node server.js` (:3000) + `uvicorn app.main:app --port 8001`
+ `cd frontend && npm run dev` (:5173). `VITE_FASTAPI_URL` stays empty locally
so the Vite proxy handles `/api`.
