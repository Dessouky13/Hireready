# CLAUDE.md — HireReady Coach
## Production Engineering Playbook v1.0

> This file is the authoritative guide for any AI agent or developer working on HireReady Coach.
> Read it fully before touching any code. Every section exists because something broke or cost money.

---

## 0. Project Overview

**Product:** HireReady Coach — AI-powered voice interview simulator for MENA job seekers  
**Stack:** React 18 + TypeScript + Vite → Supabase (Auth + PostgreSQL + Edge Functions + Storage) → ElevenLabs (STT/TTS) → Gemini Flash (LLM)  
**Target:** Arabic/English bilingual users in Egypt, UAE, Saudi Arabia  
**Business model:** Credit-based (pay-per-interview), free tier on-ramp  

---

## 1. ABSOLUTE RULES — Never Violate

```
1. NEVER set verify_jwt = false on any Edge Function. Ever.
2. NEVER deduct credits on the client side. Credits are money.
3. NEVER expose raw API keys in client code, git history, or logs.
4. NEVER trust userId from request body — always extract from JWT.
5. NEVER allow one user to access another user's interview/report data.
6. NEVER call ElevenLabs TTS directly from the client — always proxy through Edge Function.
7. NEVER generate a new STT token without first verifying the user has credits ≥ 1.
8. NEVER commit .env files. Use Supabase Vault for secrets in production.
```

---

## 2. Architecture Decision Log

### 2.1 Keep Supabase (Don't Self-Host Yet)

**Decision:** Stay on Supabase Cloud through 10,000 MAU. Migrate to self-hosted or managed Postgres after that.

**Rationale:**
- Supabase Pro = $25/mo covers auth, DB, storage, edge functions, and RLS in one bill
- Self-hosting on VPS (~$40-60/mo for 4GB RAM) saves ~$0/mo at MVP scale once you factor DevOps hours
- Edge Functions (Deno) eliminate a separate API server — this is a huge cost and complexity saving
- RLS (Row Level Security) on every table = security at the database layer, not just app layer
- Auth (GoTrue) + OAuth is production-grade out of the box

**Migrate away from Supabase Cloud when:**
- Monthly Supabase bill exceeds $300 (roughly 5,000+ DAU with heavy usage)
- You need a MENA data residency requirement (PDPL, DIFC, etc.)
- You need to run >5 concurrent Edge Function deployments

**If/when you migrate:**
- Use self-hosted Supabase on Hetzner (Germany/Finland) — ~$55/mo for 8 vCPU / 16GB RAM
- Or: migrate DB to Neon (serverless Postgres) + deploy API on Railway or Fly.io
- Keep Supabase Auth or replace with Better-Auth / Clerk

### 2.2 Replace Gemini via Lovable Gateway → Direct Google AI API

**Decision:** Call Gemini Flash directly via Google AI Studio API key, not through Lovable's gateway.

**Rationale:**
- Lovable gateway adds latency and is a single point of failure you don't control
- Direct Gemini API: Gemini 2.5 Flash = $0.30/$2.50 per million tokens in/out
- A 12-minute interview with 8 exchanges ≈ ~3,000 input tokens + ~1,500 output tokens = **$0.005 per interview**
- Store the Google API key in Supabase Vault, access from Edge Function only

### 2.3 ElevenLabs — Watch Your Credits

**Current pricing (March 2026):**
- TTS (turbo_v2_5): ~0.5 credits/char on Pro plan. Average AI question = 120 chars → ~60 credits
- 8 questions per interview = ~480 TTS credits per interview
- STT (Scribe): billed per audio minute. 12-min interview ≈ $0.10-0.15
- ElevenLabs Pro plan ($99/mo) = 500,000 credits/mo → ~1,040 interviews/mo TTS capacity
- **At scale: budget $0.15-0.25 per interview for ElevenLabs combined**

**Cost optimization:**
- Cache common TTS phrases (opening/closing scripts) — avoid regenerating identical audio
- Use `eleven_turbo_v2_5` (not multilingual v2) for English — faster, cheaper
- For Arabic: switch to a native Arabic voice (Adam/Farida) — same credit rate, better quality
- Implement per-user daily STT minute limits to prevent abuse

### 2.4 Arabic TTS Voice

**Decision:** Use ElevenLabs voice ID `XB0fDUnXU5powFXDhCwa` (Charlotte) for English, and source a native Arabic male/female voice from ElevenLabs voice library for Arabic sessions.

