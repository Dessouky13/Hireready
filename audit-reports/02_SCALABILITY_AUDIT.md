# 02 — SCALABILITY AUDIT

**Project:** HireReady Coach (hire-ready-coach)
**Auditor:** Seekers AI Agency — Automated Architecture Review
**Date:** March 19, 2026
**Current Stage:** Proof of Concept (POC)
**Target:** 100,000 users — $1M ARR

---

## 2.1 CURRENT ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER (Browser)                                    │
│  React 18 + Vite 5 + Tailwind CSS + shadcn/ui                          │
│  ┌───────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │ Landing   │ │  Auth (Login │ │  Dashboard   │ │  Live Interview  │  │
│  │ Page      │ │  / Signup)   │ │  + Reports   │ │  (Voice + STT)   │  │
│  └─────┬─────┘ └──────┬───────┘ └──────┬───────┘ └────────┬─────────┘  │
│        │               │               │                   │            │
│        │       Supabase Auth     REST API (anon key)       │            │
└────────┼───────────────┼───────────────┼───────────────────┼────────────┘
         │               │               │                   │
         ▼               ▼               ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     SUPABASE PLATFORM                                    │
│                                                                          │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │   Auth       │  │   PostgreSQL DB  │  │   Storage (CVs bucket)   │  │
│  │  (GoTrue)    │  │                  │  │                           │  │
│  │  Email +     │  │  Tables:         │  │  - Private bucket         │  │
│  │  Google      │  │  - profiles      │  │  - RLS on objects         │  │
│  │  OAuth       │  │  - credits       │  │                           │  │
│  └──────────────┘  │  - interviews    │  └───────────────────────────┘  │
│                     │  - messages      │                                  │
│                     │  - reports       │  ┌───────────────────────────┐  │
│                     │  - payments      │  │   Edge Functions (Deno)   │  │
│                     │  - promo_codes   │  │                           │  │
│                     │  - referral_     │  │  1. interview-orchestrator│  │
│                     │    signups       │  │  2. generate-report       │  │
│                     │  - interview_    │  │  3. elevenlabs-token      │  │
│                     │    state         │  │  4. elevenlabs-tts-stream │  │
│                     └──────────────────┘  │  5. elevenlabs-scribe-    │  │
│                                           │     token                 │  │
│                                           └──────────┬────────────────┘  │
└──────────────────────────────────────────────────────┼───────────────────┘
                                                       │
                          ┌────────────────────────────┼────────┐
                          │                            │        │
                          ▼                            ▼        ▼
                   ┌──────────────┐         ┌───────────────────────┐
                   │ Lovable AI   │         │     ElevenLabs API    │
                   │ Gateway      │         │                       │
                   │              │         │  - Scribe (STT)       │
                   │ Model:       │         │  - TTS Streaming      │
                   │ gemini-3-    │         │  - Conversational AI  │
                   │ flash-preview│         │    Token (WebRTC)     │
                   └──────────────┘         └───────────────────────┘
