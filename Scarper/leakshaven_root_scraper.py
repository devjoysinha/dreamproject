#!/usr/bin/env python3
"""Import new Leakshaven root-feed items into the local catalogue.

The source site's redirect endpoint requires a same-origin browser encryption key,
so this job deliberately uses a proxy-backed Camoufox session for both the feed
request and direct-link resolution.  It never writes source preview URLs to the
database: a preview is first copied into the configured S3 bucket or omitted.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
from collections import Counter
import hashlib
import json
import logging
import math
import os
import re
import secrets
import threading
import time
import unicodedata
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Set, Tuple
from urllib.parse import quote, unquote, urlsplit, urlunsplit

import boto3
import psycopg
import requests
from botocore.exceptions import ClientError
from camoufox.sync_api import Camoufox
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import load_dotenv
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError


ROOT = Path(__file__).resolve().parent
API_URL = "https://api.leakshaven.com/content"
# Bootstrap from the normal public page.  A crawler-control document does not
# establish the same browser state as a real visitor and was followed by source
# validation after only the first resolver batch.
ORIGIN_URL = "https://leakshaven.com/"
SOURCE_REFERRER = "https://leakshaven.com/"
LOGGER = logging.getLogger("leakshaven-root-scraper")

LOW_BANDWIDTH_PREFS = {
    "extensions.update.enabled": False,
    "extensions.update.autoUpdateDefault": False,
    "extensions.systemAddon.update.enabled": False,
    "extensions.blocklist.enabled": False,
    "gfx.downloadable_fonts.enabled": False,
}


@dataclass(frozen=True)
class Config:
    database_url: str
    proxy_url: str
    telegram_token: str
    telegram_chat_id: str
    notify_every_run: bool
    root_count: int
    max_resolves: int
    request_timeout: int
    resolve_batch_size: int
    direct_request_interval_seconds: int
    direct_navigation_timeout: int
    direct_settle_timeout: int
    retry_cooldown_minutes: int
    asset_bucket: str
    asset_region: str
    asset_prefix: str
    asset_public_base_url: str
    max_image_bytes: int


def env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return value.strip().casefold() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise ValueError(f"{name} must be an integer.") from error
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}.")
    return value


def normalize_proxy(value: str) -> str:
    """Accept normal URI notation and the proxy vendor host:port:user:pass form."""
    value = value.strip()
    if "://" not in value:
        value = "http://" + value
    scheme, address = value.split("://", 1)
    if "@" not in address and not address.startswith("["):
        fields = address.split(":", 3)
        if len(fields) == 4:
            host, port, username, password = fields
            value = f"{scheme}://{quote(username, safe='')}:{quote(password, safe='')}@{host}:{port}"
    try:
        parsed = urlsplit(value)
        port = parsed.port
        host = parsed.hostname
    except ValueError as error:
        raise ValueError("PROXY has an invalid host or port.") from error
    if parsed.scheme not in {"http", "https", "socks5", "socks5h"}:
        raise ValueError("PROXY must use http, https, socks5, or socks5h.")
    if not host or port is None or not 1 <= port <= 65535:
        raise ValueError("PROXY must include a host and a valid port.")
    if parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        raise ValueError("PROXY must not contain a path, query, or fragment.")
    if (parsed.username is None) != (parsed.password is None):
        raise ValueError("PROXY credentials must include both a username and password.")
    return parsed._replace(path="").geturl()


def load_config() -> Config:
    load_dotenv(ROOT / ".env")
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise ValueError("DATABASE_URL is required.")
    proxy_raw = os.getenv("PROXY", "").strip()
    if not proxy_raw:
        raise ValueError("PROXY is required; the root scraper will not run directly.")
    token = (os.getenv("TELEGRAM_BOT_TOKEN") or os.getenv("TELEGRAM_TOKEN") or "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    return Config(
        database_url=database_url,
        proxy_url=normalize_proxy(proxy_raw),
        telegram_token=token,
        telegram_chat_id=chat_id,
        notify_every_run=env_bool("TELEGRAM_NOTIFY_EVERY_RUN", True),
        root_count=env_int("LEAKSHAVEN_ROOT_COUNT", 30, 1, 30),
        # Give each run enough capacity for the current feed plus eligible
        # persistent retries, while keeping the browser workload bounded.
        max_resolves=env_int("MAX_RESOLVES_PER_RUN", 30, 1, 30),
        request_timeout=env_int("REQUEST_TIMEOUT_SECONDS", 45, 10, 120),
        # Start one direct-link page at a time.  Bursting several new source
        # pages was consistently followed by source validation after the first
        # batch, leaving most of the feed unresolved.
        resolve_batch_size=env_int("DIRECT_LINK_BATCH_SIZE", 1, 1, 6),
        direct_request_interval_seconds=env_int("DIRECT_LINK_INTERVAL_SECONDS", 2, 1, 30),
        direct_navigation_timeout=env_int("DIRECT_LINK_NAVIGATION_TIMEOUT_SECONDS", 15, 8, 30),
        # A genuine redirect is normally observed immediately by an event
        # handler.  Keep failures bounded so validation pages do not consume
        # the full scheduler slot.
        direct_settle_timeout=env_int("DIRECT_LINK_SETTLE_TIMEOUT_SECONDS", 12, 10, 120),
        # A failed source-validation session must not destroy the listing.  A
        # short cooldown makes the next scheduled run the retry boundary while
        # preventing an immediate manual rerun from hammering the same links.
        retry_cooldown_minutes=env_int("DIRECT_LINK_RETRY_COOLDOWN_MINUTES", 20, 1, 1440),
        asset_bucket=os.getenv("ASSET_BUCKET", "dreamproject-profile-images").strip(),
        asset_region=os.getenv("ASSET_REGION", "us-east-1").strip(),
        asset_prefix=os.getenv("ASSET_PREFIX", "root-feed").strip("/"),
        asset_public_base_url=os.getenv("ASSET_PUBLIC_BASE_URL", "https://dzromswftdto7.cloudfront.net").rstrip("/"),
        max_image_bytes=env_int("MAX_IMAGE_BYTES", 12 * 1024 * 1024, 256 * 1024, 50 * 1024 * 1024),
    )


def redact_error(error: BaseException) -> str:
    text = " ".join(str(error).split())
    text = re.sub(r"(https?://)[^/@\s:]+:[^/@\s]+@", r"\1***:***@", text)
    return text[:500]


def base64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def is_mega_url(url: str) -> bool:
    try:
        parsed = urlsplit(url)
        host = (parsed.hostname or "").casefold().rstrip(".")
    except ValueError:
        return False
    if not (host == "mega.nz" or host.endswith(".mega.nz") or host == "mega.co.nz"):
        return False
    if not parsed.fragment:
        return False
    if parsed.path.startswith(("/folder/", "/file/")):
        return True
    # Older MEGA links use fragment-only paths such as #!id!key and
    # #F!folder-id!key.  They remain valid destinations and otherwise get
    # incorrectly sent back through the retry queue forever.
    return parsed.path in {"", "/"} and bool(
        re.fullmatch(r"(?:F!|!)?[^!/#]+![^!/#]+", parsed.fragment)
    )


def relative_age(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        created = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    seconds = max(0, (datetime.now(timezone.utc) - created).total_seconds())
    days = seconds / 86400
    if days < 1:
        hours = max(1, round(seconds / 3600))
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    if days < 30:
        count = max(1, round(days))
        return f"{count} day{'s' if count != 1 else ''} ago"
    if days < 365:
        count = max(1, math.floor(days / 30.4375))
        return f"{count} month{'s' if count != 1 else ''} ago"
    count = max(1, math.floor(days / 365.25))
    return f"{count} year{'s' if count != 1 else ''} ago"


def size_display(value: int) -> Optional[str]:
    if value <= 0:
        return None
    units = ["B", "KB", "MB", "GB", "TB"]
    power = min(int(math.floor(math.log(value, 1000))), len(units) - 1)
    return f"{value / (1000 ** power):.0f} {units[power]}"


def as_int(value: Any) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def normalise_record(record: Mapping[str, Any]) -> Optional[Dict[str, Any]]:
    content_id = str(record.get("id") or "").strip()
    short_code = str(record.get("shortCode") or "").strip()
    title = str(record.get("title") or "").strip()
    if not content_id or not short_code or not title:
        return None
    info = record.get("info") if isinstance(record.get("info"), Mapping) else {}
    created_at = record.get("createdAt") or None
    bytes_value = as_int(info.get("size"))
    source_image = str(record.get("previewMedia") or record.get("media") or "").strip() or None
    premium = bool(record.get("isPremium"))
    return {
        "content_id": content_id,
        "short_code": short_code,
        "title": title,
        "created_at": created_at,
        "relative_age": relative_age(created_at),
        "is_trending": bool(record.get("isTrending")),
        "is_premium": premium,
        "media_type": str(record.get("mediaType") or "").strip() or None,
        "source_image": source_image,
        "image_url": None,
        "size_bytes": bytes_value or None,
        "size_display": size_display(bytes_value),
        "image_count": as_int(info.get("images")),
        "video_count": as_int(info.get("videos")),
        "status": "premium_skipped" if premium else "pending",
    }


def normalise_text(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(character for character in text if not unicodedata.combining(character))
    return re.sub(r"[^a-z0-9]+", " ", text.casefold()).strip()


def alias_values(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield from (piece.strip() for piece in re.split(r"[·,;|\n]+", value) if piece.strip())
    elif isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
        for item in value:
            if isinstance(item, str) and item.strip():
                yield item.strip()


def model_aliases(row: Mapping[str, Any]) -> Set[str]:
    forms: Set[str] = set()
    for value in (row.get("name"), row.get("source_query")):
        normalized = normalise_text(value)
        if normalized:
            forms.add(normalized)
    meta = row.get("profile_meta") or {}
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except json.JSONDecodeError:
            meta = {}
    if isinstance(meta, Mapping):
        for value in alias_values(meta.get("aliases")):
            normalized = normalise_text(value)
            if normalized:
                forms.add(normalized)
    return {
        value for value in forms
        if len(value.replace(" ", "")) >= 4 and not (" " not in value and len(value) < 5)
    }


class AliasMatcher:
    def __init__(self, rows: Iterable[Mapping[str, Any]]):
        self.candidates: List[Tuple[str, str, Tuple[int, int]]] = []
        for row in rows:
            model_id = str(row["id"])
            for alias in model_aliases(row):
                self.candidates.append((model_id, alias, (len(alias.split()), len(alias))))
        self.candidates.sort(key=lambda candidate: candidate[2], reverse=True)

    def match(self, title: str) -> List[str]:
        padded_title = f" {normalise_text(title)} "
        matches: Dict[str, Tuple[int, int]] = {}
        for model_id, alias, score in self.candidates:
            if f" {alias} " in padded_title and score > matches.get(model_id, (0, 0)):
                matches[model_id] = score
        return [model_id for model_id, _score in sorted(matches.items())]


@contextmanager
def camoufox_proxy(proxy_url: str):
    """Adapt authenticated SOCKS proxy URLs for Firefox and pin Evomi sessions."""
    parsed = urlsplit(proxy_url)
    password = unquote(parsed.password or "")
    hostname = (parsed.hostname or "").casefold()
    if (
        hostname.endswith("evomi.com")
        and parsed.username is not None
        and not re.search(r"_(?:session|hardsession|lockedsession)-", password)
    ):
        password += f"_session-{secrets.token_hex(4)}_lifetime-10"
        host = parsed.hostname or ""
        if ":" in host and not host.startswith("["):
            host = f"[{host}]"
        parsed = parsed._replace(netloc=f"{quote(unquote(parsed.username), safe='')}:{quote(password, safe='')}@{host}:{parsed.port}")
    scheme = "socks5" if parsed.scheme == "socks5h" else parsed.scheme
    server = parsed._replace(scheme=scheme, netloc=parsed.netloc.rsplit("@", 1)[-1]).geturl()
    proxy: Dict[str, str] = {"server": server}
    if parsed.username is not None:
        proxy["username"] = unquote(parsed.username)
        proxy["password"] = unquote(parsed.password or "")
    if scheme != "socks5" or parsed.username is None:
        yield proxy
        return

    import pproxy

    remote = pproxy.Connection(server)
    remote.users = [f"{proxy['username']}:{proxy['password']}".encode("utf-8")]
    listener = pproxy.Server("http://127.0.0.1:0")
    loop = asyncio.new_event_loop()
    thread = threading.Thread(target=loop.run_forever, name="scraper-proxy-relay", daemon=True)
    handler = None

    async def start() -> Any:
        return await listener.start_server({"rserver": [remote]})

    async def stop() -> None:
        if handler is not None:
            handler.close()
            await handler.wait_closed()
        pending = [task for task in asyncio.all_tasks() if task is not asyncio.current_task()]
        for task in pending:
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
        await loop.shutdown_asyncgens()

    thread.start()
    try:
        handler = asyncio.run_coroutine_threadsafe(start(), loop).result(timeout=10)
        port = handler.sockets[0].getsockname()[1]
        yield {"server": f"http://127.0.0.1:{port}"}
    finally:
        try:
            asyncio.run_coroutine_threadsafe(stop(), loop).result(timeout=10)
        finally:
            loop.call_soon_threadsafe(loop.stop)
            thread.join(timeout=10)
            loop.close()


def prepare_origin_page(page: Any, timeout: int) -> None:
    # `commit` waits for the public document response and its cookies without
    # making a large client-rendered application a prerequisite for resolving
    # links.  The direct-link page shares this real source origin.
    response = page.goto(ORIGIN_URL, wait_until="commit", timeout=min(timeout, 30) * 1000)
    if response is not None and response.status >= 400:
        raise RuntimeError(f"Origin bootstrap returned HTTP {response.status}.")
    # Do not clear local/session storage here.  The homepage may establish
    # state used by the direct-link page; only the resolver-owned encryption
    # key is created on demand below when absent.
    page.wait_for_timeout(250)


def feed_records(context: Any, count: int, timeout: int) -> List[Mapping[str, Any]]:
    response = context.request.get(
        API_URL,
        # The source API treats search as required even for the root catalogue.
        params={"search": "", "count": str(count), "ethnicity": "all", "sorting": "NEWEST"},
        timeout=timeout * 1000,
    )
    if not response.ok:
        raise RuntimeError(f"Content API returned HTTP {response.status}.")
    payload = response.json()
    records = payload.get("content", []) if isinstance(payload, Mapping) else []
    return [record for record in records if isinstance(record, Mapping) and not record.get("deleted")]


def local_encryption_key(page: Any) -> bytes:
    stored = page.evaluate("window.localStorage.getItem('encryptionKey')")
    if stored:
        try:
            stored = json.loads(stored)
        except json.JSONDecodeError:
            pass
        try:
            encoded = str(stored)
            key = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
            if len(key) == 32:
                return key
        except (TypeError, ValueError):
            pass
    key = os.urandom(32)
    page.evaluate("(value) => localStorage.setItem('encryptionKey', JSON.stringify(value))", base64url(key))
    return key


def encrypted_content_id(page: Any, content_id: str) -> str:
    nonce = os.urandom(12)
    ciphertext = AESGCM(local_encryption_key(page)).encrypt(nonce, content_id.encode("utf-8"), None)
    return f"{base64url(nonce)}:{base64url(ciphertext)}"


def resolve_batch(
    context: Any,
    source_page: Any,
    content_ids: Sequence[str],
    batch_size: int,
    navigation_timeout: int,
    settle_timeout: int,
    inter_batch_delay: float = 2,
) -> Tuple[Dict[str, str], List[str]]:
    """Resolve direct links with a bounded browser-page pool.

    Source pages include a resource-intensive application and validation flow.
    A small pool avoids browser pressure and an inter-batch pause avoids the
    burst that causes source validation.  An interrupted browser leaves
    unattempted records for the next run.
    """
    resolved: Dict[str, str] = {}
    attempted_ids: List[str] = []
    navigation_statuses: Counter[str] = Counter()
    final_hosts: Counter[str] = Counter()
    final_states: Counter[str] = Counter()

    def capture_request(request: Any, content_id: str) -> None:
        if is_mega_url(request.url):
            resolved.setdefault(content_id, request.url)

    def capture_navigation(frame: Any, content_id: str, page: Any) -> None:
        if frame == page.main_frame and is_mega_url(frame.url):
            resolved.setdefault(content_id, frame.url)
            try:
                page.evaluate("window.stop()")
            except PlaywrightError:
                pass

    def capture_response(response: Any, content_id: str, page: Any) -> None:
        """Record navigation health and direct redirect destinations.

        Some redirect responses are observed by Playwright before it emits an
        outgoing request for the target.  Reading `Location` means a valid
        destination is retained even if external navigation is cancelled or
        blocked by the browser.
        """
        try:
            request = response.request
            if request.is_navigation_request() and request.frame == page.main_frame:
                navigation_statuses[str(response.status)] += 1
        except PlaywrightError:
            navigation_statuses["response-error"] += 1
        try:
            location = response.header_value("location")
        except PlaywrightError:
            location = None
        if location and is_mega_url(location):
            resolved.setdefault(content_id, location)

    navigation_failures = 0
    browser_unavailable = False

    def record_page_state(page: Any) -> None:
        try:
            current_url = page.url
            host = (urlsplit(current_url).hostname or "").casefold().rstrip(".")
            body = page.locator("body").inner_text(timeout=1000).casefold()
        except (PlaywrightError, PlaywrightTimeoutError, ValueError):
            host = ""
            current_url = ""
            body = ""
        if is_mega_url(current_url):
            final_hosts["mega"] += 1
        elif host == "leakshaven.com" or host.endswith(".leakshaven.com"):
            final_hosts["source"] += 1
        elif host:
            final_hosts["other"] += 1
        else:
            final_hosts["blank"] += 1
        if "validating" in body or "verify you are human" in body or "recaptcha" in body:
            final_states["source-validation"] += 1
        elif "access denied" in body or "error 1020" in body:
            final_states["access-denied"] += 1
        elif "unavailable" in body or "not found" in body:
            final_states["unavailable"] += 1
        elif body:
            final_states["other-content"] += 1
        else:
            final_states["empty"] += 1

    for offset in range(0, len(content_ids), batch_size):
        pages: Dict[str, Any] = {}
        batch_ids = content_ids[offset : offset + batch_size]
        try:
            for content_id in batch_ids:
                try:
                    target = context.new_page()
                except PlaywrightError as error:
                    LOGGER.warning("Browser stopped before opening the next direct-link page: %s", redact_error(error))
                    browser_unavailable = True
                    break
                pages[content_id] = target
                attempted_ids.append(content_id)
                target.on("request", lambda request, current_id=content_id: capture_request(request, current_id))
                target.on("framenavigated", lambda frame, current_id=content_id, current_page=target: capture_navigation(frame, current_id, current_page))
                target.on(
                    "response",
                    lambda response, current_id=content_id, current_page=target: capture_response(
                        response,
                        current_id,
                        current_page,
                    ),
                )
                try:
                    target.goto(
                        "https://leakshaven.com/get-link?leak=" + quote(encrypted_content_id(source_page, content_id), safe=""),
                        wait_until="commit",
                        timeout=navigation_timeout * 1000,
                        referer=SOURCE_REFERRER,
                    )
                except PlaywrightTimeoutError:
                    # A redirect can still arrive after an initial timeout.
                    navigation_failures += 1
                    navigation_statuses["timeout"] += 1
                except PlaywrightError as error:
                    navigation_failures += 1
                    navigation_statuses["playwright-error"] += 1
                    if "closed" in str(error).casefold() or "crashed" in str(error).casefold():
                        browser_unavailable = True
                        break

            pending = set(pages)
            deadline = time.monotonic() + settle_timeout
            while pending and time.monotonic() < deadline and not browser_unavailable:
                for content_id in list(pending):
                    page = pages[content_id]
                    # Request/framenavigation handlers may capture the MEGA URL
                    # and stop navigation before `page.url` changes.  Treat that
                    # event-captured destination as complete instead of waiting
                    # the entire settle timeout for every successful batch.
                    if content_id in resolved:
                        pending.remove(content_id)
                        continue
                    try:
                        current_url = page.url
                    except PlaywrightError:
                        current_url = ""
                    if is_mega_url(current_url):
                        resolved.setdefault(content_id, current_url)
                        pending.remove(content_id)
                if pending:
                    time.sleep(0.2)
            for page in pages.values():
                record_page_state(page)
        finally:
            for page in pages.values():
                try:
                    page.close()
                except PlaywrightError:
                    pass
        if browser_unavailable:
            break
        # Avoid presenting the source with a burst of application pages.
        if offset + batch_size < len(content_ids):
            time.sleep(inter_batch_delay)

    unresolved = len(attempted_ids) - len(resolved)
    LOGGER.info(
        "Direct-link resolution results: queued=%s attempted=%s resolved=%s navigation_failures=%s unresolved=%s browser_unavailable=%s",
        len(content_ids), len(attempted_ids), len(resolved), navigation_failures, unresolved, browser_unavailable,
    )
    LOGGER.info(
        "Direct-link diagnostics: navigation_statuses=%s final_hosts=%s final_states=%s",
        dict(sorted(navigation_statuses.items())),
        dict(sorted(final_hosts.items())),
        dict(sorted(final_states.items())),
    )
    return resolved, attempted_ids


class AssetStore:
    def __init__(self, config: Config, fetch_preview: Any):
        self.config = config
        self.fetch_preview = fetch_preview
        self.upload_failures = 0
        self.client = boto3.client("s3", region_name=config.asset_region) if config.asset_bucket else None
        self.own_host = (urlsplit(config.asset_public_base_url).hostname or "").casefold()

    def local_url(self, source_url: Optional[str]) -> Optional[str]:
        if not source_url:
            return None
        try:
            parsed = urlsplit(source_url)
        except ValueError:
            return None
        if (parsed.hostname or "").casefold() == self.own_host:
            return source_url
        if not self.client or not self.config.asset_public_base_url:
            self.upload_failures += 1
            LOGGER.warning("Preview image omitted because S3 storage is not configured.")
            return None
        canonical = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))
        digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        content_type = "image/jpeg"
        key = f"{self.config.asset_prefix}/{digest}.jpg"
        try:
            # Use the browser request context, not requests' SOCKS transport:
            # it has the same authenticated/proxied browser session as the feed.
            response = self.fetch_preview(source_url)
            if not response.ok:
                raise ValueError(f"preview returned HTTP {response.status}")
            content_type = (response.headers.get("content-type") or "image/jpeg").split(";", 1)[0].strip().casefold()
            extension = {"image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/jpeg": "jpg"}.get(content_type, "jpg")
            key = f"{self.config.asset_prefix}/{digest}.{extension}"
            content_length = as_int(response.headers.get("content-length"))
            if content_length > self.config.max_image_bytes:
                raise ValueError("preview is larger than MAX_IMAGE_BYTES")
            body = response.body()
            if not body:
                raise ValueError("preview response is empty")
            if len(body) > self.config.max_image_bytes:
                raise ValueError("preview is larger than MAX_IMAGE_BYTES")
            self.client.put_object(
                Bucket=self.config.asset_bucket,
                Key=key,
                Body=body,
                ContentType=content_type if content_type.startswith("image/") else "image/jpeg",
                CacheControl="public, max-age=31536000, immutable",
            )
            return f"{self.config.asset_public_base_url}/{key}"
        except (ClientError, OSError, PlaywrightError, PlaywrightTimeoutError, ValueError) as error:
            self.upload_failures += 1
            LOGGER.warning("Preview image upload failed: %s", redact_error(error))
            return None


def fetch_model_rows(connection: psycopg.Connection[Any]) -> List[Mapping[str, Any]]:
    with connection.cursor(row_factory=psycopg.rows.dict_row) as cursor:
        cursor.execute("SELECT id, name, source_query, profile_meta FROM models")
        return cursor.fetchall()


def known_content_ids(connection: psycopg.Connection[Any], content_ids: Sequence[str]) -> Set[str]:
    if not content_ids:
        return set()
    with connection.cursor() as cursor:
        cursor.execute("SELECT content_id FROM media_items WHERE content_id = ANY(%s)", (list(content_ids),))
        return {row[0] for row in cursor.fetchall()}


def pending_content_ids(
    connection: psycopg.Connection[Any],
    limit: int,
    preferred_ids: Sequence[str] = (),
    root_image_prefix: str = "",
    retry_cooldown_minutes: int = 20,
) -> List[str]:
    """Return a fair queue of current items and persistent root-feed retries.

    Root rows remain eligible after they roll out of the latest 30-item source
    window.  Model-import backlog is excluded by requiring either membership in
    the current window or an image copied into the root-feed asset prefix.
    """
    if not preferred_ids and not root_image_prefix:
        return []
    image_pattern = f"{root_image_prefix.rstrip('/')}/%" if root_image_prefix else ""
    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT content_id FROM media_items
               WHERE mega_url IS NULL AND is_premium = FALSE
                 AND status IN ('pending', 'retry_pending')
                 AND (content_id = ANY(%s) OR (%s <> '' AND image_url LIKE %s))
                 AND (last_resolution_attempt_at IS NULL
                      OR last_resolution_attempt_at <= NOW() - (%s * INTERVAL '1 minute'))
               ORDER BY COALESCE(last_resolution_attempt_at, created_at, '-infinity'::timestamptz) ASC,
                        resolution_attempts ASC,
                        created_at DESC NULLS LAST
               LIMIT %s""",
            (
                list(preferred_ids),
                image_pattern,
                image_pattern,
                retry_cooldown_minutes,
                limit,
            ),
        )
        return [row[0] for row in cursor.fetchall()]


