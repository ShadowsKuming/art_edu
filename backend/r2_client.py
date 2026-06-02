"""
Lightweight Cloudflare R2 client used by the TTS finalize-story
endpoint (and any future "give me a permanent public URL" feature).

Cloudflare R2 is S3-API compatible, so we just configure a boto3
client with R2's endpoint URL and treat it as S3. Two important
quirks vs. AWS S3:
  • R2 requires SigV4 (`signature_version="s3v4"`). SigV2 fails with
    a cryptic 403.
  • R2's `region_name` is always the literal string `"auto"` —
    different jurisdictions are picked at *bucket creation* time
    via the dashboard, not via the SDK.

Environment variables (mirror docstring in `backend/.env.example`):

    R2_ENDPOINT_URL              https://<account>.r2.cloudflarestorage.com
    R2_ACCESS_KEY_ID
    R2_SECRET_ACCESS_KEY
    R2_STORY_AUDIO_BUCKET        e.g. artbloom-story-audio
    R2_STORY_AUDIO_PUBLIC_URL    https://pub-yyyyyy.r2.dev   (no trailing slash)

If *any* required var is unset we treat the module as disabled and
return False from `enabled()`; callers should turn that into a 503.
The other R2_USER_STATE_* vars are intentionally NOT consumed here —
story audio gets its own bucket so we can keep user-state private
while making story audio publicly fetchable.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError


@dataclass(frozen=True)
class _R2Config:
    endpoint_url: str
    access_key:   str
    secret_key:   str
    bucket:       str
    public_url:   str  # no trailing slash


def _load_config() -> Optional[_R2Config]:
    endpoint = os.getenv("R2_ENDPOINT_URL",           "").strip()
    access   = os.getenv("R2_ACCESS_KEY_ID",          "").strip()
    secret   = os.getenv("R2_SECRET_ACCESS_KEY",      "").strip()
    bucket   = os.getenv("R2_STORY_AUDIO_BUCKET",     "").strip()
    pub      = os.getenv("R2_STORY_AUDIO_PUBLIC_URL", "").strip().rstrip("/")
    if not all((endpoint, access, secret, bucket, pub)):
        return None
    return _R2Config(endpoint, access, secret, bucket, pub)


# Module-level singletons: loaded once at import. If the env vars
# change at runtime (Render redeploy etc.) the process restarts, so
# we don't need a refresh path.
_CONFIG = _load_config()
_CLIENT = None  # lazy-initialised on first use


def _client():
    """Lazy boto3 S3 client. Returns None when R2 is not configured."""
    global _CLIENT
    if _CLIENT is None and _CONFIG is not None:
        _CLIENT = boto3.client(
            "s3",
            endpoint_url         = _CONFIG.endpoint_url,
            aws_access_key_id    = _CONFIG.access_key,
            aws_secret_access_key= _CONFIG.secret_key,
            config = Config(
                signature_version = "s3v4",
                region_name       = "auto",
                # Tighten the connect/read timeouts a bit so a flaky
                # network doesn't hang the finalize-story endpoint
                # forever. Total worst-case wait is ~15 s.
                connect_timeout   = 5,
                read_timeout      = 10,
                retries           = {"max_attempts": 2, "mode": "standard"},
            ),
        )
    return _CLIENT


def enabled() -> bool:
    """Did `_load_config()` find all five env vars?"""
    return _CONFIG is not None


def public_url(key: str) -> str:
    """Compose the permanent public URL for an object."""
    assert _CONFIG is not None, "R2 story-audio client is not configured"
    return f"{_CONFIG.public_url}/{key}"


def head_object(key: str) -> Optional[dict]:
    """
    Cheap existence + metadata probe. Returns:
      • dict with size / content_type / last_modified  → object exists
      • None                                          → 404 / NoSuchKey
    Other ClientErrors (perms, throttling, etc.) are re-raised so the
    caller can surface them.
    """
    client = _client()
    if client is None or _CONFIG is None:
        return None
    try:
        resp = client.head_object(Bucket=_CONFIG.bucket, Key=key)
        return {
            "size":          int(resp.get("ContentLength", 0)),
            "content_type":  resp.get("ContentType", ""),
            "last_modified": resp.get("LastModified"),
        }
    except ClientError as e:
        err_code = e.response.get("Error", {}).get("Code", "")
        # Boto sometimes uses the HTTP status as the code for HEAD
        # 404s ("404"), other times the symbolic forms below.
        if err_code in ("404", "NoSuchKey", "NotFound"):
            return None
        raise


def put_object(key: str, body: bytes, content_type: str = "application/octet-stream") -> None:
    """
    Upload bytes to the bucket. Sets a `Cache-Control` header so
    Cloudflare's edge cache holds the object indefinitely — safe
    because our object keys are content-hashed, so the bytes at a
    given key never change.
    """
    client = _client()
    if client is None or _CONFIG is None:
        raise RuntimeError("R2 story-audio client is not configured")
    client.put_object(
        Bucket       = _CONFIG.bucket,
        Key          = key,
        Body         = body,
        ContentType  = content_type,
        CacheControl = "public, max-age=31536000, immutable",
    )
