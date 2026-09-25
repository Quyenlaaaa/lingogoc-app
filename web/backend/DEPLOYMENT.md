# Worker deployment and rollback

## Required GitHub environment secrets

Create the `production` environment and add:

- `CLOUDFLARE_API_TOKEN`: token limited to Workers Scripts edit/read for the
  LingoGoc account.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID.

Without both values, validation still runs and the deploy job reports a warning
instead of modifying production.

## Security operations

- Configure Cloudflare WAF/rate-limiting rules for AI POST routes and protected admin
  routes. The Worker limiter is a per-isolate safety net, not a globally consistent
  quota or bot-defense system.
- Keep `ALLOWED_ORIGINS` explicit. Do not use `*` in staging or production.
- Rotate `XTROUTER_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, and
  `ADMIN_API_KEY` one at a time: create the replacement at the provider, update the
  Worker secret, deploy and smoke-test, then revoke the former credential.
- Rotate immediately after suspected disclosure and inspect provider usage plus Worker
  error/latency metrics. Never place replacement values in GitHub logs or plan files.
- Review API and GitHub deployment tokens quarterly and keep them scoped to the one
  account/project and minimum edit permissions.

## Release gate

The Worker workflow runs lint, feature registry, vocabulary quality, mobile
speech, Worker contract and production build. After deploy it runs
`npm run smoke:production`. The smoke word must already have five examples in
durable cache, so this check never intentionally generates new AI content.

Analytics Engine is optional and currently commented out in `wrangler.toml` so an
account without that product enabled can still deploy. Enable Analytics Engine in the
Cloudflare account, uncomment the `METRICS` dataset binding, deploy, and then verify
provider/cache events. Metrics contain route/status, provider/model, latency, and token
counts, never prompts or keys. Without the binding, `/api/operations/status` still
reports isolate-local counters.

### Analytics Engine schema

Provider rows use this layout:

- `index1`: provider (`XKIRO_FREE`, `XKIRO_PAID`, `GROQ_FREE`, and so on)
- `blob1`: `success` or `failure`; `blob2`: model
- `double1`: latency ms; `double2`: prompt tokens; `double3`: completion tokens
- `double4`: total tokens; `double5`: estimated cost in USD

Cache rows use `index1 = 'CACHE'`, with route/cache status in `blob1`/`blob2`, hit
as `double1` (0 or 1), and request latency ms as `double2`.

Cost is zero unless `AI_PAID_INPUT_USD_PER_MILLION` and
`AI_PAID_OUTPUT_USD_PER_MILLION` contain the paid provider's current rates. Review
those variables whenever the provider or model price changes.

### 24-hour provider KPI query

Analytics Engine can sample high-volume data. Keep `_sample_interval` in counts,
sums, averages, and quantiles:

```sql
SELECT
  index1 AS provider,
  blob2 AS model,
  SUM(_sample_interval) AS calls,
  SUMIF(_sample_interval, blob1 = 'success') / SUM(_sample_interval) AS success_rate,
  quantileExactWeighted(0.50)(double1, _sample_interval) AS latency_p50_ms,
  quantileExactWeighted(0.95)(double1, _sample_interval) AS latency_p95_ms,
  SUM(_sample_interval * double2) AS prompt_tokens,
  SUM(_sample_interval * double3) AS completion_tokens,
  SUM(_sample_interval * double5) AS estimated_cost_usd
FROM lingogoc_worker_metrics
WHERE timestamp > NOW() - INTERVAL '1' DAY AND index1 != 'CACHE'
GROUP BY provider, model
ORDER BY calls DESC
```

### 24-hour cache KPI query

```sql
SELECT
  blob1 AS route,
  SUM(_sample_interval) AS requests,
  SUM(_sample_interval * double1) / SUM(_sample_interval) AS hit_rate,
  quantileExactWeighted(0.50)(double2, _sample_interval) AS latency_p50_ms,
  quantileExactWeighted(0.95)(double2, _sample_interval) AS latency_p95_ms
FROM lingogoc_worker_metrics
WHERE timestamp > NOW() - INTERVAL '1' DAY AND index1 = 'CACHE'
GROUP BY route
ORDER BY requests DESC
```

Run either query through Cloudflare's Analytics Engine SQL API:

```powershell
$headers = @{ Authorization = "Bearer $env:CLOUDFLARE_API_TOKEN" }
$sql = Get-Content -Raw .\query.sql
Invoke-RestMethod `
  -Uri "https://api.cloudflare.com/client/v4/accounts/$env:CLOUDFLARE_ACCOUNT_ID/analytics_engine/sql" `
  -Method Post -Headers $headers -Body $sql
```

Do not put the API token in the SQL file, shell history, repository, or screenshots.

## Rollback

1. Open Cloudflare Dashboard → Workers & Pages → `lingogoc-api` → Deployments.
2. Select the last known-good version and choose Rollback.
3. Run `npm run smoke:production` from `web`.
4. Record the restored version and reason in `PRODUCTION_COMPLETION_PLAN.md`.

Do not roll back the catalog KV namespace. Catalog/data migrations require a
separate, reviewed recovery procedure.

## Staging prerequisite

A staging Worker must use a separate KV namespace and separate AI budget. Do not
point staging at production KV. Until `CLOUDFLARE_STAGING_KV_NAMESPACE_ID` and a
staging Worker environment exist, staging deploy remains intentionally disabled.

If D1 is enabled, staging and production must also use different databases bound as
`VOCAB_DB`. Apply all migrations in order before deploying code with the binding:
`0001_vocabulary_durable_store.sql`, then `0002_vocabulary_admin_audit.sql`.
Deploying without the binding is safe and keeps the KV-only path; adding the binding
without applying migrations causes logged D1 errors and falls back to KV, but must
still be treated as a failed release gate.
