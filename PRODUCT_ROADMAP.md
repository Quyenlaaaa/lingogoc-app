# LingoGoc Product Roadmap

Long-term product direction only. Execution status belongs in
`PRODUCTION_COMPLETION_PLAN.md`.

## Vision

Build a low-friction English-learning product for Vietnamese beginners, busy learners,
and people who hesitate to speak. Sessions should fit into 10–15 minutes, turn each
word or sentence pattern into usable speech, and provide patient, non-judgmental AI
coaching.

## Phases

### Phase 1 — Core foundation

- Responsive React/Vite web app and GitHub Pages delivery.
- 3,000-word system catalog, IPA, Vietnamese meanings, and examples.
- Flashcards, catalog, quiz, IPA, reflex, speaking, and Web Speech support.
- Kotlin Android shell with bundled offline web assets and native TTS/STT bridge.

Production completion and data quality remain governed by the execution plan; a
feature existing in code does not automatically mean it is production-complete.

### Phase 2 — Personalization and learning quality

- Ten-minute listening/vocabulary/speaking diagnostic.
- Personalized starting point and learning path.
- Durable AI speaking sessions and structured feedback.
- FSRS or SM-2 spaced repetition based on real learning events.
- Unified XP, streak, progress, and review scheduling.

### Phase 3 — Accounts, cross-device use, and native release

- Guest-first accounts with optional email/Google synchronization.
- Offline event queue and conflict-safe cross-device sync.
- Versioned offline Android catalog and differential updates.
- Signed AAB/APK, Play internal testing, crash reporting, and privacy policy.

### Phase 4 — Real community and commerce

- Realtime PvP and server-backed weekly leaderboard with anti-cheat controls.
- Server-verifiable certificates.
- Server-created orders and verified VietQR/MoMo/VNPAY webhooks.
- Only verified payment events may activate paid access.
- B2B progress dashboard after consumer learning quality is proven.

## Target architecture

```text
Web / Android
      |
Cloudflare CDN + Worker
      |
      +-- D1 durable product data
      +-- KV and Edge Cache for fast reads
      +-- background queues/cron
      +-- health-ranked AI providers
      +-- object storage for approved media when needed
```

## Product principles

- Guest-first learning; login is optional until synchronization is useful.
- Vietnamese scaffolding, natural English output, and accessible mobile interaction.
- Cache/database before AI; idempotent jobs; no duplicate token spending.
- Durable data before community, certificates, or payments.
- Never present simulations or local-only state as verified server behavior.

## Long-term KPIs

- D1 retention >50%, D7 >30%, D30 >18%.
- Average speaking practice ≥12 minutes/day.
- ≥65% of new learners complete one speaking exercise.
- Average pronunciation improvement ≥25% after 14 days.
- Average first-month vocabulary mastery: 100 words.
- Free-to-paid conversion target ≥3.5%, only after real payment infrastructure.
- NPS target ≥70.