**Detection logic (in orchestrator):**
```typescript
function detectLanguage(text: string): 'ar' | 'en' {
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  const arabicChars = (text.match(arabicPattern) || []).length;
  return arabicChars / text.length > 0.3 ? 'ar' : 'en';
}
```

---

## 3. Security Hardening Checklist (P0 — Block All Other Work Until Done)

### 3.1 Edge Function Auth — Every Single Function

```typescript
// Add to TOP of every edge function, before any business logic
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const authHeader = req.headers.get('Authorization')
if (!authHeader) return new Response('Unauthorized', { status: 401 })

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: authHeader } } }
)

const { data: { user }, error } = await supabase.auth.getUser()
if (error || !user) return new Response('Unauthorized', { status: 401 })

// ALWAYS use user.id from JWT, never from request body
const userId = user.id
```

### 3.2 Credit Deduction — Atomic Server-Side Only

```sql
-- Run this as a Postgres function (not in application code)
CREATE OR REPLACE FUNCTION deduct_credit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance INT;
BEGIN
  SELECT balance INTO current_balance
  FROM credits
  WHERE user_id = p_user_id
  FOR UPDATE; -- Row-level lock prevents race conditions

  IF current_balance IS NULL OR current_balance < 1 THEN
    RETURN FALSE;
  END IF;

  UPDATE credits
  SET balance = balance - 1, updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$;
```

Call this from `interview-orchestrator` on action = "start":
```typescript
const { data: credited } = await supabaseAdmin.rpc('deduct_credit', { p_user_id: userId })
if (!credited) return new Response(JSON.stringify({ error: 'insufficient_credits' }), { status: 402 })
```

### 3.3 IDOR Prevention — Ownership Checks

```typescript
// Before ANY operation on interview or report data:
const { data: interview } = await supabaseAdmin
  .from('interviews')
  .select('id, user_id')
  .eq('id', interviewId)
  .eq('user_id', userId) // CRITICAL: always filter by user_id from JWT
  .single()

if (!interview) return new Response('Forbidden', { status: 403 })
```

### 3.4 CORS — Lock Down in Production

```typescript
// In each Edge Function:
const ALLOWED_ORIGINS = [
  'https://hireready.coach', // your production domain
  'https://www.hireready.coach',
  // 'http://localhost:5173' // only in dev — remove for prod deployment
]

const origin = req.headers.get('Origin') || ''
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

### 3.5 Rate Limiting — Simple Token Bucket in Edge Function

```typescript
// Store rate limit state in Supabase (or use Upstash Redis for production)
const RATE_LIMITS = {
  'interview-orchestrator': { requests: 20, window: 60 }, // 20 req/min per user
  'elevenlabs-tts-stream': { requests: 30, window: 60 },
  'elevenlabs-scribe-token': { requests: 5, window: 60 },
}

async function checkRateLimit(supabase: any, userId: string, endpoint: string): Promise<boolean> {
  const key = `rate_limit:${endpoint}:${userId}`
  const windowStart = Math.floor(Date.now() / 60000) * 60000

  const { data } = await supabase.rpc('increment_rate_limit', {
    p_key: key,
    p_window_start: new Date(windowStart).toISOString(),
    p_limit: RATE_LIMITS[endpoint]?.requests ?? 10
  })
  return data === true
}
```

---

## 4. Performance Optimizations

### 4.1 Code Splitting — Add to vite.config.ts

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-charts': ['recharts'],
          'vendor-elevenlabs': ['@elevenlabs/react'],
        }
      }
    }
  }
})
```

### 4.2 React Query — Replace All useEffect Data Fetching

```typescript
// WRONG (current pattern)
useEffect(() => {
  supabase.from('interviews').select('*').then(setInterviews)
}, [])

// CORRECT (React Query)
const { data: interviews, isLoading } = useQuery({
  queryKey: ['interviews', userId],
  queryFn: () => supabase.from('interviews').select('*').eq('user_id', userId),
  staleTime: 30_000,
})
```

### 4.3 TTS Streaming — Reduce Perceived Latency

Start audio playback as soon as the first chunk arrives. Do NOT wait for the full MP3:

