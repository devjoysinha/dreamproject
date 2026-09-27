# Model catalogue schema

The importer reads each supplied model JSON file and preserves the source fields without storing database credentials or JSON files in Git.

| Table | Purpose | Source mapping |
| --- | --- | --- |
| `models` | One profile per source model | `profile`, `source`, `schema_version`, `complete`, `updated_at` |
| `model_tags` | Searchable profile tags | `profile.tags[]` |
| `media_items` | De-duplicated link/media metadata | `open_links[]` keyed by `content_id` |
| `model_open_links` | Ordered many-to-many model/media relation | `open_links[].position` |
| `ingest_runs` | Auditable imports and diagnostics | Import execution metadata |

`profile.meta` and `profile.social_links` remain JSONB because their fields are optional and vary across profiles. Frequently queried information—model name, source URL, tag code, media timestamps, flags, and counts—is normalized and indexed.

## Lifecycle

```bash
cd Backend
npm install
npm run migrate
MODEL_DATA_DIR=/Users/joysinha/Desktop/Project/model_json npm run import:models
npm run dev
```

Run `npm run import:models -- --dry-run` to validate source file discovery without touching PostgreSQL.
