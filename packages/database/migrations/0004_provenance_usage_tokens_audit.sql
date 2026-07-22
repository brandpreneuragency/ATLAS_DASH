
CREATE TABLE import_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  source_sheet text,
  source_row integer,
  source_column text,
  raw_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX import_provenance_entity_idx ON import_provenance(entity_type, entity_id);

CREATE TABLE usage_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  model_id uuid REFERENCES models(id),
  source usage_source NOT NULL,
  is_mock boolean NOT NULL DEFAULT false,
  period_label text,
  period_start timestamptz,
  period_end timestamptz,
  used_amount numeric(18,6),
  remaining_amount numeric(18,6),
  total_amount numeric(18,6),
  unit text,
  used_percent numeric(6,3),
  confidence numeric(5,2),
  raw_payload jsonb,
  captured_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_snapshots_subscription_idx ON usage_snapshots(subscription_id, captured_at DESC);

CREATE TABLE api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  token_prefix text NOT NULL UNIQUE,
  token_hash text NOT NULL,
  scopes text[] NOT NULL,
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id),
  actor_token_id uuid REFERENCES api_tokens(id),
  entity_type text NOT NULL,
  entity_id uuid,
  action audit_action NOT NULL,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  request_id text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_entity_idx ON audit_events(entity_type, entity_id, created_at DESC);
CREATE INDEX audit_events_created_idx ON audit_events(created_at DESC);

CREATE TABLE app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add deferred foreign keys
ALTER TABLE model_scores
  ADD CONSTRAINT model_scores_import_job_fk
  FOREIGN KEY (source_import_job_id) REFERENCES import_jobs(id);

ALTER TABLE model_benchmark_results
  ADD CONSTRAINT model_benchmark_results_import_job_fk
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id);

ALTER TABLE sources
  ADD CONSTRAINT sources_import_job_fk
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id);
