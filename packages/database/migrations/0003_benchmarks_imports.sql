
CREATE TABLE benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  version text,
  comparable_group text,
  score_unit text,
  higher_is_better boolean,
  description text,
  status record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, version, comparable_group)
);

CREATE TABLE model_benchmark_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  benchmark_id uuid NOT NULL REFERENCES benchmarks(id),
  setting text,
  harness text,
  score numeric(16,6),
  score_text text,
  result_date date,
  confidence numeric(5,2),
  source_type source_type,
  source_url text,
  notes text,
  verified_at timestamptz,
  import_job_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX benchmark_results_model_idx ON model_benchmark_results(model_id);
CREATE INDEX benchmark_results_benchmark_idx ON model_benchmark_results(benchmark_id);

CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  source_type source_type NOT NULL,
  url text,
  title text,
  publisher text,
  retrieved_at timestamptz,
  verified_at timestamptz,
  notes text,
  import_job_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sources_entity_idx ON sources(entity_type, entity_id);

CREATE TABLE import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  filename text NOT NULL,
  stored_path text NOT NULL,
  sha256 text NOT NULL,
  parser_version text NOT NULL,
  status import_status NOT NULL DEFAULT 'uploaded',
  sheet_summary jsonb,
  preview_summary jsonb,
  commit_summary jsonb,
  error_summary jsonb,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz,
  UNIQUE(sha256, parser_version, idempotency_key)
);

CREATE TABLE import_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  conflict_type text NOT NULL,
  source_sheet text,
  source_row integer,
  source_column text,
  entity_type text,
  candidate_entity_id uuid,
  current_value jsonb,
  imported_value jsonb,
  resolution text,
  resolution_payload jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
