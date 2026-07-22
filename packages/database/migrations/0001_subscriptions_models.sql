
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id),
  plan_id uuid NOT NULL REFERENCES plans(id),
  external_seed_id text UNIQUE,
  account_label text NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  started_at date,
  next_billing_date date,
  cancelled_at date,
  auto_renews boolean,
  actual_price numeric(12,4),
  currency char(3),
  billing_interval text,
  usage_tracking_mode usage_tracking_mode NOT NULL DEFAULT 'manual',
  usage_check_url text,
  usage_check_instructions text,
  importance smallint CHECK (importance BETWEEN 1 AND 5),
  notes text,
  private_notes text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL REFERENCES developers(id),
  canonical_id text NOT NULL UNIQUE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  family text,
  generation text,
  lifecycle lifecycle_status NOT NULL DEFAULT 'unknown',
  lifecycle_raw text,
  release_date date,
  knowledge_cutoff text,
  model_type text,
  description text,
  coding_specialization text,
  best_use text,
  avoid_for text,
  context_tokens bigint,
  max_output_tokens bigint,
  speed_rating text,
  verified_tps numeric(12,3),
  verification_status text,
  verified_at timestamptz,
  needs_recheck boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status record_status NOT NULL DEFAULT 'active',
  archived_at timestamptz,
  merged_into_model_id uuid REFERENCES models(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE model_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text NOT NULL UNIQUE,
  alias_type text NOT NULL,
  access_provider_id uuid REFERENCES access_providers(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE model_capabilities (
  model_id uuid PRIMARY KEY REFERENCES models(id) ON DELETE CASCADE,
  vision boolean,
  reasoning boolean,
  tool_use boolean,
  parallel_agents boolean,
  computer_use boolean,
  audio_input boolean,
  video_input boolean,
  image_input boolean,
  structured_output boolean,
  function_calling boolean,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