```typescript
const response = await fetch('/functions/v1/elevenlabs-tts-stream', {
  method: 'POST',
  headers: { Authorization: `Bearer ${session.access_token}` },
  body: JSON.stringify({ text, voice_id: voiceId }),
})

const reader = response.body!.getReader()
const audioContext = new AudioContext()
// Queue chunks to AudioBufferSourceNode as they arrive
// See: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext
```

---

## 5. Bilingual Architecture — Arabic + English

### 5.1 RTL Layout

Add to `index.html`:
```html
<html lang="ar" dir="rtl"> <!-- switch dynamically based on user's language -->
```

Add to `tailwind.config.ts`:
```typescript
plugins: [require('tailwindcss-rtl')]
// Then use: rtl:text-right, rtl:mr-4, rtl:pr-0, etc.
```

### 5.2 i18n — Externalize All Strings

```typescript
// src/i18n/ar.ts
export const ar = {
  dashboard: { title: 'لوحة التحكم', startInterview: 'ابدأ مقابلة' },
  interview: { listening: 'أنا أستمع...', thinking: 'جاري التفكير...' },
}

// src/i18n/en.ts
export const en = {
  dashboard: { title: 'Dashboard', startInterview: 'Start Interview' },
  interview: { listening: 'Listening...', thinking: 'Thinking...' },
}
```

### 5.3 System Prompt — Arabic Awareness

```typescript
const systemPrompt = (lang: 'ar' | 'en') => `
You are a professional interview coach conducting a realistic job interview.
Language: ${lang === 'ar' ? 'Respond ONLY in Modern Standard Arabic (فصحى). Do not mix languages.' : 'Respond in clear, professional English.'}
Role: ${jobRole}
Candidate level: ${experienceLevel}
CV summary: ${cvSummary || 'Not provided'}

INTERVIEW PHASES (follow in order):
1. Opening (2 questions): Warm greeting, ask candidate to introduce themselves
2. Technical (3 questions): Role-specific, progressive difficulty
3. Behavioral (2 questions): STAR method, past experiences
4. Situational (1 question): Hypothetical scenario relevant to the role
5. Closing (1 question): Candidate's questions, wrap-up

RULES:
- Ask ONE question at a time. Wait for the full response before asking the next.
- Never reveal the scoring rubric or that you are an AI during the interview.
- If the candidate goes off-topic, gently redirect.
- Track phase progression internally; signal phase changes with a brief transition.
- After the final question, output exactly: [INTERVIEW_COMPLETE]
`
```

---

## 6. Database — RLS Policies

Ensure ALL tables have RLS enabled. Paste these into Supabase SQL Editor:

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_state ENABLE ROW LEVEL SECURITY;

-- profiles: users can only read/update their own profile
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id);

-- credits: users can only read their own balance (writes are server-side only)
CREATE POLICY "credits_read_own" ON credits
  FOR SELECT USING (auth.uid() = user_id);

-- interviews: users can CRUD only their own
CREATE POLICY "interviews_own" ON interviews
  FOR ALL USING (auth.uid() = user_id);

-- messages: users can read/insert on their own interviews
CREATE POLICY "messages_own" ON messages
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM interviews WHERE id = interview_id)
  );

-- reports: users can read only their own reports
CREATE POLICY "reports_own" ON reports
  FOR SELECT USING (auth.uid() = user_id);

-- Prevent direct credit manipulation from client
REVOKE UPDATE ON credits FROM anon, authenticated;
REVOKE INSERT ON credits FROM anon, authenticated;
```

---

## 7. Error Handling

### 7.1 React Error Boundaries (Add at Route Level)

```tsx
// src/components/ErrorBoundary.tsx
export class ErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', err, info)
    // TODO: Send to Sentry
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <div>Something went wrong. <button onClick={() => this.setState({ hasError: false })}>Retry</button></div>
    }
    return this.props.children
  }
}

// In App.tsx, wrap each route:
<ErrorBoundary fallback={<ErrorPage />}>
  <Route path="/interview/:id" element={<InterviewPage />} />
