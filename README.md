# ACE — Adaptive & Continuous Education (Production Backend)

## 🚀 Quick Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Database:**
   ```bash
   cp .env.example .env
   # Update your PostgreSQL username and password in .env
   ```

3. **Run Migrations & Seed Data:**
   ```bash
   npm run db:reset
   ```

4. **Start the Server:**
   ```bash
   npm run dev
   # Server runs at http://localhost:3000
   ```

## 📚 API Endpoints Summary

- `POST /api/auth/register` — Register user
- `POST /api/auth/login` — Login user
- `GET  /api/companies` — Search & filter 500+ placement database
- `POST /api/companies/compare` — Compare candidate companies
- `POST /api/analysis` — Run server-validated Skill Gap Engine
- `GET  /api/analysis/history` — View persistent progress history
- `GET  /api/analysis/:id/study-plan` — 30-Day custom preparation plan
- `GET  /api/analysis/:id/interview-questions` — Generated interview rounds
- `POST /api/quiz` — Submit readiness quiz
- `GET  /api/reports/:id/pdf` — Download PDF report
- `GET  /api/health` — System diagnostics
