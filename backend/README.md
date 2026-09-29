# FastAPI + TensorFlow ML backend

```bash
pip install -r requirements.txt
uvicorn app.main:app --port 8000   # from this directory
```

Environment (all optional, read from the repo root `.env`):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` / `DB_*` | PostgreSQL connection (same DB as the Node service) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` | Supabase Auth (signup/login/token verification) |
| `JWT_SECRET` | Local JWT fallback when Supabase is not configured |
| `POWER_BI_BASE_URL` | Power BI embed base URL for government dashboards |
| `NODE_API_URL` | Upstream Node service (AI quiz/plan + PDF reports) |
