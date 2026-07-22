
CREATE TABLE model_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES models(id),
  plan_id uuid NOT NULL REFERENCES plans(id),
  provider_model_id text,
  availability availability_status NOT NULL DEFAULT 'unconfirmed',
  access_method access_method NOT NULL,
  authentication_type authentication_type NOT NULL DEFAULT 'other',
  included_in_plan boolean,
  api_compatible boolean,
  cli_only boolean NOT NULL DEFAULT false,
  web_only boolean NOT NULL DEFAULT false,
  oauth_supported boolean,
  priority integer,
  limitations text,
  verified_at timestamptz,
  available_from date,
  available_until date,
  notes text,
  status record_status NOT NULL DEFAULT 'active',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (model_id, plan_id, provider_model_id)
);

CREATE TABLE model_access_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_access_id uuid NOT NULL REFERENCES model_access(id) ON DELETE CASCADE,
  currency char(3) NOT NULL,
  input_per_million numeric(14,6),
  cached_read_per_million numeric(14,6),
  cache_write_per_million numeric(14,6),
  output_per_million numeric(14,6),
  long_input_per_million numeric(14,6),
  long_cached_per_million numeric(14,6),
  long_cache_write_per_million numeric(14,6),
  long_output_per_million numeric(14,6),
  effective_from date,
  effective_to date,
  source_url text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscription_limit_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  name text NOT NULL,
  limit_type text NOT NULL,
  amount_min numeric(16,4),
  amount_max numeric(16,4),
  unit text,
  period_minutes integer,
  reset_strategy text,
  applies_to text,
  included_credit boolean,
  notes text,
  raw_text text,
  status record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE score_methodologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version text NOT NULL,
  description text,
  factors jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, version)
);

CREATE TABLE model_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  methodology_id uuid NOT NULL REFERENCES score_methodologies(id),
  score_type text NOT NULL,
  score_value numeric(8,4),
  rank_value integer,
  eligible_count integer,
  confidence numeric(5,2),
  is_manual_override boolean NOT NULL DEFAULT false,
  override_reason text,
  calculated_at timestamptz NOT NULL,
  source_import_job_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX model_scores_lookup_idx ON model_scores(model_id, score_type, calculated_at DESC);
