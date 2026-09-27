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

## 🔐 Sign-in Methods (one method per account)

Accounts register with exactly **one** of the following, each with its own verification flow:

| Method | Verification |
|---|---|
| **Google** | Email + 6-digit code sent via email (2-step wizard) |
| **LinkedIn** | Email + 6-digit code sent via email (2-step wizard) |
| **Facebook** | Username + password (bcrypt-hashed; first use creates the account) |
| **X (Twitter)** | Username + password (bcrypt-hashed; first use creates the account) |
| **Mobile number** | OTP via SMS (hashed, 5-min expiry, max 5 attempts) |
| **Email + password** | Classic login/registration |

The backend enforces one-identity-per-method: an email/phone already registered with another method returns `409` with `registered_with` so the UI can redirect the user to the right flow.

Verification emails are sent via SMTP when `SMTP_*` env vars are set (see `.env.example`); without them (dev), codes are logged to the server console and returned as `dev_code` in the API response.

After adding credentials, run:

```bash
npm run db:auth-migrate
```

## 📚 API Endpoints Summary

- `POST /api/auth/register` — Register user (email + password)
- `POST /api/auth/login` — Login user (email + password)
- `POST /api/auth/oauth/:provider` — Sign in / sign up with Google, Facebook, X or LinkedIn
- `POST /api/auth/email-code/request` — Send email verification code (Google / LinkedIn flow)
- `POST /api/auth/email-code/verify` — Verify email code → login or create account (Google / LinkedIn flow)
- `POST /api/auth/provider/credentials` — Username + password sign-in for Facebook / X
- `POST /api/auth/phone/request-otp` — Send mobile OTP
- `POST /api/auth/phone/verify-otp` — Verify mobile OTP (login or one-tap signup)
- `GET  /api/auth/methods?identifier=` — Which sign-in method an email/phone is registered with
- `GET  /api/companies` — Search & filter 500+ placement database
- `POST /api/companies/compare` — Compare candidate companies
- `POST /api/analysis` — Run server-validated Skill Gap Engine
- `GET  /api/analysis/history` — View persistent progress history
- `GET  /api/analysis/:id/study-plan` — 30-Day custom preparation plan
- `GET  /api/analysis/:id/interview-questions` — Generated interview rounds
- `POST /api/quiz` — Submit readiness quiz
- `GET  /api/reports/:id/pdf` — Download PDF report
- `GET  /api/health` — System diagnostics
