"""Regression tests for root-scraper link resolution and retry bookkeeping.

These tests use small protocol fakes so they can run without a live browser,
Postgres, AWS credentials, or the scraper's optional runtime dependencies.
"""

from __future__ import annotations

import importlib
import importlib.util
import os
import sys
import types
import unittest
from types import SimpleNamespace
from unittest import mock


def _module(name: str, **attributes: object) -> types.ModuleType:
    module = types.ModuleType(name)
    for key, value in attributes.items():
        setattr(module, key, value)
    sys.modules[name] = module
    return module


def _missing(module_name: str) -> bool:
    try:
        return importlib.util.find_spec(module_name) is None
    except (ModuleNotFoundError, ValueError):
        return True


class _DependencyError(Exception):
    pass


def _install_dependency_stubs() -> None:
    """Stub imports only when the production dependency is unavailable."""
    if _missing("boto3"):
        _module("boto3", client=lambda *_args, **_kwargs: None)

    if _missing("botocore"):
        _module("botocore")
        exceptions = _module("botocore.exceptions", ClientError=_DependencyError)
        sys.modules["botocore"].exceptions = exceptions

    if _missing("psycopg"):
        rows = SimpleNamespace(dict_row=object())
        _module("psycopg", rows=rows, connect=lambda *_args, **_kwargs: None)

    if _missing("requests"):
        _module(
            "requests",
            RequestException=_DependencyError,
            post=lambda *_args, **_kwargs: None,
        )

    if _missing("camoufox"):
        _module("camoufox")
        sync_api = _module("camoufox.sync_api", Camoufox=object)
        sys.modules["camoufox"].sync_api = sync_api

    if _missing("cryptography"):
        _module("cryptography")
        _module("cryptography.hazmat")
        _module("cryptography.hazmat.primitives")
        _module("cryptography.hazmat.primitives.ciphers")

        class _AESGCM:
            def __init__(self, _key: bytes):
                pass

            def encrypt(self, _nonce: bytes, data: bytes, _associated_data: object) -> bytes:
                return data

        aead = _module("cryptography.hazmat.primitives.ciphers.aead", AESGCM=_AESGCM)
        sys.modules["cryptography.hazmat.primitives.ciphers"].aead = aead

    if _missing("dotenv"):
        _module("dotenv", load_dotenv=lambda *_args, **_kwargs: None)

    if _missing("playwright"):
        _module("playwright")
        sync_api = _module(
            "playwright.sync_api",
            Error=_DependencyError,
            TimeoutError=type("PlaywrightTimeoutError", (_DependencyError,), {}),
        )
        sys.modules["playwright"].sync_api = sync_api


_install_dependency_stubs()
scraper = importlib.import_module("Scarper.leakshaven_root_scraper")


class ScriptedCursor:
    def __init__(self, steps: list[dict[str, object]]):
        self.steps = list(steps)
        self.executions: list[tuple[str, object]] = []
        self.rowcount = 0
        self._current: dict[str, object] = {}

    def __enter__(self) -> "ScriptedCursor":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def execute(self, sql: str, params: object = None) -> None:
        self.executions.append((" ".join(sql.split()), params))
        if not self.steps:
            raise AssertionError("unexpected SQL execution")
        self._current = self.steps.pop(0)
        self.rowcount = int(self._current.get("rowcount", 0))

    def fetchall(self) -> list[tuple[object, ...]]:
        return list(self._current.get("rows", []))

    def fetchone(self) -> tuple[object, ...]:
        return self._current.get("one", (0,))  # type: ignore[return-value]


class FakeConnection:
    def __init__(self, steps: list[dict[str, object]]):
        self.cursor_instance = ScriptedCursor(steps)
        self.commits = 0

    def cursor(self, **_kwargs: object) -> ScriptedCursor:
        return self.cursor_instance

    def commit(self) -> None:
        self.commits += 1


