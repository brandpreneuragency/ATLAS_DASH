-- Explicit durable ownership for Model Monitor baseline seed rows.
-- Additive only. Unrelated workbook/import/manual evidence remains unowned (seed_key NULL).

ALTER TABLE model_benchmark_results
  ADD COLUMN IF NOT EXISTS seed_key text;

ALTER TABLE usage_snapshots
  ADD COLUMN IF NOT EXISTS seed_key text;

CREATE UNIQUE INDEX IF NOT EXISTS model_benchmark_results_seed_key_uidx
  ON model_benchmark_results (seed_key)
  WHERE seed_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS usage_snapshots_seed_key_uidx
  ON usage_snapshots (seed_key)
  WHERE seed_key IS NOT NULL;
