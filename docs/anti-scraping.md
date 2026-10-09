# Anti-scraping deployment

This project now has two independent checks:

1. **Cloudflare at the edge** challenges likely bots before their request reaches the server. This is where IP reputation, datacenter/proxy/VPN signals, browser signals, and request behaviour are evaluated.
2. **Turnstile in the app** makes the visitor complete a Cloudflare browser check before Next.js renders a catalogue page or the API returns catalogue data. The backend redeems every token with Siteverify and sets a signed, HTTP-only session cookie for 12 hours.

Neither layer can prove that every visitor is human or that every VPN is malicious. The goal is to make automated collection expensive while avoiding blanket VPN blocks that would reject legitimate privacy-conscious visitors.

## 1. Configure Cloudflare

- Ensure the `leakporns.com` and `www` DNS records are **proxied** (orange cloud).
- In **Security → Bots**, enable Bot Fight Mode on Free plans. If Bot Management is available, block a bot score of `1` and use **Managed Challenge** for scores `2–29`; allow verified bots if search indexing is wanted.
- In **Security → WAF → Rate limiting rules**, add a Managed Challenge for `*/api/*` above a rate appropriate for the audience (for example, 60 requests per minute per IP for 10 seconds). The Nginx limit is a backup, not the primary control.
- Create a **Managed** Turnstile widget covering `leakporns.com` and `www.leakporns.com`. Copy its site key and secret key.

Do not try to block every VPN or proxy ASN. That creates substantial false positives and proxy lists age quickly; Cloudflare's reputation and bot signals are the better input for a challenge action.

## 2. Configure the shared application secrets

Generate two independent values:

```sh
openssl rand -base64 48
openssl rand -base64 48
```

Set the same values in both service environment files:

```dotenv
# Backend/.env
HUMAN_VERIFICATION_ENABLED=true
HUMAN_VERIFICATION_SECRET=<first generated value>
INTERNAL_API_TOKEN=<second generated value>
TURNSTILE_SECRET_KEY=<Turnstile secret key>
TURNSTILE_EXPECTED_HOSTNAMES=leakporns.com,www.leakporns.com

# Frontend/.env
HUMAN_VERIFICATION_ENABLED=true
HUMAN_VERIFICATION_SECRET=<first generated value>
INTERNAL_API_TOKEN=<second generated value>
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<Turnstile site key>
```

`HUMAN_VERIFICATION_SECRET`, `INTERNAL_API_TOKEN`, and the Turnstile secret key must never use `NEXT_PUBLIC_` and must never be committed. Restart both services after changing these values.

## 3. Protect the origin

Copy `ops/nginx/cloudflare-realip.conf` to `/etc/nginx/snippets/leakporns-cloudflare-realip.conf`, then deploy `ops/nginx/leakporns.conf`. Test before reloading:

```sh
sudo nginx -t
sudo systemctl reload nginx
```

At the cloud-provider firewall/security-group layer, allow TCP 80/443 from Cloudflare's current IP ranges only (plus any required ACME source on port 80), and deny every other public source. Refresh that allowlist when Cloudflare updates its published ranges. The frontend and backend systemd services already bind to `127.0.0.1`, so they must not be exposed directly.

## Acceptance checks

- A new visitor is redirected to `/verify`, completes Turnstile, and returns to the original page.
- `curl https://leakporns.com/api/open-links` returns `403` without the signed HTTP-only cookie.
- The same endpoint works in a browser after verification.
- Nginx access logs show the real visitor IP rather than a Cloudflare IP.
- A direct request to the origin IP is blocked by the hosting firewall.