</ErrorBoundary>
```

### 7.2 Interview Failure Recovery

If TTS fails mid-interview, show text fallback (never drop the user):
```typescript
try {
  await playTTS(questionText)
} catch (err) {
  console.error('TTS failed, showing text fallback:', err)
  setTextFallbackVisible(true) // Show the question as text
  setCurrentQuestion(questionText)
}
```

---

## 8. Monitoring & Observability

### 8.1 Sentry — Add on Day 1 of Beta

```bash
npm install @sentry/react @sentry/tracing
```

```typescript
// main.tsx
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1, // 10% of transactions
  integrations: [new Sentry.BrowserTracing()],
})
```

### 8.2 Analytics Events — Track Everything

```typescript
// src/lib/analytics.ts
export const track = (event: string, props?: Record<string, unknown>) => {
  // Use PostHog (self-hostable) or Plausible (privacy-first, MENA-friendly)
  window.posthog?.capture(event, props)
}

// Usage:
track('interview_started', { role: jobRole, level: experienceLevel, language: detectedLang })
track('interview_completed', { duration_seconds: elapsed, phase_reached: currentPhase })
track('credit_purchased', { plan: planName, credits: creditAmount, amount_usd: price })
track('report_viewed', { overall_score: score, downloaded: false })
```

### 8.3 Key Dashboards to Build

- **Daily:** interviews started vs. completed (completion rate)
- **Daily:** ElevenLabs credit consumption vs. budget
- **Weekly:** Arabic vs. English session split
- **Weekly:** free → paid conversion funnel
- **Monthly:** cohort retention (D7, D30)

---

## 9. Payment Integration — Stripe

### 9.1 Credit Packages

| Package | Credits | Price (USD) | Price (EGP equiv) | Cost/Interview |
|---------|---------|-------------|-------------------|----------------|
| Starter | 3 | $4.99 | ~150 EGP | $1.66 |
| Pro | 10 | $12.99 | ~400 EGP | $1.30 |
| Power | 25 | $24.99 | ~750 EGP | $1.00 |

### 9.2 Stripe Webhook Flow

```
User clicks Buy → Stripe Checkout session created (server-side)
→ User completes payment
→ Stripe fires `checkout.session.completed` webhook
→ Edge Function `stripe-webhook` receives event
→ Verify Stripe signature: stripe.webhooks.constructEvent(body, sig, secret)
→ Update credits table: balance += credits_purchased
→ Insert into payments table
→ Redirect user to dashboard with success toast
```

### 9.3 Local Payment Option (Egypt/MENA)

For Egyptian users who don't have international cards:
- Integrate **Paymob** (Egypt's leading payment gateway) — supports Fawry, Vodafone Cash, Meeza cards
- Or: **Accept.com** (by Paymob) — simpler API, same coverage
- Add local payment as a toggle on the pricing page: "Pay with Fawry / Vodafone Cash"

---

## 10. PDF Report Export

```typescript
// Use react-pdf (server-side safe) or html2canvas + jsPDF (client-side)
// Recommended: html2canvas + jsPDF for client-side (no server cost)

import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

async function downloadReport(reportElementId: string, interviewId: string) {
  const element = document.getElementById(reportElementId)!
  const canvas = await html2canvas(element, { scale: 2, useCORS: true })
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297)
  pdf.save(`hireready-report-${interviewId}.pdf`)
}
```

---

## 11. Deployment Checklist — Before Going Live

```
SECURITY
[ ] All Edge Functions have JWT verification (verify_jwt = true in config.toml)
[ ] .env is in .gitignore — verify with: git ls-files .env (should return nothing)
[ ] Supabase credentials rotated after any accidental exposure
[ ] CORS restricted to production domain only
[ ] RLS enabled on ALL tables — verify in Supabase dashboard > Auth > Policies
[ ] Rate limiting active on all Edge Functions
[ ] No console.log with sensitive data (userId, tokens) in production

FUNCTIONALITY
[ ] Credit deduction is server-side and atomic (test: start interview with 0 credits)
[ ] IDOR test: User A cannot access User B's report (test with two accounts)
[ ] STT works on Chrome + Safari on iOS
[ ] TTS audio plays on mobile without user gesture errors
[ ] Arabic language detection triggers correct voice
[ ] Error boundaries catch and display gracefully
[ ] PDF download works and includes all 6 dimension scores
[ ] Stripe webhook verified and credits add correctly

PERFORMANCE
[ ] Bundle size < 200KB gzipped (check: npx vite-bundle-visualizer)
[ ] Code splitting active — verify Network tab shows chunked JS
[ ] FCP < 1.5s on 4G simulation (Chrome DevTools Lighthouse)
[ ] Report generation < 10s (time from End Interview to report display)