class RetryBookkeepingTests(unittest.TestCase):
    def test_pending_query_includes_persistent_root_retries_with_cooldown(self) -> None:
        connection = FakeConnection([{"rows": [("retry-id",), ("new-id",)]}])

        selected = scraper.pending_content_ids(
            connection,
            limit=30,
            preferred_ids=["new-id", "retry-id"],
            root_image_prefix="https://assets.example/root-feed",
            retry_cooldown_minutes=20,
        )

        self.assertEqual(selected, ["retry-id", "new-id"])
        sql, params = connection.cursor_instance.executions[0]
        self.assertIn("status IN ('pending', 'retry_pending')", sql)
        self.assertNotIn("resolution_attempts <", sql)
        self.assertIn("last_resolution_attempt_at <=", sql)
        self.assertIn("image_url LIKE", sql)
        self.assertEqual(
            params,
            (
                ["new-id", "retry-id"],
                "https://assets.example/root-feed/%",
                "https://assets.example/root-feed/%",
                20,
                30,
            ),
        )

    def test_defer_only_ages_attempted_unresolved_rows(self) -> None:
        connection = FakeConnection([{"rowcount": 1}])

        deferred = scraper.defer_unresolved(
            connection,
            attempted_ids=["resolved-id", "unresolved-id"],
            resolved_ids={"resolved-id": "https://mega.nz/folder/abc#key"},
        )

        self.assertEqual(deferred, 1)
        update_sql, update_params = connection.cursor_instance.executions[0]
        self.assertIn("resolution_attempts = resolution_attempts + 1", update_sql)
        self.assertEqual(update_params, (["unresolved-id"],))
        self.assertNotIn("DELETE", update_sql)
        self.assertEqual(len(connection.cursor_instance.executions), 1)
        self.assertEqual(connection.commits, 1)

    def test_defer_never_deletes_rows_at_high_attempt_count(self) -> None:
        connection = FakeConnection([{"rowcount": 3}])

        result = scraper.defer_unresolved(
            connection,
            attempted_ids=["a", "b", "c"],
            resolved_ids=(),
        )

        self.assertEqual(result, 3)
        self.assertEqual(len(connection.cursor_instance.executions), 1)
        self.assertNotIn("DELETE", connection.cursor_instance.executions[0][0])
        self.assertEqual(connection.commits, 1)

    def test_all_resolved_skips_retry_mutation(self) -> None:
        connection = FakeConnection([])

        result = scraper.defer_unresolved(
            connection,
            attempted_ids=["a", "b"],
            resolved_ids=["a", "b"],
        )

        self.assertEqual(result, 0)
        self.assertEqual(connection.cursor_instance.executions, [])
        self.assertEqual(connection.commits, 0)

    def test_mark_resolved_persists_destination_and_status(self) -> None:
        connection = FakeConnection([{}, {}])
        destinations = {
            "a": "https://mega.nz/folder/one#key",
            "b": "https://mega.co.nz/file/two#key",
        }

        count = scraper.mark_resolved(connection, destinations)

        self.assertEqual(count, 2)
        self.assertEqual(connection.commits, 1)
        for (sql, params), expected in zip(
            connection.cursor_instance.executions,
            destinations.items(),
        ):
            content_id, mega_url = expected
            self.assertIn("status = 'resolved'", sql)
            self.assertEqual(params, (mega_url, content_id))


class _FakeBody:
    def inner_text(self, **_kwargs: object) -> str:
        return ""


class _FakePage:
    def __init__(
        self,
        redirect_url: str,
        response_location: str | None = None,
        anchor_urls: list[str] | None = None,
        source: str = "",
    ):
        self.url = "https://leakshaven.com/get-link"
        self.main_frame = object()
        self.redirect_url = redirect_url
        self.response_location = response_location
        self.anchor_urls = anchor_urls or []
        self.source = source
        self.handlers: dict[str, object] = {}
        self.closed = False

    def on(self, event: str, handler: object) -> None:
        self.handlers[event] = handler

    def goto(self, *_args: object, **_kwargs: object) -> None:
        handler = self.handlers["request"]
        handler(SimpleNamespace(url=self.redirect_url))  # type: ignore[operator]
        if self.response_location:
            response_handler = self.handlers["response"]
            response_handler(_FakeResponse(self, self.response_location))  # type: ignore[operator]

    def locator(self, _selector: str) -> _FakeBody:
        if _selector == "a[href]":
            return SimpleNamespace(evaluate_all=lambda _script: self.anchor_urls)  # type: ignore[return-value]
        return _FakeBody()

    def content(self) -> str:
        return self.source

    def close(self) -> None:
        self.closed = True