def pending_content_count(
    connection: psycopg.Connection[Any],
    content_ids: Sequence[str],
    root_image_prefix: str = "",
) -> int:
    if not content_ids and not root_image_prefix:
        return 0
    image_pattern = f"{root_image_prefix.rstrip('/')}/%" if root_image_prefix else ""
    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT COUNT(*) FROM media_items
               WHERE mega_url IS NULL AND is_premium = FALSE
                 AND status IN ('pending', 'retry_pending')
                 AND (content_id = ANY(%s) OR (%s <> '' AND image_url LIKE %s))""",
            (list(content_ids), image_pattern, image_pattern),
        )
        return int(cursor.fetchone()[0])


def upsert_feed(connection: psycopg.Connection[Any], records: Sequence[Mapping[str, Any]], associations: Mapping[str, Sequence[str]]) -> Tuple[int, int]:
    if not records:
        return 0, 0
    association_count = 0
    with connection.cursor() as cursor:
        model_ids = sorted({model_id for model_list in associations.values() for model_id in model_list})
        positions: Dict[str, int] = {}
        if model_ids:
            cursor.execute(
                "SELECT model_id, COALESCE(MAX(position), 0) FROM model_open_links WHERE model_id = ANY(%s) GROUP BY model_id",
                (model_ids,),
            )
            positions = {model_id: position for model_id, position in cursor.fetchall()}
        for record in records:
            cursor.execute(
                """INSERT INTO media_items (
                     content_id, short_code, title, created_at, relative_age, is_trending, is_premium,
                     media_type, image_url, size_bytes, size_display, image_count, video_count, mega_url, status
                   ) VALUES (%(content_id)s, %(short_code)s, %(title)s, %(created_at)s, %(relative_age)s,
                     %(is_trending)s, %(is_premium)s, %(media_type)s, %(image_url)s, %(size_bytes)s,
                     %(size_display)s, %(image_count)s, %(video_count)s, NULL, %(status)s)
                   ON CONFLICT (content_id) DO UPDATE SET
                     short_code = EXCLUDED.short_code,
                     title = EXCLUDED.title,
                     created_at = COALESCE(EXCLUDED.created_at, media_items.created_at),
                     relative_age = EXCLUDED.relative_age,
                     is_trending = EXCLUDED.is_trending,
                     is_premium = EXCLUDED.is_premium,
                     media_type = EXCLUDED.media_type,
                     image_url = COALESCE(EXCLUDED.image_url, media_items.image_url),
                     size_bytes = EXCLUDED.size_bytes,
                     size_display = EXCLUDED.size_display,
                     image_count = EXCLUDED.image_count,
                     video_count = EXCLUDED.video_count,
                     status = CASE
                       WHEN media_items.mega_url IS NOT NULL THEN 'resolved'
                       WHEN media_items.status = 'retry_pending' THEN 'retry_pending'
                       ELSE EXCLUDED.status
                     END,
                     updated_at = NOW()""",
                record,
            )
            for model_id in associations.get(record["content_id"], []):
                cursor.execute(
                    "SELECT 1 FROM model_open_links WHERE model_id = %s AND content_id = %s",
                    (model_id, record["content_id"]),
                )
                if cursor.fetchone():
                    continue
                positions[model_id] = positions.get(model_id, 0) + 1
                cursor.execute(
                    "INSERT INTO model_open_links (model_id, content_id, position) VALUES (%s, %s, %s)",
                    (model_id, record["content_id"], positions[model_id]),
                )
                association_count += 1
    connection.commit()
    return len(records), association_count


def mark_resolved(connection: psycopg.Connection[Any], resolved: Mapping[str, str]) -> int:
    if not resolved:
        return 0
    with connection.cursor() as cursor:
        for content_id, mega_url in resolved.items():
            cursor.execute(
                "UPDATE media_items SET mega_url = %s, status = 'resolved', updated_at = NOW() WHERE content_id = %s",
                (mega_url, content_id),
            )
    connection.commit()
    return len(resolved)


def defer_unresolved(
    connection: psycopg.Connection[Any],
    attempted_ids: Sequence[str],
    resolved_ids: Iterable[str],
) -> int:
    """Hide unresolved candidates and retry them in later normal sessions.

    A source validation page has no destination to store, but often clears for a
    later browser session. These records are deliberately not public: only
    resolved rows are served by the API. Attempts are telemetry, not a deletion
    threshold; a transient source failure must never destroy the row.
    """
    resolved_set = set(resolved_ids)
    unresolved_ids = [content_id for content_id in attempted_ids if content_id not in resolved_set]
    if not unresolved_ids:
        return 0
    with connection.cursor() as cursor:
        cursor.execute(
            """UPDATE media_items
               SET status = 'retry_pending',
                   resolution_attempts = resolution_attempts + 1,
                   last_resolution_attempt_at = NOW(),
                   updated_at = NOW()
               WHERE content_id = ANY(%s) AND mega_url IS NULL""",
            (unresolved_ids,),
        )
        deferred = cursor.rowcount
    connection.commit()
    return deferred


def telegram_notify(config: Config, message: str) -> None:
    if not config.telegram_token or not config.telegram_chat_id:
        LOGGER.warning("Telegram notification skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.")
        return
    try:
        response = requests.post(
            f"https://api.telegram.org/bot{config.telegram_token}/sendMessage",
            json={"chat_id": config.telegram_chat_id, "text": message, "disable_web_page_preview": True},
            timeout=20,
        )
        response.raise_for_status()
    except requests.RequestException as error:
        LOGGER.warning("Telegram notification failed: %s", redact_error(error))


def summary_message(stats: Mapping[str, int], duration_seconds: float) -> str:
    return (
        "Leakporns root scraper ✅\n"
        f"Feed checked: {stats['feed']} · New: {stats['new']}\n"
        f"Associated: {stats['associated_records']} listings / {stats['associations']} creator links\n"
        f"Unmatched listings: {stats['unmatched']}\n"
        f"Direct links attempted: {stats['attempted']} · Resolved: {stats['resolved']} · Retry later: {stats['deferred']}\n"
        f"Resolution queue remaining: {stats['pending']}\n"
        f"Image uploads skipped/failed: {stats['image_failures']} · {duration_seconds:.1f}s"
    )


def run(config: Config, dry_run: bool = False) -> Dict[str, int]:
    started = time.monotonic()
    stats: Dict[str, int] = {
        "feed": 0, "new": 0, "associated_records": 0, "associations": 0,
        "unmatched": 0, "attempted": 0, "resolved": 0, "pending": 0, "deferred": 0, "image_failures": 0,
    }
    # A bad database host must fail the run promptly instead of holding the
    # five-minute scheduler slot until systemd terminates it.
    with psycopg.connect(config.database_url, connect_timeout=12) as connection:
        matcher = AliasMatcher(fetch_model_rows(connection))
        LOGGER.info("Starting proxy-backed browser session.")
        with camoufox_proxy(config.proxy_url) as browser_proxy, Camoufox(
            headless=True,
            proxy=browser_proxy,
            geoip=True,
            persistent_context=True,
            user_data_dir=str(ROOT / ".camoufox-root-profile"),
            block_images=False,
            enable_cache=False,
            firefox_user_prefs=LOW_BANDWIDTH_PREFS,
            i_know_what_im_doing=True,
        ) as context:
            LOGGER.info("Browser session ready; loading source origin.")
            page = context.pages[0] if context.pages else context.new_page()
            for stale in list(context.pages)[1:]:
                stale.close()
            prepare_origin_page(page, config.request_timeout)
            LOGGER.info("Fetching the latest root-feed records through the proxy.")
            records = [normalise_record(item) for item in feed_records(context, config.root_count, config.request_timeout)]
            records = [item for item in records if item is not None]
            stats["feed"] = len(records)
            LOGGER.info("Received %s valid root-feed records.", stats["feed"])
            known = known_content_ids(connection, [item["content_id"] for item in records])
            stats["new"] = sum(1 for item in records if item["content_id"] not in known)
            associations = {item["content_id"]: matcher.match(item["title"]) for item in records}
            stats["associated_records"] = sum(1 for linked in associations.values() if linked)
            stats["unmatched"] = len(records) - stats["associated_records"]

            if not dry_run:
                LOGGER.info("Copying preview images to S3 and upserting metadata.")
                asset_store = AssetStore(
                    config,
                    lambda url: context.request.get(url, timeout=config.request_timeout * 1000),
                )
                for item in records:
                    if item["content_id"] not in known:
                        item["image_url"] = asset_store.local_url(item["source_image"])
                stats["image_failures"] = asset_store.upload_failures
                _items, stats["associations"] = upsert_feed(connection, records, associations)
                root_window_ids = [item["content_id"] for item in records]
                root_image_prefix = f"{config.asset_public_base_url}/{config.asset_prefix}"
                pending_ids = pending_content_ids(
                    connection,
                    config.max_resolves,
                    root_window_ids,
                    root_image_prefix,
                    config.retry_cooldown_minutes,
                )
                LOGGER.info("Resolving %s pending direct links.", len(pending_ids))
                resolved, attempted_ids = (
                    resolve_batch(
                        context,
                        page,
                        pending_ids,
                        config.resolve_batch_size,
                        config.direct_navigation_timeout,
                        config.direct_settle_timeout,
                        config.direct_request_interval_seconds,
                    )
                    if pending_ids
                    else ({}, [])
                )
                stats["attempted"] = len(attempted_ids)
                stats["resolved"] = mark_resolved(connection, resolved)
                stats["deferred"] = defer_unresolved(
                    connection,
                    attempted_ids,
                    resolved,
                )
                stats["pending"] = pending_content_count(
                    connection,
                    root_window_ids,
                    root_image_prefix,
                )
            else:
                stats["associations"] = sum(len(value) for value in associations.values())
        duration = time.monotonic() - started
    LOGGER.info("Root feed complete: %s", json.dumps(stats, sort_keys=True))
    if config.notify_every_run and not dry_run:
        telegram_notify(config, summary_message(stats, duration))
    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description="Import the latest Leakshaven root-feed listings.")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and match records without changing Postgres or Telegram.")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        run(load_config(), dry_run=args.dry_run)
    except Exception as error:
        LOGGER.exception("Root scraper failed: %s", redact_error(error))
        try:
            config = load_config()
            telegram_notify(config, f"Leakporns root scraper ❌\n{redact_error(error)}")
        except Exception:
            pass
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