OPERATIONS
[ ] Sentry DSN configured and test error fires
[ ] Analytics events firing (verify in PostHog/Plausible dashboard)
[ ] Supabase backups enabled (Pro plan includes daily backups)
[ ] Uptime monitor configured (use UptimeRobot free tier)
[ ] ElevenLabs spend alert set at 80% of monthly budget
[ ] Google AI Studio quota alert configured
```

---

## 12. Folder Structure

```
hireready-coach/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn components — do not hand-edit
│   │   ├── interview/       # InterviewRoom, PhaseIndicator, TranscriptPanel
│   │   ├── report/          # ReportCard, RadarChart, DimensionFeedback
│   │   └── ErrorBoundary.tsx
│   ├── hooks/
│   │   ├── useInterview.ts  # Interview state machine
│   │   ├── useCredits.ts    # Credit balance + deduction status
│   │   └── useVoice.ts      # STT + TTS orchestration
│   ├── i18n/
│   │   ├── ar.ts
│   │   └── en.ts
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client (anon key only)
│   │   ├── analytics.ts     # PostHog/Plausible wrapper
│   │   └── utils.ts
│   └── pages/
│       ├── Landing.tsx
│       ├── Dashboard.tsx
│       ├── InterviewSetup.tsx
│       ├── InterviewRoom.tsx
│       └── Report.tsx
├── supabase/
│   ├── functions/
│   │   ├── interview-orchestrator/
│   │   ├── generate-report/
│   │   ├── elevenlabs-tts-stream/
│   │   ├── elevenlabs-scribe-token/
│   │   └── stripe-webhook/
│   ├── migrations/
│   └── config.toml          # verify_jwt = true for all functions
├── .env.example             # document required vars (never commit .env)
└── CLAUDE.md                # this file
```

---

## 13. Environment Variables Reference

```bash
# .env.example — copy to .env and fill in values
# NEVER commit .env to git

# Supabase (client-safe)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...  # safe to expose — protected by RLS

# Monitoring (client-safe)
VITE_SENTRY_DSN=https://...@sentry.io/...
VITE_POSTHOG_KEY=phc_...

# Supabase Edge Function secrets (server-only, stored in Supabase Vault)
GOOGLE_AI_API_KEY=AIza...
ELEVENLABS_API_KEY=sk_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # never expose to client
```

---

## 14. Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Cold start on Edge Function | First interview request takes 5-8s | Add a warmup cron: ping /functions/v1/interview-orchestrator every 5 min |
| ElevenLabs WebSocket token reuse | STT silently fails after 1 use | Tokens are single-use — generate a new one per session start |
| Arabic voice missing | Arabic questions play in English accent | Pass `voice_id` dynamically based on `detectLanguage()` result |
| Credit race condition | Users can start 2 interviews simultaneously | `FOR UPDATE` in SQL function prevents this — verify it's in place |
| iOS Safari AudioContext blocked | TTS plays nothing on iPhone | AudioContext must be resumed in a user gesture handler (mic button tap) |
| Supabase free tier project pausing | App goes offline after 1 week of inactivity | Upgrade to Pro ($25/mo) before beta launch |
| Report missing after page refresh | Interview ended but report not in DB | Edge Function must await report write before returning success |
| JWT expiry mid-interview | API calls fail after 1 hour | Implement token refresh: supabase.auth.onAuthStateChange + re-attach to clients |

---

## 15. Cost Model — Per Interview

| Component | Cost Per Interview | Notes |
|-----------|-------------------|-------|
| Gemini 2.5 Flash (LLM) | $0.005 | ~3K input + 1.5K output tokens |
| ElevenLabs TTS | $0.08 | 8 questions × 120 chars avg |
| ElevenLabs STT (Scribe) | $0.12 | 12 min audio @ $0.01/min |
| Supabase (prorated) | $0.005 | ~5K interviews/mo on $25 plan |
| **Total COGS** | **~$0.21** | Per completed interview |
| **Revenue (Starter pack)** | **$1.66** | $4.99 / 3 credits |
| **Gross margin** | **~87%** | Healthy SaaS margin |

**Path to $1M ARR:**
- At $1.66 average revenue per interview: need ~600,000 interviews/year
- At 3 interviews/user/month: need ~16,700 active paying users
- Realistic: 10% of 167,000 MAU converting to paid = achievable in 18-24 months with strong MENA growth

---

*Last updated: March 2026 — Review quarterly or after any major infrastructure change.*