class _FakeResponse:
    def __init__(self, page: _FakePage, location: str):
        self.request = SimpleNamespace(
            is_navigation_request=lambda: True,
            frame=page.main_frame,
        )
        self.status = 302
        self._location = location

    def header_value(self, name: str) -> str | None:
        return self._location if name.casefold() == "location" else None


class _OriginPage:
    def __init__(self) -> None:
        self.goto_calls: list[tuple[object, object, object]] = []
        self.waits: list[object] = []

    def goto(self, url: object, *, wait_until: object, timeout: object) -> object:
        self.goto_calls.append((url, wait_until, timeout))
        return SimpleNamespace(status=200)

    def wait_for_timeout(self, duration: object) -> None:
        self.waits.append(duration)


class _CrashingContext:
    def __init__(self, page: _FakePage):
        self.page = page
        self.calls = 0

    def new_page(self) -> _FakePage:
        self.calls += 1
        if self.calls == 1:
            return self.page
        raise scraper.PlaywrightError("browser closed")


class _SinglePageContext:
    def __init__(self, page: _FakePage):
        self.page = page

    def new_page(self) -> _FakePage:
        return self.page


class _SequenceContext:
    def __init__(self, pages: list[_FakePage]):
        self.pages = list(pages)

    def new_page(self) -> _FakePage:
        return self.pages.pop(0)


class ConfigTests(unittest.TestCase):
    def test_default_resolution_pacing_is_serial_and_bounded(self) -> None:
        with (
            mock.patch.object(scraper, "load_dotenv"),
            mock.patch.dict(
                os.environ,
                {
                    "DATABASE_URL": "postgresql://user:password@database.example:5432/app",
                    "PROXY": "http://proxy.example:8080",
                },
                clear=True,
            ),
        ):
            config = scraper.load_config()

        self.assertEqual(config.resolve_batch_size, 1)
        self.assertEqual(config.direct_request_interval_seconds, 2)
        self.assertEqual(config.direct_settle_timeout, 12)


