CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
    degree VARCHAR(100),
    cgpa NUMERIC(3,1),
    primary_lang VARCHAR(50),
    target_track VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('Product', 'Service')),
    ctc_band VARCHAR(50) NOT NULL,
    difficulty_pct INTEGER NOT NULL,
    difficulty_cat VARCHAR(10) NOT NULL,
    rounds_desc VARCHAR(300) NOT NULL,
    key_skills TEXT NOT NULL,
    display_rank INTEGER NOT NULL DEFAULT 0,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    candidate_name VARCHAR(150) NOT NULL,
    degree VARCHAR(100) NOT NULL,
    cgpa NUMERIC(3,1) NOT NULL,
    primary_lang VARCHAR(50) NOT NULL,
    target_track VARCHAR(50) NOT NULL,
    match_score INTEGER NOT NULL,
    readiness_tier VARCHAR(100) NOT NULL,
    salary_band VARCHAR(50) NOT NULL,
    verified_skills JSONB NOT NULL DEFAULT '[]',
    skill_gaps JSONB NOT NULL DEFAULT '[]',
    matched_companies JSONB NOT NULL DEFAULT '[]',
    quiz_score INTEGER,
    quiz_factor NUMERIC(4,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
    answers JSONB NOT NULL DEFAULT '[]',
    total_score INTEGER NOT NULL,
    readiness_factor NUMERIC(4,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
