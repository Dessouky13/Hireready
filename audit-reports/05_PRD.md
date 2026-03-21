# 05 — Product Requirements Document (PRD)

**Product:** HireReady Coach  
**Version:** 1.0 (MVP)  
**Date:** 2025-07-18  
**Status:** Pre-Production  

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [User Personas](#2-user-personas)
3. [User Flows](#3-user-flows)
4. [Feature Requirements](#4-feature-requirements)
5. [Technical Requirements](#5-technical-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Information Architecture](#7-information-architecture)
8. [Success Metrics & KPIs](#8-success-metrics--kpis)
9. [Gap Analysis — Current vs. Required](#9-gap-analysis--current-vs-required)
10. [Release Plan](#10-release-plan)

---

## 1. Product Vision

### 1.1 Problem Statement

Job seekers in the MENA region face a significant preparation gap for interviews. Resources are predominantly English-language and Western-centric, leaving Arabic-speaking professionals without culturally relevant, AI-powered practice tools. Mock interviews with career coaches are expensive ($50-150/session) and scheduling-dependent.

### 1.2 Solution

HireReady Coach is an AI-powered voice interview simulator that:

- Conducts realistic, multi-phase interviews with voice interaction (speech-to-text + text-to-speech)
- Adapts questions to the candidate's CV, target role, and experience level
- Supports Arabic and English seamlessly with automatic language detection
- Generates detailed performance reports with actionable improvement advice
- Operates at a fraction of the cost of human coaching ($2-5/interview)

### 1.3 Vision Statement

> *"Democratize interview preparation across the MENA region by making world-class AI coaching accessible, affordable, and culturally relevant."*

### 1.4 Product Principles

| Principle | Description |
|-----------|-------------|
| **Voice-First** | Natural conversation, not chatbot-style typing |
| **Culturally Aware** | Arabic support, MENA job market context |
| **Actionable Feedback** | Reports that tell candidates *exactly* what to improve |
| **Affordable Access** | Free tier + low-cost credits for mass adoption |
| **Privacy Respectful** | CVs and transcripts handled securely, user-owned data |

---

## 2. User Personas

### 2.1 Primary Persona: Nour — Fresh Graduate

| Attribute | Detail |
|-----------|--------|
| **Age** | 22-25 |
| **Location** | Cairo, Egypt |
| **Language** | Arabic (primary), English (professional) |
| **Education** | BSc Computer Science, GPA 3.2 |
| **Experience** | 0-1 years (internships only) |
| **Goal** | Land first full-time developer role |
| **Pain Points** | No interview experience, anxious about English interviews, can't afford coaching |
| **HireReady Need** | Practice technical + behavioral questions, build confidence |
| **Willingness to Pay** | Low — needs free tier, may upgrade for reports |

### 2.2 Secondary Persona: Ahmed — Mid-Career Professional

| Attribute | Detail |
|-----------|--------|
| **Age** | 28-35 |
| **Location** | Dubai, UAE |
| **Language** | English (fluent), Arabic (native) |
| **Experience** | 5-8 years in marketing/product management |
| **Goal** | Switch to senior role at a multinational |
| **Pain Points** | Out of practice with interviews, needs to prepare for situational questions |
| **HireReady Need** | Role-specific practice at higher difficulty, detailed feedback on communication |
| **Willingness to Pay** | Moderate — willing to buy 5-10 credit packs |

### 2.3 Tertiary Persona: Fatima — Career Switcher

| Attribute | Detail |
|-----------|--------|
| **Age** | 30-40 |
| **Location** | Riyadh, Saudi Arabia |
| **Language** | Arabic (primary), limited English |
| **Experience** | 10 years in education, switching to EdTech/HR |
| **Goal** | Transition into a new industry |
| **Pain Points** | Unsure how to position transferable skills, intimidated by new domain jargon |
| **HireReady Need** | Practice explaining career changes, build domain vocabulary |
| **Willingness to Pay** | Moderate — values Arabic-language support |

### 2.4 B2B Persona: University Career Center

| Attribute | Detail |
|-----------|--------|
| **Represented By** | Dr. Khaled — Director of Career Services, Arab Academy |
| **Goal** | Improve graduate employability metrics |
| **Pain Points** | 500+ students per counselor, can't provide individual mock interviews |
| **HireReady Need** | Bulk student accounts, aggregate analytics, LMS integration |
| **Willingness to Pay** | $5-15/student/year for institutional license |

---

## 3. User Flows

### 3.1 Core Flow: Complete Interview Session

```
Landing Page
  │
  ├──► Sign Up (email or Google OAuth)
  │     │
  │     ▼
  │   Dashboard
  │     ├── Credit Balance Display
  │     ├── Interview History List
  │     └── [Start New Interview] button
  │           │
  │           ▼
  │         New Interview Setup (3-step wizard)
  │           Step 1: Select Role Category
  │           Step 2: Select Experience Level
  │           Step 3: Upload CV (optional, PDF/image)
  │           │
  │           ▼
  │         Credit Check (balance ≥ 1?)
  │           ├── NO → Pricing Page → Purchase Credits
  │           └── YES → Deduct Credit → Create Interview Record
  │                       │
  │                       ▼
  │                     Live Interview
  │                       ├── Phase Indicator (Opening → Technical → Behavioral → Situational → Closing)
  │                       ├── AI asks question via TTS
  │                       ├── User responds via voice (STT)
  │                       ├── Transcript updates in real-time
  │                       ├── Orchestrator generates next question
  │                       └── [End Interview] button
  │                             │
  │                             ▼
  │                           Report Generation (AI analysis)
  │                             │
  │                             ▼
  │                           Report Page
  │                             ├── 6 Dimension Scores (radar chart)
  │                             ├── Overall Score & Grade
  │                             ├── Per-Dimension Feedback
  │                             ├── Top 3 Strengths
  │                             ├── Top 3 Improvements
  │                             └── [Download PDF] [Share] [Practice Again]
  │
  └──► Already Signed In → Dashboard (skip auth)
```

### 3.2 Credit Purchase Flow

```
Dashboard / Pricing Page
  │
  ├── View Plans (Starter 5 credits / Pro 15 / Unlimited)
  │     │
  │     ▼
  │   Select Plan → Enter Promo Code (optional)
  │     │
  │     ▼
  │   Payment Processing (Stripe / local gateway)
  │     │
  │     ├── Success → Credits Added → Redirect to Dashboard
  │     └── Failure → Error Message → Retry
  │
  └── Referral Program
        │
        ▼
      Share Referral Link → Friend Signs Up → Both get bonus credit
```

### 3.3 Returning User Flow

```
Dashboard
  │
  ├── View Past Interviews (list with date, role, score)
  │     │
  │     ▼
  │   Click Interview → View Full Report
  │     ├── Review Transcript
  │     ├── Check Scores
  │     └── Download/Share
  │
  └── Start New Interview → (returns to setup wizard)
```

---

## 4. Feature Requirements

### 4.1 P0 — Must-Have (MVP Launch)

| ID | Feature | Description | Current Status |
|----|---------|-------------|----------------|
| F-01 | **Email/Password Auth** | Sign up, sign in, password reset | ✅ Implemented (Supabase Auth) |
| F-02 | **Google OAuth** | One-click Google sign-in | ✅ Implemented (via Lovable cloud) |
| F-03 | **Interview Setup Wizard** | 3-step: role → level → CV upload | ✅ Implemented |
| F-04 | **CV Upload & Parsing** | Accept PDF, extract text for AI context | ✅ Implemented (unpdf in Edge Function) |
| F-05 | **Voice Interview (STT)** | Real-time speech-to-text capture | ✅ Implemented (ElevenLabs Scribe) |
| F-06 | **Voice Interview (TTS)** | AI speaks questions aloud | ✅ Implemented (ElevenLabs turbo v2.5) |
| F-07 | **AI Question Generation** | Multi-phase, role-specific questions | ✅ Implemented (Gemini via orchestrator) |
| F-08 | **Interview Transcript** | Real-time display of conversation | ✅ Implemented |
| F-09 | **Performance Report** | 6-dimension scoring with feedback | ✅ Implemented (generate-report function) |
| F-10 | **Credit System** | Balance tracking, deduction per interview | ⚠️ Client-side only (insecure) |
| F-11 | **Dashboard** | Interview history, credit balance, quick actions | ✅ Implemented |
| F-12 | **Responsive Design** | Mobile-friendly layout | ✅ Implemented (Tailwind responsive) |
| F-13 | **Arabic Language Support** | Auto-detection, Arabic TTS/STT | ⚠️ Partial (detection exists, TTS voice is English-only) |
| F-14 | **Edge Function Auth** | JWT verification on all API endpoints | ❌ Missing (verify_jwt=false) |
| F-15 | **Server-Side Credit Deduction** | Atomic credit management in Edge Function | ❌ Missing |
| F-16 | **Error Handling** | Graceful failures with user feedback | ⚠️ Minimal (some toast notifications) |
| F-17 | **Rate Limiting** | Protect against API abuse | ❌ Missing |

### 4.2 P1 — Should-Have (Post-Launch Sprint 1-2)

| ID | Feature | Description | Current Status |
|----|---------|-------------|----------------|
| F-18 | **Payment Integration** | Stripe or local gateway for credit purchase | ❌ Not implemented (payments table exists, no gateway) |
| F-19 | **Promo Code System** | Apply codes for bonus credits | ⚠️ Schema exists, no UI/backend |
| F-20 | **Referral Program** | Track referrals, award credits | ⚠️ Schema exists, no UI/backend |
| F-21 | **PDF Report Download** | Export report as styled PDF | ❌ UI button exists but not functional |
| F-22 | **Social Sharing** | Share results on LinkedIn/Twitter | ⚠️ Share component exists, limited functionality |
| F-23 | **Interview Resume** | Resume interrupted interview from last state | ⚠️ interview_state table exists, not fully implemented |
| F-24 | **Email Notifications** | Welcome email, report ready, low credits | ❌ Not implemented |
| F-25 | **Analytics Dashboard** | User-facing progress tracking over time | ❌ Not implemented |
| F-26 | **Arabic TTS Voice** | Native Arabic voice for full Arabic interviews | ❌ Uses English voice only |

### 4.3 P2 — Nice-to-Have (Months 3-6)

| ID | Feature | Description | Current Status |
|----|---------|-------------|----------------|
| F-27 | **Video Interview Mode** | Camera on, analyze body language | ❌ Not planned |
| F-28 | **Company-Specific Prep** | Questions tailored to specific companies (Google, Aramco) | ❌ Not planned |
| F-29 | **Peer Practice** | Match with another user for mock interview | ❌ Not planned |
| F-30 | **LMS Integration** | SCORM/LTI for university platforms | ❌ Not planned |
| F-31 | **Admin Dashboard** | Internal analytics, user management, content moderation | ❌ Not planned |
| F-32 | **Multi-Language Expansion** | French, Urdu, Hindi for wider MENA/South Asia | ❌ Not planned |
| F-33 | **Interview Templates** | Pre-built industry-specific question banks | ❌ Not planned |
| F-34 | **AI Coaching Tips** | Real-time coaching hints during interview | ❌ Not planned |

---

## 5. Technical Requirements

### 5.1 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (SPA)                             │
│  React 18 + TypeScript + Vite + shadcn/ui + Tailwind            │
│  Hosted: Static CDN (Lovable / Vercel / Cloudflare Pages)       │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE PLATFORM                             │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │   Auth        │  │  PostgreSQL   │  │  Edge Functions    │    │
│  │   (GoTrue)    │  │  (9 tables)   │  │  (5 Deno workers)  │    │
│  └──────────────┘  └──────────────┘  └────────────────────┘    │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │  Storage      │  │  Realtime     │                            │
│  │  (CVs bucket) │  │  (unused)     │                            │
│  └──────────────┘  └──────────────┘                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        ┌──────────┐ ┌────────┐ ┌──────────┐
        │ElevenLabs│ │Lovable │ │Future:   │
        │  STT/TTS │ │AI GW   │ │Stripe    │
        │  API     │ │(Gemini)│ │Payment   │
        └──────────┘ └────────┘ └──────────┘
```

### 5.2 Frontend Requirements

| Requirement | Specification |
|-------------|---------------|
| Framework | React ≥18.x with TypeScript strict mode |
| Build Tool | Vite ≥5.x with SWC plugin |
| CSS | Tailwind CSS ≥3.4 with custom theme tokens |
| UI Library | shadcn/ui (Radix primitives) |
| Routing | React Router DOM ≥6.x with protected routes |
| State Management | React Context (Auth) + React Query for server state |
| Voice | ElevenLabs Scribe SDK (`@elevenlabs/react`) for STT |
| Audio Playback | Web Audio API (AudioContext) with HTML5 `<audio>` fallback |
| Browser Support | Chrome ≥100, Safari ≥16, Edge ≥100, Firefox ≥100 |
| Mobile Support | iOS Safari ≥16, Chrome Android ≥100 |

### 5.3 Backend Requirements

| Requirement | Specification |
|-------------|---------------|
| Platform | Supabase (managed) |
| Database | PostgreSQL 15+ with RLS on all tables |
| Auth | Supabase Auth with JWT, Google OAuth provider |
| Edge Functions | Deno runtime, CORS handling, JWT verification |
| AI Model | Gemini 3 Flash Preview (via Lovable API Gateway) |
| STT | ElevenLabs Scribe v2 (WebSocket token-based) |
| TTS | ElevenLabs `eleven_turbo_v2_5` model, MP3 streaming |
| Storage | Supabase Storage for CV uploads (PDF, images) |

### 5.4 API Contract: Edge Functions

#### `POST /interview-orchestrator`

**Request:**
```json
{
  "interviewId": "uuid",
  "userId": "uuid",
  "action": "start" | "respond" | "end",
  "userMessage": "string (for respond action)",
  "jobRole": "string",
  "experienceLevel": "string",
  "cvUrl": "string | null"
}
```

**Response:**
```json
{
  "success": true,
  "message": "string (AI response text)",
  "phase": "opening" | "technical" | "behavioral" | "situational" | "closing",
  "isComplete": false,
  "questionNumber": 3,
  "totalQuestions": 8,
  "scores": { "dimension": 0-100 }
}
```

#### `POST /generate-report`

**Request:**
```json
{
  "interviewId": "uuid",
  "userId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "report": {
    "overall_score": 72,
    "overall_grade": "B",
    "dimensions": [
      {
        "name": "Technical Knowledge",
        "score": 75,
        "feedback": "string",
        "strengths": ["..."],
        "improvements": ["..."]
      }
    ],
    "top_strengths": ["..."],
    "top_improvements": ["..."],
    "summary": "string"
  }
}
```

#### `POST /elevenlabs-tts-stream`

**Request:**
```json
{
  "text": "string",
  "voice_id": "JBFqnCBsd6RMkjVDRZzb"
}
```

**Response:** Binary MP3 audio stream

#### `POST /elevenlabs-scribe-token`

**Response:**
```json
{
  "token": "string (single-use)"
}
```

#### `POST /elevenlabs-token`

**Request:**
```json
{
  "cvText": "string | null",
  "jobRole": "string",
  "experienceLevel": "string"
}
```

**Response:**
```json
{
  "token": "string"
}
```

### 5.5 Database Schema

```sql
-- Core entities
profiles (id PK → auth.users, full_name, avatar_url, created_at, updated_at)
credits (id PK, user_id FK → profiles, balance INT DEFAULT 0, updated_at)
interviews (id PK, user_id FK → profiles, job_role, experience_level, cv_url, status, overall_score, started_at, ended_at, created_at)
messages (id PK, interview_id FK → interviews, role CHECK('ai','user'), content, phase, scores JSONB, created_at)
reports (id PK, interview_id FK → interviews, user_id FK → profiles, report_data JSONB, created_at)
interview_state (id PK, interview_id FK → interviews, state JSONB, updated_at)

-- Monetization
payments (id PK, user_id FK → profiles, amount, currency, status, credits_purchased, stripe_session_id, created_at)
promo_codes (id PK, code UNIQUE, credits_amount, max_uses, current_uses, expires_at, is_active, created_at)

-- Growth
referral_signups (id PK, referrer_id FK → profiles, referred_email, credited BOOLEAN, created_at)
```

### 5.6 Security Requirements

| Requirement | Priority | Status |
|-------------|----------|--------|
| JWT verification on all Edge Functions | P0 | ❌ Missing |
| Server-side credit deduction (atomic) | P0 | ❌ Missing |
| IDOR prevention (ownership checks) | P0 | ❌ Missing |
| `.env` removed from git, credentials rotated | P0 | ❌ Missing |
| Input sanitization on all endpoints | P0 | ⚠️ Partial |
| CORS restricted to production origin | P1 | ❌ Wildcard `*` |
| Rate limiting on Edge Functions | P1 | ❌ Missing |
| CSP headers on frontend | P2 | ❌ Missing |
| Audit logging for sensitive operations | P2 | ❌ Missing |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Metric | Target | Current Estimate |
|--------|--------|-----------------|
| First Contentful Paint (FCP) | < 1.5s | ~2s (large bundle, no code splitting) |
| Largest Contentful Paint (LCP) | < 2.5s | ~3s (Hero section images) |
| Time to Interactive (TTI) | < 3s | ~4s |
| AI Response Latency | < 3s end-to-end | ~4-6s (orchestrator + TTS) |
| TTS Audio Start | < 1s after response | ~1.5s (streaming helps) |
| STT Recognition Delay | < 500ms | ~300ms (ElevenLabs Scribe) |
| Report Generation | < 10s | ~8-15s |
| Bundle Size (gzipped) | < 200KB | ~350KB (no code splitting) |

### 6.2 Reliability

| Metric | Target |
|--------|--------|
| Uptime | 99.5% (Supabase SLA dependent) |
| Data Durability | 99.99% (PostgreSQL + Supabase backups) |
| Interview Completion Rate | > 85% (sessions started vs. reports generated) |
| Error Recovery | Graceful fallback on TTS/STT failure |
| Offline Handling | Detect offline state, queue critical operations |

### 6.3 Accessibility

| Requirement | Priority | Status |
|-------------|----------|--------|
| WCAG 2.1 AA compliance | P1 | ❌ Not audited |
| Keyboard navigation for all flows | P1 | ⚠️ Partial (Radix provides some) |
| Screen reader support | P1 | ❌ Missing aria-labels |
| Color contrast ratios ≥ 4.5:1 | P1 | ⚠️ Neubrutalism palette may fail |
| Focus management in interview flow | P1 | ❌ Not implemented |
| Reduced motion support | P2 | ❌ Not implemented |

### 6.4 Internationalization (i18n)

| Requirement | Priority | Status |
|-------------|----------|--------|
| RTL layout support for Arabic | P0 | ❌ Not implemented |
| UI string externalization | P1 | ❌ All strings hardcoded in English |
| Arabic UI translation | P1 | ❌ Not started |
| Date/number formatting (locale-aware) | P2 | ❌ Not implemented |
| Arabic TTS voice selection | P1 | ❌ Uses English voice |

### 6.5 Scalability Targets

| Phase | Users | Concurrent Interviews | DB Rows | Edge Function Invocations/day |
|-------|-------|----------------------|---------|-------------------------------|
| MVP Launch | 500 | 10 | 50K | 5,000 |
| Month 3 | 5,000 | 50 | 500K | 50,000 |
| Month 6 | 20,000 | 200 | 2M | 200,000 |
| Month 12 | 100,000 | 1,000 | 10M | 1,000,000 |

---

## 7. Information Architecture

### 7.1 Page Map

```
/                     → Landing Page (public)
  ├── Hero section
  ├── Features section
  ├── How It Works section
  ├── Pricing section
  ├── CTA Banner
  └── Footer

/auth/sign-in         → Sign In (public)
/auth/sign-up         → Sign Up (public)
/auth/reset-password  → Password Reset (public)
/auth/callback        → OAuth Callback (system)

/dashboard            → Dashboard (protected)
  ├── Credit balance card
  ├── Start new interview button
  ├── Interview history list
  └── Download/share results

/interview/new        → Interview Setup Wizard (protected)
  ├── Step 1: Role selection
  ├── Step 2: Level selection
  └── Step 3: CV upload

/interview/:id        → Live Interview (protected)
  ├── Phase indicator
  ├── Voice controls
  ├── Real-time transcript
  └── End interview button

/report/:id           → Interview Report (protected)
  ├── Score overview (radar chart)
  ├── Dimension breakdowns
  ├── Strengths & improvements
  └── Download/share actions

/pricing              → Pricing Page (public)
  ├── Plan comparison
  └── Purchase flow

/*                    → 404 Not Found
```

### 7.2 Navigation Structure

```
TopNav (authenticated):
  Logo → /dashboard
  Dashboard → /dashboard
  New Interview → /interview/new
  Pricing → /pricing
  Avatar → Profile / Sign Out

TopNav (unauthenticated):
  Logo → /
  Features → /#features
  How It Works → /#how-it-works
  Pricing → /pricing
  Sign In → /auth/sign-in
  Get Started → /auth/sign-up
```

---

## 8. Success Metrics & KPIs

### 8.1 North Star Metric

**Interviews Completed Per Week** — measures both acquisition (users starting interviews) and product value (users finishing them).

### 8.2 Acquisition Metrics

| Metric | Definition | MVP Target (Month 1) | Growth Target (Month 6) |
|--------|-----------|----------------------|------------------------|
| Signups/week | New account registrations | 50 | 500 |
| Activation Rate | % of signups who complete 1 interview | 40% | 55% |
| CAC | Cost per acquired user | $0 (organic) | < $3 |
| Referral Rate | % of users who refer at least 1 person | 5% | 15% |

### 8.3 Engagement Metrics

| Metric | Definition | MVP Target | Growth Target |
|--------|-----------|------------|---------------|
| Interviews/user/month | Average completed interviews per active user | 1.5 | 3 |
| Interview Completion Rate | % of started interviews that generate a report | 70% | 85% |
| Session Duration | Average time in interview | 8 min | 12 min |
| Return Rate (D7) | % of users who return within 7 days | 25% | 40% |
| DAU/MAU Ratio | Daily vs. monthly active users | 5% | 15% |

### 8.4 Monetization Metrics

| Metric | Definition | MVP Target | Growth Target |
|--------|-----------|------------|---------------|
| Conversion Rate | Free → Paid | 3% | 8% |
| ARPU | Average revenue per user (monthly) | $1.50 | $5 |
| ARPPU | Average revenue per paying user | $8 | $12 |
| LTV | Customer lifetime value | $15 | $60 |
| LTV:CAC Ratio | Unit economics viability | > 3:1 | > 5:1 |

### 8.5 Product Quality Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| Report Usefulness Score | User rating (1-5) on report helpfulness | ≥ 4.0 |
| STT Accuracy | % of words correctly transcribed | ≥ 90% |
| AI Question Relevance | User rating on question quality | ≥ 4.0 |
| App Crash Rate | Sessions with unhandled errors | < 1% |
| CSAT | Overall satisfaction score | ≥ 4.2/5 |
| NPS | Net Promoter Score | ≥ 30 |

---

## 9. Gap Analysis — Current vs. Required

### 9.1 Critical Gaps (Block Launch)

| Gap | Impact | Effort | Resolution |
|-----|--------|--------|------------|
| **No server-side auth on Edge Functions** | Anyone can call APIs unauthenticated | 2 days | Enable `verify_jwt = true`, add auth extraction in each function |
| **Client-side credit deduction** | Free unlimited interviews by bypassing client code | 1 day | Move credit check + deduction into `interview-orchestrator` with `SELECT ... FOR UPDATE` |
| **Committed `.env` with live credentials** | Supabase anon key exposed in git history | 1 day | Rotate credentials, add `.env` to `.gitignore`, use `git filter-branch` |
| **IDOR on report generation** | Any user can generate/read any user's report | 0.5 day | Verify `userId` from JWT matches interview owner |
| **No payment integration** | No revenue = no business | 5 days | Integrate Stripe Checkout with webhook for credit fulfillment |
| **No error boundaries** | Single component crash breaks entire app | 1 day | Add React Error Boundaries at route level |

### 9.2 Important Gaps (Fix Within 2 Weeks of Launch)

| Gap | Impact | Effort | Resolution |
|-----|--------|--------|------------|
| **No RTL/Arabic UI** | Alienates primary target audience | 3 days | Add `dir="rtl"` support, externalize strings, translate UI |
| **No rate limiting** | API abuse, cost blowup | 1 day | Implement token-bucket in Edge Functions or use Supabase rate limit |
| **React Query unused** | No caching, stale data, refetch on window focus | 2 days | Replace `useEffect` + `useState` data fetching with `useQuery`/`useMutation` |
| **No code splitting** | Large bundle, slow initial load | 1 day | Add `React.lazy()` for route-level splitting |
| **No PDF export** | Button exists but doesn't work — broken promise | 2 days | Implement with html2pdf.js or server-side generation |
| **Zero test coverage** | No regression safety for rapid iteration | 3 days | Write tests for critical paths: auth, credit deduction, orchestrator |

### 9.3 Desirable Gaps (Backlog)

| Gap | Impact | Effort |
|-----|--------|--------|
| No analytics/event tracking | Can't measure KPIs above | 1 day |
| No onboarding flow | Users don't understand what to expect | 2 days |
| No interview resume capability | Lost work if browser crashes | 2 days |
| No admin panel | Manual database queries for operations | 5 days |
| No A/B testing framework | Can't optimize conversion | 2 days |
| No push notifications / email | Can't re-engage churned users | 3 days |

---

## 10. Release Plan

### 10.1 Phase 0: Security Hardening (Week 1)

**Goal:** Eliminate launch-blocking security vulnerabilities.

| Task | Owner | Days |
|------|-------|------|
| Rotate Supabase credentials, remove `.env` from git | Backend | 0.5 |
| Enable JWT verification on all Edge Functions | Backend | 1 |
| Move credit deduction server-side (atomic) | Backend | 1 |
| Fix IDOR in generate-report and orchestrator | Backend | 0.5 |
| Add input validation and sanitization | Backend | 1 |
| Add React Error Boundaries | Frontend | 0.5 |
| **Total** | | **4.5 days** |

### 10.2 Phase 1: MVP Polish (Week 2-3)

**Goal:** Minimum viable product ready for beta users.

| Task | Owner | Days |
|------|-------|------|
| Integrate Stripe for credit purchases | Full-stack | 3 |
| Implement rate limiting | Backend | 1 |
| Add code splitting (lazy routes) | Frontend | 1 |
| Use React Query for data fetching | Frontend | 2 |
| Implement promo code redemption UI | Frontend | 1 |
| Basic RTL support for Arabic layout | Frontend | 2 |
| **Total** | | **10 days** |

### 10.3 Phase 2: Beta Launch (Week 4)

**Goal:** Release to 100-200 beta users.

| Task | Owner | Days |
|------|-------|------|
| Deploy to production CDN | DevOps | 0.5 |
| Set up monitoring (Sentry + analytics) | DevOps | 1 |
| Create onboarding tutorial | Frontend | 1 |
| PDF report download | Frontend | 2 |
| Beta user recruitment (university partnerships) | Growth | Ongoing |
| **Total** | | **4.5 days** |

### 10.4 Phase 3: Public Launch (Week 6-8)

**Goal:** Open access with full monetization.

| Task | Owner | Days |
|------|-------|------|
| Arabic UI translation | Frontend | 3 |
| Arabic TTS voice integration | Backend | 1 |
| Referral program implementation | Full-stack | 2 |
| Email notification system | Backend | 2 |
| SEO optimization | Frontend | 1 |
| Landing page A/B testing | Growth | Ongoing |
| **Total** | | **9 days** |

---

## Appendix A: Acceptance Criteria Templates

### F-05: Voice Interview (STT)

**Given** the user is on the Live Interview page  
**When** they click the microphone button and speak  
**Then** their speech is transcribed to text within 500ms  
**And** the transcript appears in the conversation panel  
**And** if STT fails, a fallback text input is presented  

### F-09: Performance Report

**Given** the user has completed an interview (all phases or pressed End)  
**When** the report is generated  
**Then** it displays scores for all 6 dimensions (0-100)  
**And** each dimension has written feedback  
**And** top 3 strengths and improvements are listed  
**And** overall score and letter grade are shown  
**And** report loads within 15 seconds  

### F-10: Credit System (Server-Side)

**Given** the user starts a new interview  
**When** the orchestrator receives the "start" action  
**Then** it verifies the user's credit balance ≥ 1  
**And** atomically decrements the balance by 1  
**And** if balance is 0, returns a 402 error with redirect to pricing  
**And** the operation is idempotent (retries don't double-deduct)  

---

## Appendix B: Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ElevenLabs API cost overrun | High | High | Implement per-user rate limits, cache common TTS phrases, monitor daily spend |
| Gemini model quality regression | Medium | High | Pin model version, maintain evaluation dataset, have fallback model (GPT-4o-mini) |
| Supabase Edge Function cold starts | Medium | Medium | Keep functions warm with cron pings, optimize bundle size |
| Arabic STT accuracy issues | High | Medium | Test extensively with MENA accents, provide fallback text input |
| Low conversion rate (free → paid) | High | High | Optimize free tier value (reports behind paywall), A/B test pricing |
| Competitor launches similar product | Medium | Medium | Move fast, focus on Arabic/MENA niche, build university partnerships |
| Regulatory compliance (data privacy) | Low | High | Implement data deletion, review MENA data protection laws |

---

*This PRD should be reviewed and updated quarterly as the product evolves and user feedback is incorporated.*
