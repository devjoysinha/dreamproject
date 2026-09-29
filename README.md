# Dream Project

## Structure

- `Frontend/` — Next.js UI clone.
- `Backend/` — reserved for the application API.
- `Scarper/` — reserved for scraping services.

## Frontend

```bash
cd Frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:3000`.

## Cloudflare Web Analytics

The frontend includes Cloudflare's Web Analytics beacon for all routes when a Web Analytics site token is configured. Copy the token from Cloudflare Dashboard → Web Analytics → Manage site and set it in `Frontend/.env`:

```bash
CLOUDFLARE_WEB_ANALYTICS_TOKEN=your-web-analytics-site-token
```

The token is intentionally environment-only and is not committed to the repository. Rebuild the frontend after changing it so the beacon is included in the production HTML. Cloudflare's automatic Web Analytics setup can also inject the beacon for proxied zones.