```

### Data Flow:
1. **User signs up** → Supabase Auth → Trigger creates `profiles` + `credits` rows → Redirect to Dashboard
2. **User starts interview** → Client deducts credit → Creates `interviews` row → Navigates to LiveInterview
3. **Live interview** → ElevenLabs Scribe (STT) captures speech → Frontend sends text to `interview-orchestrator` → Orchestrator calls Lovable AI → Returns question → Frontend calls `elevenlabs-tts-stream` → Plays audio
4. **Interview ends** → Client updates interview status → Calls `generate-report` → AI analyzes transcript → Saves report → Report page polls for data

---

## 2.2 PERFORMANCE BOTTLENECKS

### BOTTLENECK-01 — Sequential AI + TTS Round-Trip Per Question

- **Component:** `interview-orchestrator` → TTS pipeline in `src/pages/interview/LiveInterview.tsx` (Lines 130–180)
- **Why it breaks:** Each interview turn requires:
  1. Network call to `interview-orchestrator` (Edge Function)
  2. Orchestrator loads interview, state, messages from DB (3 queries)
  3. Orchestrator calls Lovable AI gateway (~1–5s latency)
  4. Response saved to DB
  5. Frontend calls `elevenlabs-tts-stream` with the text
  6. TTS streams audio back (~1–3s)
  
  **Total latency per turn: 3–10 seconds.** At scale, Lovable AI and ElevenLabs API calls will be the bottleneck.
- **Impact:** Users experience awkward silences between answer and next question. Feels unnatural.
- **Breaks at:** ~50 concurrent interviews (Lovable/ElevenLabs rate limits)
- **Fix:**
  1. **Pre-generate next question** while user is still speaking (speculative execution)
  2. **Stream TTS** — already using streaming response, but decode/playback could overlap with AI call
  3. **Cache common opening questions** — the first question is always a greeting; pre-cache it
  4. **Use WebSocket** for orchestrator instead of HTTP POST to reduce connection overhead

---

### BOTTLENECK-02 — Full Message History Loaded Per Turn

- **Component:** `supabase/functions/interview-orchestrator/index.ts` (Lines 78–84)
- **Why it breaks:** Every orchestrator call loads ALL messages for the interview:
  ```typescript
  const { data: messages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("interview_id", interviewId)
    .order("created_at", { ascending: true });
  ```
  For a 15-minute interview with ~20 turns, this is 20+ messages loaded on every call. The entire history is then sent to the AI API.
- **Impact:** Token costs increase linearly. At 20 turns × ~200 tokens/message = 4,000 tokens of context per call.
- **Breaks at:** Long interviews or if interview length is extended.
- **Fix:**
  1. Use a sliding window of last 8–10 messages instead of full history
  2. Summarize earlier messages into a condensed context
  3. Store a running summary in `interview_state`

---

### BOTTLENECK-03 — No Database Indexes Beyond Primary Keys

- **Component:** All Supabase migrations
- **Why it breaks:** The following columns are used in WHERE/ORDER BY clauses but have no indexes:

| Table | Column | Query Pattern | Impact |
|-------|--------|--------------|--------|
| `credits` | `user_id` | `eq("user_id", ...)` | Full table scan per credit lookup |
| `interviews` | `user_id` | `eq("user_id", ...).order("created_at")` | Slow dashboard load |
| `interviews` | `status` | Filtered in client code | Potential slow filter |
| `messages` | `interview_id` | `eq("interview_id", ...).order("created_at")` | Full scan per orchestrator call |
| `messages` | `created_at` | `order("created_at")` | Sort without index |
| `reports` | `interview_id` | `eq("interview_id", ...)` | Slow report lookup |
| `reports` | `user_id` | `eq("user_id", ...)` | Slow dashboard load |
| `interview_state` | `interview_id` | `eq("interview_id", ...)` | Already UNIQUE (has index) ✅ |
| `referral_signups` | `user_id` | `eq("user_id", ...)` | Slow referral lookup |
| `promo_codes` | `code` | `eq("code", ...)` | Already UNIQUE (has index) ✅ |

- **Fix:** Add these indexes in a new migration:
  ```sql
  CREATE INDEX idx_credits_user_id ON public.credits(user_id);
  CREATE INDEX idx_interviews_user_id_created ON public.interviews(user_id, created_at DESC);
  CREATE INDEX idx_messages_interview_created ON public.messages(interview_id, created_at ASC);
  CREATE INDEX idx_reports_interview_id ON public.reports(interview_id);
  CREATE INDEX idx_reports_user_id ON public.reports(user_id);
  CREATE INDEX idx_referral_signups_user_id ON public.referral_signups(user_id);
  ```

---

### BOTTLENECK-04 — Dashboard Loads All Data in 3 Sequential Queries

- **Component:** `src/pages/Dashboard.tsx` (Lines 35–68)
- **Why it breaks:** The Dashboard executes 3 sequential Supabase queries in a single `useEffect`:
  1. Fetch credits
  2. Fetch ALL interviews (no pagination)
  3. Fetch ALL reports
  
  No `Promise.all()` parallelization.
- **Impact:** Dashboard load time = sum of all 3 queries. With 100+ interviews, data transfer grows linearly.
- **Breaks at:** ~100 interviews per user
- **Fix:**
  1. Parallelize queries with `Promise.all()`
  2. Add pagination (limit 10, load more on scroll)
  3. Use React Query caching (already have `@tanstack/react-query` installed but NOT used anywhere in the app)
  ```typescript
  // Before:
  const { data: creditData } = await supabase.from("credits")...;
  const { data: interviewData } = await supabase.from("interviews")...;
  const { data: reportData } = await supabase.from("reports")...;

  // After:
  const [creditRes, interviewRes, reportRes] = await Promise.all([
    supabase.from("credits").select("balance").eq("user_id", user.id).single(),
    supabase.from("interviews").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("reports").select("interview_id, overall_score, conf_score, clarity_score, struct_score, comm_score").eq("user_id", user.id),
  ]);
  ```

---

### BOTTLENECK-05 — React Query Installed but Never Used

- **Component:** `package.json` — `@tanstack/react-query: ^5.83.0`, `src/App.tsx` (Line 4)
- **Why it breaks:** `QueryClientProvider` is set up in `App.tsx` but **no component uses `useQuery`, `useMutation`, or any React Query hooks**. All data fetching is manual `useEffect` + `useState` with no caching, deduplication, or background refetching.
- **Impact:** Every navigation to Dashboard re-fetches all data. No optimistic updates. No cache.
- **Fix:** Migrate all Supabase queries to React Query hooks:
  ```typescript
  const { data: credits, isLoading } = useQuery({
    queryKey: ["credits", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("credits").select("balance").eq("user_id", user.id).single();
      return data?.balance ?? 0;
    },
    staleTime: 30_000, // 30 seconds
  });
  ```

---

### BOTTLENECK-06 — Large Bundle Size (Unused UI Components)

- **Component:** `src/components/ui/` — 45+ shadcn/ui component files
- **Why it breaks:** The project includes ~45 shadcn/ui component files, but the application only uses a fraction of them. Used components: `button`, `input`, `label`, `tooltip`, `toast`, `toaster`, `sonner`, `progress`, `card`. Unused: `accordion`, `alert-dialog`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `calendar`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `form`, `hover-card`, `input-otp`, `menubar`, `navigation-menu`, `pagination`, `popover`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `switch`, `table`, `tabs`, `textarea`, `toggle`, `toggle-group`.
- **Impact:** Vite tree-shakes unused components, so bundle impact is minimal. But the codebase is cluttered, making maintenance harder.
- **Fix:** Remove unused component files:
  ```bash
  # Keep only what's imported in the application
  # Remove all others from src/components/ui/
  ```

---

### BOTTLENECK-07 — No Pagination on Interview List

- **Component:** `src/pages/Dashboard.tsx` (Lines 43–50)
- **Why it breaks:** All interviews are fetched with no `.limit()`:
  ```typescript
  const { data: interviewData } = await supabase
    .from("interviews")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  ```
- **Breaks at:** 50+ interviews — slower load, more data transfer
- **Fix:** Add `.limit(20)` and implement "Load More" or infinite scroll pagination.

---

### BOTTLENECK-08 — Report Polling (30 Retries × 2s = 60s Max Wait)

- **Component:** `src/pages/Report.tsx` (Lines 42–70)
- **Why it breaks:** The Report page polls for data every 2 seconds, up to 30 times:
  ```typescript
  let attempts = 0;
  const maxAttempts = 30;
  // ... poll every 2 seconds
  setTimeout(poll, 2000);
  ```
  Each poll is a Supabase query. With 100 concurrent users finishing interviews simultaneously, that's 100 × 15 polls = 1,500 queries in 30 seconds.
- **Fix:** Use Supabase Realtime subscriptions instead of polling:
  ```typescript
  const channel = supabase
    .channel(`report-${id}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'reports',
      filter: `interview_id=eq.${id}`,
    }, (payload) => {
      setReport(payload.new);
      setLoading(false);
    })
    .subscribe();
  ```

---

### BOTTLENECK-09 — No React.memo or Memoization

- **Component:** Multiple components
- **Why it breaks:** No `React.memo`, `useMemo`, or `useCallback` optimizations anywhere except in `LiveInterview.tsx` (which correctly uses `useCallback`). The Dashboard and Report pages re-render all child components on any state change.
- **Impact:** Minor at current scale, but becomes noticeable with complex component trees.
- **Fix:** Add `React.memo` to pure presentational components like `DownloadShareCard`, `ShareResults`, `VoiceVisualizer`.

---

## 2.3 DATABASE SCHEMA REVIEW

### Tables Identified

| # | Table | Rows (est.) at 10K users | Purpose | Issues |
|---|-------|-------------------------|---------|--------|
| 1 | `profiles` | 10K | User profile data | Missing: timezone, language preference, country |
| 2 | `credits` | 10K | User credit balance | CRITICAL: Client can modify balance via RLS |
| 3 | `interviews` | 50K (5/user avg) | Interview sessions | No index on user_id. No soft-delete. |
| 4 | `messages` | 500K (10 msg/interview) | Interview transcripts | No index on interview_id. Will be largest table. |
| 5 | `reports` | 50K | AI-generated reports | No index on user_id or interview_id |
| 6 | `payments` | 20K | Payment records | Stripe integration not built. Schema only. |
| 7 | `promo_codes` | 100 | Referral promo codes | Good — has unique index on `code` |
| 8 | `referral_signups` | 5K | Tracks referral signups | No index on user_id |
| 9 | `interview_state` | 50K | Per-interview AI state | Good — has unique index on `interview_id` |

### Relationships

```
auth.users (1) ──→ (1) profiles
auth.users (1) ──→ (1) credits
auth.users (1) ──→ (N) interviews
auth.users (1) ──→ (N) reports
auth.users (1) ──→ (N) payments
interviews (1) ──→ (N) messages
interviews (1) ──→ (1) interview_state
interviews (1) ──→ (N) reports
promo_codes (1) ──→ (N) referral_signups
```

### Missing Indexes (Critical for Scale)

```sql
-- MUST ADD (see BOTTLENECK-03):
CREATE INDEX idx_credits_user_id ON public.credits(user_id);
CREATE INDEX idx_interviews_user_id_created ON public.interviews(user_id, created_at DESC);
CREATE INDEX idx_messages_interview_created ON public.messages(interview_id, created_at ASC);
CREATE INDEX idx_reports_interview_id ON public.reports(interview_id);
CREATE INDEX idx_reports_user_id ON public.reports(user_id);
CREATE INDEX idx_referral_signups_user_id ON public.referral_signups(user_id);
```

### Schema Improvements for Scale

1. **Add `subscription` table** for recurring billing
2. **Add `usage_tracking` table** for AI API cost monitoring per user
3. **Partition `messages` table** by month once it exceeds 1M rows
4. **Add `language` column to `profiles`** for Arabic/English preference
5. **Add soft-delete** (`deleted_at` column) to interviews and reports for data recovery
6. **Add `duration_seconds` to `interviews`** — currently only computed from `created_at` and `ended_at`

---

## 2.4 SCALABILITY TIERS

| Tier | Users | Architecture Changes Needed | Monthly Cost Est. (USD) |
|------|-------|-----------------------------|:-----------------------:|
| **POC** | 0–100 | Current setup (Supabase Free, pay-as-you-go AI) | $0–50 |
| **Startup** | 100–1,000 | Supabase Pro ($25/mo), add DB indexes, add rate limiting, fix security issues, add Redis cache for sessions | $200–500 |
| **Growth** | 1K–10K | Supabase Pro + compute add-ons, CDN (Cloudflare Free→Pro), queue for async report generation, move to dedicated AI API keys with higher limits, add Sentry monitoring | $1,000–3,000 |
| **Scale** | 10K–100K | Supabase Team ($599/mo) or self-host with Supabase, PgBouncer connection pooling, Redis for semantic caching of common AI responses, read replicas, message table partitioning, move TTS to batch processing queue | $5,000–15,000 |
| **Enterprise** | 100K+ | Multi-region deployment, Kubernetes for Edge Functions, dedicated PostgreSQL cluster, Elasticsearch for message search, CDN + edge workers, custom AI model fine-tuning, SOC2 compliance | $20,000–50,000 |

---

## 2.5 AI/LLM COST PROJECTION

### Assumptions

| Metric | Value | Source |
|--------|-------|--------|
| Average sessions/user/month | 3 | POC assumption |
| Average question turns/session | 12 | Based on PHASE_QUESTIONS config (9–14 range, using midpoint) |
| Tokens per orchestrator call (input) | ~2,000 | System prompt (~800) + history (~1,200) |
| Tokens per orchestrator call (output) | ~200 | Question + tool call JSON |
| Tokens per report generation (input) | ~4,000 | System prompt + full transcript |
| Tokens per report generation (output) | ~1,000 | Structured report JSON |
| ElevenLabs TTS chars per turn | ~200 | Average question length |
| ElevenLabs STT realtime per session | 15 min | Full session duration |

### Cost Per Session (Single Interview)

| Service | Usage | Est. Cost |
|---------|-------|-----------|
| Lovable AI (Gemini Flash) — Orchestrator | 12 turns × 2,200 tokens = 26,400 input + 2,400 output | ~$0.003 |
| Lovable AI (Gemini Flash) — Report | 1 call × 4,000 input + 1,000 output | ~$0.001 |
| ElevenLabs TTS | 12 turns × 200 chars = 2,400 chars | ~$0.02 |
| ElevenLabs STT (Scribe) | 15 min realtime | ~$0.05 |
| **Total per session** | | **~$0.074** |

### Monthly Cost Projection

| Tier | Users | Sessions/mo | AI Cost/mo | ElevenLabs Cost/mo | Total AI Cost/mo |
|------|-------|:-----------:|:----------:|:------------------:|:----------------:|
| POC | 100 | 300 | $1.20 | $21.00 | **$22** |
| Startup | 1,000 | 3,000 | $12.00 | $210.00 | **$222** |
| Growth | 10,000 | 30,000 | $120.00 | $2,100.00 | **$2,220** |
| Scale | 50,000 | 150,000 | $600.00 | $10,500.00 | **$11,100** |
| Enterprise | 100,000 | 300,000 | $1,200.00 | $21,000.00 | **$22,200** |

### 🔴 Burn Risk Alert

**ElevenLabs is the dominant cost driver** at ~95% of AI costs. At 100K users, TTS + STT alone costs ~$21K/month. This must be addressed:

1. **Switch STT to Whisper API** ($0.006/min) — saves ~70% on STT costs
2. **Cache common greetings/closings** — save 2–3 TTS calls per session
3. **Batch TTS** — pre-render common phrases
4. **Offer text-only mode** as a cheaper tier — no TTS/STT costs
5. **Implement per-user session time limits** — enforce 15-min cap server-side

---

## 2.6 SCALABILITY SCORE

| Category | Current Score (0-10) | Target Score (for Production) | Gap |
|----------|:-------------------:|:----------------------------:|:---:|
| **Database Indexing** | 3 | 8 | 5 |
| **Query Optimization** | 3 | 7 | 4 |
| **Caching Strategy** | 0 | 7 | 7 |
| **API Rate Limiting** | 0 | 8 | 8 |
| **AI Cost Efficiency** | 4 | 7 | 3 |
| **Frontend Performance** | 5 | 8 | 3 |
| **Async Processing** | 2 | 7 | 5 |
| **Monitoring/Observability** | 0 | 8 | 8 |
| **Connection Pooling** | 3 | 7 | 4 |
| **CDN/Static Assets** | 2 | 8 | 6 |
| **OVERALL** | **2.2/10** | **7.5/10** | **5.3** |

**Verdict:** The current architecture can handle ~50 concurrent users at most. Significant work is needed on indexing, caching, rate limiting, and monitoring to support the growth path to 100K users.
