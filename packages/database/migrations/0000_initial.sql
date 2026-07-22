-- Model Monitor — Initial migration
-- Generated from contracts/postgresql-schema.sql
-- This is a hand-written migration preserving the full SQL contract.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE record_status AS ENUM ('active','archived');
CREATE TYPE subscription_status AS ENUM ('active','paused','cancelled','expired','trial','archived');
CREATE TYPE lifecycle_status AS ENUM ('current','ga','preview','beta','legacy','deprecated','retired','unavailable','unknown');
CREATE TYPE availability_status AS ENUM ('confirmed','unconfirmed','unavailable','removed');
CREATE TYPE access_method AS ENUM ('oauth','provider_api','direct_api','cli','consumer_app','web','self_hosted','other');
CREATE TYPE authentication_type AS ENUM ('oauth_subscription','api_key','consumer_subscription','cli_session','none','other');
CREATE TYPE api_access_type AS ENUM ('included','separate_billing','restricted_provider_api','none_included','none','unknown');
CREATE TYPE usage_tracking_mode AS ENUM ('manual','mock','estimated','provider_reported','hybrid');
CREATE TYPE source_type AS ENUM ('official_docs','official_model_card','official_pricing','benchmark_report','vendor_blog','third_party','workbook','manual','other');
CREATE TYPE audit_action AS ENUM ('create','update','archive','restore','merge','import','export','token_create','token_revoke','settings_change','delete');
CREATE TYPE import_status AS ENUM ('uploaded','parsing','preview_ready','needs_resolution','committing','committed','failed','cancelled');
CREATE TYPE usage_source AS ENUM ('mock','manual','estimated','provider_reported');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE developers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  website_url text,
  notes text,
  status record_status NOT NULL DEFAULT 'active',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE access_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  provider_type text,
  website_url text,
  notes text,
  status record_status NOT NULL DEFAULT 'active',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_provider_id uuid NOT NULL REFERENCES access_providers(id),
  name text NOT NULL,
  slug text NOT NULL,
  plan_type text,
  regular_price numeric(12,4),
  introductory_price numeric(12,4),
  currency char(3),
  billing_interval text,
  api_access_type api_access_type NOT NULL DEFAULT 'unknown',
  authentication_type authentication_type NOT NULL DEFAULT 'other',
  usage_measurement_type text,
  terms_summary text,
  status record_status NOT NULL DEFAULT 'active',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(access_provider_id, slug)
);
