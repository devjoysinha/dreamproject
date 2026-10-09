CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  bio TEXT,
  profile_image_url TEXT,
  summary_display TEXT,
  profile_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_model_url TEXT NOT NULL UNIQUE,
  source_query TEXT,
  source_retrieved_at TIMESTAMPTZ,
  source_schema_version INTEGER,
  source_complete BOOLEAN NOT NULL DEFAULT FALSE,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS model_tags (
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  source_url TEXT,
  PRIMARY KEY (model_id, code)
);

CREATE TABLE IF NOT EXISTS media_items (
  content_id TEXT PRIMARY KEY,
  short_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  relative_age TEXT,
  is_trending BOOLEAN NOT NULL DEFAULT FALSE,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  media_type TEXT,
  image_url TEXT,
  size_bytes BIGINT,
  size_display TEXT,
  image_count INTEGER NOT NULL DEFAULT 0,
  video_count INTEGER NOT NULL DEFAULT 0,
  mega_url TEXT,
  status TEXT,
  resolution_attempts INTEGER NOT NULL DEFAULT 0,
  last_resolution_attempt_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE media_items ADD COLUMN IF NOT EXISTS resolution_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS last_resolution_attempt_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS model_open_links (
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL REFERENCES media_items(content_id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  PRIMARY KEY (model_id, content_id),
  UNIQUE (model_id, position)
);

CREATE TABLE IF NOT EXISTS ingest_runs (
  id TEXT PRIMARY KEY,
  source_directory TEXT NOT NULL,
  models_seen INTEGER NOT NULL DEFAULT 0,
  media_records_seen INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'plus', 'ultra')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_identities (
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_at_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, provider_subject)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE INDEX IF NOT EXISTS oauth_identities_user_idx ON oauth_identities (user_id);

CREATE INDEX IF NOT EXISTS models_name_idx ON models USING GIN (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS models_updated_at_idx ON models (source_updated_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS model_tags_code_idx ON model_tags (code);
CREATE INDEX IF NOT EXISTS media_items_created_at_idx ON media_items (created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS model_open_links_model_position_idx ON model_open_links (model_id, position);
CREATE INDEX IF NOT EXISTS model_open_links_content_position_idx ON model_open_links (content_id, position);

CREATE TABLE IF NOT EXISTS visitor_credits (
  id SERIAL PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  credits INTEGER NOT NULL DEFAULT 30,
  opens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_characters (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  persona TEXT NOT NULL,
  image_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  level INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'featured' CHECK (category IN ('hot', 'featured', 'new')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_characters_category_idx ON chat_characters (category);
CREATE INDEX IF NOT EXISTS chat_characters_active_idx ON chat_characters (is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES chat_characters(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS chat_messages_character_session_idx ON chat_messages (character_id, session_id, created_at);