class ResolverAccountingTests(unittest.TestCase):
    def test_origin_bootstrap_uses_the_public_homepage_without_clearing_storage(self) -> None:
        page = _OriginPage()

        scraper.prepare_origin_page(page, timeout=45)

        self.assertEqual(page.goto_calls, [("https://leakshaven.com/", "commit", 30_000)])
        self.assertEqual(page.waits, [250])

    def test_mega_url_accepts_current_and_legacy_formats(self) -> None:
        self.assertTrue(scraper.is_mega_url("https://mega.nz/folder/abc#secret"))
        self.assertTrue(scraper.is_mega_url("https://mega.nz/file/abc#secret"))
        self.assertTrue(scraper.is_mega_url("https://mega.nz/#!abc!secret"))
        self.assertTrue(scraper.is_mega_url("https://mega.co.nz/#F!abc!secret"))
        self.assertFalse(scraper.is_mega_url("https://mega.nz/folder/abc"))
        self.assertFalse(scraper.is_mega_url("https://example.com/folder/abc#secret"))

    def test_event_captured_destination_finishes_without_settle_wait(self) -> None:
        destination = "https://mega.nz/folder/abc#secret"
        page = _FakePage(destination)
        context = _SinglePageContext(page)

        with (
            mock.patch.object(scraper, "encrypted_content_id", return_value="encrypted"),
            mock.patch.object(scraper.time, "monotonic", side_effect=[0.0, 0.1]),
            mock.patch.object(scraper.time, "sleep") as sleep,
        ):
            resolved, attempted = scraper.resolve_batch(
                context,
                source_page=object(),
                content_ids=["captured"],
                batch_size=1,
                navigation_timeout=8,
                settle_timeout=10,
            )

        self.assertEqual(resolved, {"captured": destination})
        self.assertEqual(attempted, ["captured"])
        sleep.assert_not_called()
        self.assertTrue(page.closed)

    def test_redirect_location_is_captured_without_a_mega_request(self) -> None:
        destination = "https://mega.nz/folder/abc#secret"
        page = _FakePage("https://leakshaven.com/get-link", response_location=destination)

        with (
            mock.patch.object(scraper, "encrypted_content_id", return_value="encrypted"),
            mock.patch.object(scraper.time, "monotonic", side_effect=[0.0, 0.1]),
            mock.patch.object(scraper.time, "sleep") as sleep,
        ):
            resolved, attempted = scraper.resolve_batch(
                _SinglePageContext(page),
                source_page=object(),
                content_ids=["redirected"],
                batch_size=1,
                navigation_timeout=8,
                settle_timeout=10,
            )

        self.assertEqual(resolved, {"redirected": destination})
        self.assertEqual(attempted, ["redirected"])
        sleep.assert_not_called()

    def test_document_destination_is_captured_from_a_rendered_link(self) -> None:
        destination = "https://mega.nz/folder/abc#secret"
        page = _FakePage(
            "https://leakshaven.com/get-link",
            anchor_urls=[destination],
        )

        with (
            mock.patch.object(scraper, "encrypted_content_id", return_value="encrypted"),
            mock.patch.object(scraper.time, "monotonic", side_effect=[0.0, 0.1]),
            mock.patch.object(scraper.time, "sleep") as sleep,
        ):
            resolved, attempted = scraper.resolve_batch(
                _SinglePageContext(page),
                source_page=object(),
                content_ids=["rendered"],
                batch_size=1,
                navigation_timeout=8,
                settle_timeout=10,
            )

        self.assertEqual(resolved, {"rendered": destination})
        self.assertEqual(attempted, ["rendered"])
        sleep.assert_not_called()

    def test_document_destination_is_captured_from_an_inline_script(self) -> None:
        destination = "https://mega.nz/file/abc#secret"
        page = _FakePage(
            "https://leakshaven.com/get-link",
            source=f'<script>window.destination = "{destination.replace("/", r"\/")}";</script>',
        )

        with (
            mock.patch.object(scraper, "encrypted_content_id", return_value="encrypted"),
            mock.patch.object(scraper.time, "monotonic", side_effect=[0.0, 0.1]),
            mock.patch.object(scraper.time, "sleep") as sleep,
        ):
            resolved, attempted = scraper.resolve_batch(
                _SinglePageContext(page),
                source_page=object(),
                content_ids=["inline-script"],
                batch_size=1,
                navigation_timeout=8,
                settle_timeout=10,
            )

        self.assertEqual(resolved, {"inline-script": destination})
        self.assertEqual(attempted, ["inline-script"])
        sleep.assert_not_called()

    def test_serial_batches_apply_the_configured_request_interval(self) -> None:
        first = _FakePage("https://mega.nz/folder/first#secret")
        second = _FakePage("https://mega.nz/folder/second#secret")

        with (
            mock.patch.object(scraper, "encrypted_content_id", return_value="encrypted"),
            mock.patch.object(scraper.time, "monotonic", side_effect=[0.0, 0.1, 0.2, 0.3]),
            mock.patch.object(scraper.time, "sleep") as sleep,
        ):
            resolved, attempted = scraper.resolve_batch(
                _SequenceContext([first, second]),
                source_page=object(),
                content_ids=["first", "second"],
                batch_size=1,
                navigation_timeout=8,
                settle_timeout=10,
                inter_batch_delay=2,
            )

        self.assertEqual(
            resolved,
            {
                "first": "https://mega.nz/folder/first#secret",
                "second": "https://mega.nz/folder/second#secret",
            },
        )
        self.assertEqual(attempted, ["first", "second"])
        sleep.assert_called_once_with(2)

    def test_browser_crash_does_not_age_links_that_never_opened(self) -> None:
        destination = "https://mega.nz/folder/abc#secret"
        page = _FakePage(destination)
        context = _CrashingContext(page)

        with mock.patch.object(scraper, "encrypted_content_id", return_value="encrypted"):
            resolved, attempted = scraper.resolve_batch(
                context,
                source_page=object(),
                content_ids=["opened", "never-opened"],
                batch_size=2,
                navigation_timeout=8,
                settle_timeout=10,
            )

        self.assertEqual(resolved, {"opened": destination})
        self.assertEqual(attempted, ["opened"])
        self.assertTrue(page.closed)


if __name__ == "__main__":
    unittest.main()
