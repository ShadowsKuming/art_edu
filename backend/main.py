"""
ArtBloom FastAPI backend (single-file, by spec).

Section map:
    1.  Bootstrap (env, app, CORS, static mount of textbook assets)
    2.  Health
    3.  Story generation        — Executor B
    4.  Animation generation    — Executor C
    5.  Slide-design chatbot    — Executor A (Parts 1/2/4/5)
    6.  Story continuation      — Executor B (continuation)
    7.  Part 6 style transfer   — Executor D
    8.  Part 7 commenter        — Executor A (Part 7)   ← new
    9.  TTS

Multi-agent "Commander" is `lesson_context.lesson_manager` — a singleton
LKP loader that returns prompt fragments / artwork URLs / Part-6 style
configs to inject into each Executor call.  See
``backed-files/ArtBloom_New_API_Spec.md`` for the design rationale.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator, Optional

import edge_tts
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, Response, StreamingResponse
from pydantic import BaseModel

from lesson_context import lesson_manager

# ════════════════════════════════════════════════════════════════════════
# 1. Bootstrap
# ════════════════════════════════════════════════════════════════════════

load_dotenv()

app = FastAPI(title="ArtBloom API")

# CORS — origins are env-driven so production can be locked down later.
# Default keeps the local Vite dev ports working. In production we set
# CORS_ALLOW_ORIGINS to "*" (dev pilot) or a comma-separated list of
# Pages / custom domains.
_cors_env = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
if _cors_env == "*":
    _cors_origins: list[str] = ["*"]
elif _cors_env:
    _cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
else:
    _cors_origins = ["http://localhost:5173", "http://localhost:5174"]

# `allow_credentials=True` is incompatible with the "*" wildcard in
# Starlette/FastAPI, so we flip credentials off when wildcarding.
_cors_credentials = _cors_origins != ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_cors_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Textbook asset mount.
#   • Dev: the same physical files used by the frontend are served at
#     `/textbook-assets/...` so the Doubao vision LLM (and any other
#     downstream consumer) can fetch them via plain HTTP without a
#     base64 round-trip through the browser.
#   • Production: assets live in Cloudflare R2 — set
#     `TEXTBOOK_ASSETS_URL=https://pub-xxx.r2.dev` and the frontend
#     points lesson URLs there directly. The mount below is skipped
#     when the production env var is set OR when the directory is
#     missing (Render's slug doesn't include `frontend/`).
_TEXTBOOK_ASSETS_URL = os.getenv("TEXTBOOK_ASSETS_URL", "").strip()
_TEXTBOOK_DIR = (
    Path(__file__).resolve().parent.parent
    / "frontend"
    / "src"
    / "assets"
    / "textbook-assets"
)
if _TEXTBOOK_ASSETS_URL:
    print(
        f"[startup] textbook-assets served externally from {_TEXTBOOK_ASSETS_URL}",
        flush=True,
    )
elif _TEXTBOOK_DIR.exists():
    print(f"[startup] textbook-assets serving from {_TEXTBOOK_DIR}", flush=True)
else:
    print(f"[startup] textbook-assets dir not found at {_TEXTBOOK_DIR}", flush=True)


@app.get("/textbook-assets/{path:path}")
async def serve_textbook_asset(path: str):
    """Serve textbook assets through the CORS middleware (app.mount bypasses it)."""
    if _TEXTBOOK_ASSETS_URL:
        return RedirectResponse(f"{_TEXTBOOK_ASSETS_URL.rstrip('/')}/{path}")
    if not _TEXTBOOK_DIR.exists():
        raise HTTPException(404, "Textbook assets directory not available")
    file_path = (_TEXTBOOK_DIR / path).resolve()
    # Guard against path traversal.
    if not str(file_path).startswith(str(_TEXTBOOK_DIR.resolve())):
        raise HTTPException(403)
    if not file_path.is_file():
        raise HTTPException(404)
    return FileResponse(file_path)


ARK_API_KEY = os.getenv("ARK_API_KEY", "")
STORY_MODEL = os.getenv("ARK_STORY_MODEL", "doubao-seed-2-0-lite-260215")
CHAT_MODEL = os.getenv("ARK_CHAT_MODEL", "doubao-seed-2-0-lite-260215")
VIDEO_MODEL = os.getenv("ARK_VIDEO_MODEL", "doubao-seedance-2-0-260128")
IMAGE_MODEL = os.getenv("ARK_IMAGE_MODEL", "doubao-seedream-5-0-260128")
ARK_BASE = "https://ark.cn-beijing.volces.com/api/v3"

TTS_VOICES = [
    {"id": "zh-CN-XiaoxiaoNeural", "name": "晓晓", "desc": "温暖"},
    {"id": "zh-CN-XiaoyiNeural", "name": "晓伊", "desc": "活泼"},
    {"id": "zh-CN-YunjianNeural", "name": "云健", "desc": "深沉"},
    {"id": "zh-CN-YunxiNeural", "name": "云希", "desc": "清爽"},
    {"id": "zh-TW-HsiaoYuNeural", "name": "曉雨", "desc": "温柔"},
    {"id": "zh-TW-YunJheNeural", "name": "雲哲", "desc": "自然"},
]


def _ark_headers() -> dict:
    return {
        "Authorization": f"Bearer {ARK_API_KEY}",
        "Content-Type": "application/json",
    }


def _lang_suffix(language: str) -> str:
    """
    Strongly-worded language directive appended to story system prompts.

    The earlier one-liner ("请用简体中文写所有内容") got drowned out by
    the English STORY_SYSTEM / STORY_USER blocks above it, so the model
    fell back to English for the JSON *values* even when called with
    `language='zh'`. This version explicitly enumerates every value
    field that must be in the target language while keeping the JSON
    *keys* (part1, choices, etc.) in English so the frontend parser
    can still find them.
    """
    if language == "zh":
        return (
            "\n\n[语言强约束 / Language requirement]\n"
            "- 输出语言: 简体中文。\n"
            "- 所有 JSON value 必须使用简体中文，包括: "
            "part1 文本、choices[].label、choices[].desc、part3 文本、"
            "designRationale、soundDesign。\n"
            "- JSON key 保持英文不变（part1 / choices / label / desc / part3 / "
            "designRationale / soundDesign）—— 不要翻译这些字段名。\n"
            "- 不要混用英文单词、不要保留任何英文词条；外语人名/地名用中文译名。"
        )
    return (
        "\n\n[Language requirement]\n"
        "- Output language: English.\n"
        "- All JSON values must be written in English (part1, choices.label, "
        "choices.desc, part3, designRationale, soundDesign).\n"
        "- Keep JSON keys (part1, choices, label, desc, part3, designRationale, "
        "soundDesign) in English."
    )


async def _stream_ark(payload: dict) -> AsyncIterator[str]:
    """Pipe Ark streaming SSE response straight to the client."""
    async with httpx.AsyncClient(timeout=90.0) as client:
        async with client.stream(
            "POST",
            f"{ARK_BASE}/chat/completions",
            json=payload,
            headers=_ark_headers(),
        ) as resp:
            async for raw_line in resp.aiter_lines():
                if raw_line:
                    yield raw_line + "\n\n"


# Defensive helper used by every endpoint that takes an optional
# lesson_id — never raise from these injectors, just return an empty
# fragment so legacy callers (no lesson_id) keep working.
def _safe_load_lesson(lesson_id: Optional[str]):
    if not lesson_id:
        return None
    try:
        return lesson_manager.load(lesson_id)
    except Exception as exc:  # pragma: no cover — defensive
        print(f"[lesson_manager] load failed for {lesson_id!r}: {exc}", flush=True)
        return None


# ════════════════════════════════════════════════════════════════════════
# 2. Health
# ════════════════════════════════════════════════════════════════════════


@app.get("/health")
async def health():
    return {
        "ok": True,
        "api_key_set": bool(ARK_API_KEY),
        "tts_voices": len(TTS_VOICES),
        "story_model": STORY_MODEL,
        "video_model": VIDEO_MODEL,
        "image_model": IMAGE_MODEL,
        "available_lessons": lesson_manager.list_available(),
    }


# ════════════════════════════════════════════════════════════════════════
# 3. Story generation — Executor B
# ════════════════════════════════════════════════════════════════════════


class StoryRequest(BaseModel):
    image_base64: str  # raw base64, no "data:" prefix
    image_mime: str = "image/jpeg"
    language: str = "en"
    # 🆕 LKP wiring (Pilot: backward-compat — both optional)
    lesson_id: Optional[str] = None
    artwork_id: Optional[str] = None


# ── Story prompts ────────────────────────────────────────────────────────
#
# v2 (2026-05): Doubao kept producing English JSON values even when
# `language='zh'`. Root cause was that STORY_SYSTEM and STORY_USER were
# both English blocks (closer to the model's "voice"), and the single
# Chinese line at the end of `_lang_suffix` lost the tug-of-war.
#
# The fix has two parts:
#   1. STORY_SYSTEM stays English (it's the high-level role description
#      for the model; vendor-side fine-tuning is also English-biased),
#      but `_lang_suffix` now spells out exactly which value fields
#      must be Chinese, leaving the JSON *keys* in English so the
#      frontend `JSON.parse` still finds them.
#   2. STORY_USER is now language-aware via `_story_user_text()` — the
#      block of text immediately preceding the model's reply is in the
#      target language, which is the strongest pull on output language.

STORY_SYSTEM = (
    "You are an art-education assistant working inside a primary-school "
    "(grade 2) art lesson tool. Given a textbook artwork (sent as an image) "
    "and the lesson's pedagogical context, write an interactive story that "
    "an 7-8 year old can follow.\n"
    "Output: a single JSON object — no markdown fences, no preamble.\n"
    "The JSON keys MUST stay in English (part1 / choices / id / label / "
    "desc / part3 / designRationale / soundDesign). The language of the "
    "JSON *values* is dictated by the [Language requirement] block below."
)


def _story_user_text(language: str) -> str:
    """
    Localised user-turn text for `/api/story/generate` and
    `/api/story/stream`. JSON shape stays identical across locales so
    the frontend parser doesn't care which language was used.
    """
    if language == "zh":
        return (
            "请根据这幅画作为二年级学生创作一个互动故事。\n\n"
            "必须返回如下结构的 JSON（key 保持英文，value 用简体中文）:\n"
            "{\n"
            '  "part1": "<3-4 段开篇叙事，让孩子沉浸在画作的世界里>",\n'
            '  "choices": [\n'
            '    {"id": 0, "label": "<简短的行动标题>", "desc": "<用一句话描述这条路径>"},\n'
            '    {"id": 1, "label": "<简短的行动标题>", "desc": "<用一句话描述这条路径>"},\n'
            '    {"id": 2, "label": "<简短的行动标题>", "desc": "<用一句话描述这条路径>"}\n'
            "  ],\n"
            '  "part3": "<2-3 段延续选项 0 的故事后半段>",\n'
            '  "designRationale": "<2-3 句说明故事如何呼应这幅画作及其教学价值>",\n'
            '  "soundDesign": "<建议 Part 1、选择时刻、Part 3 使用的环境声与音乐>"\n'
            "}"
        )
    return (
        "Based on this artwork, generate an interactive story for grade-2 students.\n\n"
        "Return exactly this JSON structure:\n"
        "{\n"
        '  "part1": "<3-4 paragraph opening narrative immersing the child '
        'in the world of the painting>",\n'
        '  "choices": [\n'
        '    {"id": 0, "label": "<short action title>", "desc": "<one '
        'sentence describing this path>"},\n'
        '    {"id": 1, "label": "<short action title>", "desc": "<one '
        'sentence describing this path>"},\n'
        '    {"id": 2, "label": "<short action title>", "desc": "<one '
        'sentence describing this path>"}\n'
        "  ],\n"
        '  "part3": "<2-3 paragraph continuation following choice 0>",\n'
        '  "designRationale": "<2-3 sentences on how this story connects '
        'to the artwork and its educational value>",\n'
        '  "soundDesign": "<recommended ambient sounds and music for '
        'Part 1, the choice moment, and Part 3>"\n'
        "}"
    )


def _build_story_lesson_context(req: StoryRequest) -> str:
    """
    Return a `[本课信息]` block to inject into STORY_SYSTEM.

    v2: now includes the three-tier learning objectives, teaching focus,
    teaching difficulty, key art concepts, and per-artwork visual
    description + teacher-guide notes — every field the curriculum
    team encoded into the LKP. The model uses these to ground the
    story in the actual lesson rather than free-wheeling off the image.

    No hard constraints are written into the prompt about how each
    output field should be filled — the model is trusted to weave the
    pedagogy into the narrative naturally. The richer context is what
    moves the needle, not more rules.
    """
    if not req.lesson_id:
        return ""
    try:
        ctx = lesson_manager.build_executor_b_context(req.lesson_id, req.artwork_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc))

    lines = ["\n\n[本课信息 / Lesson context]"]
    lines.append(f"课程: 《{ctx['lesson_title_zh']}》")
    if ctx["unit_idea"]:
        lines.append(f"单元大概念: {ctx['unit_idea']}")
    if ctx["learning_task"]:
        lines.append(f"学习任务: {ctx['learning_task']}")

    # Three-tier objectives — render only the keys that exist.
    objs = ctx.get("learning_objectives") or {}
    if objs:
        lines.append("[学习目标]")
        if objs.get("know"):
            lines.append(f"- 知道: {objs['know']}")
        if objs.get("understand"):
            lines.append(f"- 理解: {objs['understand']}")
        if objs.get("do"):
            lines.append(f"- 能做: {objs['do']}")

    if ctx.get("teaching_focus"):
        lines.append(f"[教学重点] {ctx['teaching_focus']}")
    if ctx.get("teaching_difficulty"):
        lines.append(f"[教学难点] {ctx['teaching_difficulty']}")

    concepts = ctx.get("key_concepts") or []
    if concepts:
        lines.append(f"[关键艺术概念] {'、'.join(concepts)}")

    criteria = ctx.get("assessment_criteria") or []
    if criteria:
        lines.append("[评价标准]")
        for c in criteria:
            lines.append(f"- {c}")

    # Artwork-level context.
    art = ctx.get("artwork") or {}
    title = art.get("title_zh") or ""
    artist = art.get("artist_zh") or ""
    year = art.get("year")
    art_header_parts = [title]
    if artist:
        art_header_parts.append(artist)
    if year:
        art_header_parts.append(str(year))
    art_header = " / ".join(p for p in art_header_parts if p)
    if art_header:
        lines.append(f"\n[本画作] 《{art_header}》")
    if ctx.get("visual_description"):
        lines.append(f"画面描述: {ctx['visual_description']}")
    if ctx.get("teacher_guide_notes"):
        lines.append(f"教参解读: {ctx['teacher_guide_notes']}")
    if ctx.get("story_hint"):
        lines.append(f"故事方向提示: {ctx['story_hint']}")

    return "\n".join(lines)


def _story_payload(req: StoryRequest, stream: bool = False) -> dict:
    system = STORY_SYSTEM + _build_story_lesson_context(req) + _lang_suffix(req.language)
    return {
        "model": STORY_MODEL,
        "stream": stream,
        "messages": [
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{req.image_mime};base64,{req.image_base64}"
                        },
                    },
                    {"type": "text", "text": _story_user_text(req.language)},
                ],
            },
        ],
        "max_tokens": 2000,
    }


@app.post("/api/story/generate")
async def generate_story(req: StoryRequest):
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(
            f"{ARK_BASE}/chat/completions",
            json=_story_payload(req),
            headers=_ark_headers(),
        )

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"Ark API error: {resp.text}")

    raw = resp.json()["choices"][0]["message"]["content"].strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1].lstrip("json").strip() if len(parts) >= 2 else raw

    try:
        story = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(500, f"Could not parse story JSON: {exc}. Raw: {raw[:300]}")

    return story


@app.post("/api/story/stream")
async def stream_story(req: StoryRequest):
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    return StreamingResponse(
        _stream_ark(_story_payload(req, stream=True)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ════════════════════════════════════════════════════════════════════════
# 4. Animation generation — Executor C
# ════════════════════════════════════════════════════════════════════════


class AnimationSubmitRequest(BaseModel):
    image_base64: str
    image_mime: str = "image/jpeg"
    prompt: str = ""  # optional user refinement text
    # 🆕 LKP wiring
    lesson_id: Optional[str] = None
    artwork_id: Optional[str] = None


def _build_animation_prompt(user_prompt: str, lesson_mood: str = "") -> str:
    base = (
        "Transform this artwork into a gentle, looping animation. "
        "Add subtle life to the painting: soft wind moving trees or flowers, "
        "flowing water or drifting clouds where present, gradual light changes, "
        "and delicate atmospheric particles such as petals or dust motes. "
        "Preserve the original art style and colour palette throughout."
    )
    parts = [base]
    if lesson_mood.strip():
        parts.append(f"Mood: {lesson_mood.strip()}.")
    if user_prompt.strip():
        parts.append(f"Additional instruction: {user_prompt.strip()}")
    return "  ".join(parts)


@app.post("/api/animation/submit")
async def submit_animation(req: AnimationSubmitRequest):
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    # Inject LKP mood if a lesson_id is provided.
    lesson_mood = ""
    if req.lesson_id:
        try:
            ctx = lesson_manager.build_executor_c_context(req.lesson_id, req.artwork_id)
            lesson_mood = ctx["mood"]
        except ValueError:
            # Bad artwork_id — fall back to default mood, don't fail.
            pass

    payload = {
        "model": VIDEO_MODEL,
        "content": [
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{req.image_mime};base64,{req.image_base64}"
                },
            },
            {"type": "text", "text": _build_animation_prompt(req.prompt, lesson_mood)},
        ],
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{ARK_BASE}/contents/generations/tasks",
            json=payload,
            headers=_ark_headers(),
        )

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"Ark video API error: {resp.text}")

    data = resp.json()
    return {"task_id": data["id"], "status": data.get("status", "queued")}


@app.get("/api/animation/status/{task_id}")
async def get_animation_status(task_id: str):
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{ARK_BASE}/contents/generations/tasks/{task_id}",
            headers=_ark_headers(),
        )

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"Ark status API error: {resp.text}")

    data = resp.json()
    status = data.get("status", "unknown")

    result: dict = {"task_id": task_id, "status": status, "video_url": None, "error": None}

    if status == "succeeded":
        try:
            result["video_url"] = data["content"]["video_url"]
        except (KeyError, TypeError):
            result["error"] = "Unexpected response format from video API"
    elif status == "failed":
        result["error"] = (
            data.get("error", {}).get("message") or "Video generation failed"
        )

    return result


# ════════════════════════════════════════════════════════════════════════
# 5. Slide-design chatbot — Executor A (Parts 1/2/4/5)
# ════════════════════════════════════════════════════════════════════════


CHAT_SYSTEM = (
    "You are ArtBloom, a friendly AI assistant built into an art-education slide-design tool. "
    "You help teachers create engaging, visually appealing slide decks for art lessons. "
    "You can advise on colour theory, composition, layout, typography, image sourcing, "
    "lesson structure, and age-appropriate content.\n"
    "Reply rules:\n"
    "• Match the language of the user's latest message (Chinese↔Chinese, English↔English, pinyin counts as Chinese). "
    "Ignore any other language hint if it conflicts with what the user wrote.\n"
    "• Match the length to the question. Greetings or one-line questions get a one-line reply. "
    "Substantive design questions get 1–3 short paragraphs — never a wall of text.\n"
    "• Answer only what was asked. Do not proactively dump a full design proposal unless the teacher explicitly asks for one."
)


class ChatMsg(BaseModel):
    role: str  # "user" | "assistant"
    text: str


class ChatRequest(BaseModel):
    messages: list[ChatMsg]
    language: str = "en"
    # 🆕 LKP wiring — when both are set the active Part's prompt fragment
    # is appended to CHAT_SYSTEM. Anything else (Part 3/6/7, or no lesson)
    # falls back to the existing generic prompt — strictly backward-compatible.
    lesson_id: Optional[str] = None
    part_id: Optional[int] = None


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    # ── Build the system prompt ─────────────────────────────────────
    extra = ""
    if req.lesson_id and req.part_id in (1, 2, 4, 5):
        try:
            extra = lesson_manager.build_executor_a_context(req.lesson_id, req.part_id)
        except ValueError:
            extra = ""
    # Chat intentionally omits _lang_suffix — CHAT_SYSTEM tells the
    # model to match the user's input language. The UI toggle only
    # informs the *default* if the user message is ambiguous.
    default_lang_hint = (
        "\n(If the user message is ambiguous or empty, default to Simplified Chinese.)"
        if req.language == "zh"
        else "\n(If the user message is ambiguous or empty, default to English.)"
    )
    system = CHAT_SYSTEM + (("\n\n" + extra) if extra else "") + default_lang_hint

    history = [{"role": m.role, "content": m.text} for m in req.messages]
    payload = {
        "model": CHAT_MODEL,
        "messages": [{"role": "system", "content": system}] + history,
        "max_tokens": 800,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{ARK_BASE}/chat/completions",
            json=payload,
            headers=_ark_headers(),
        )

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"Ark API error: {resp.text}")

    reply = resp.json()["choices"][0]["message"]["content"].strip()
    return {"reply": reply}


# ════════════════════════════════════════════════════════════════════════
# 6. Story continuation — Executor B (continuation)
# ════════════════════════════════════════════════════════════════════════


# ── Continuation prompts ────────────────────────────────────────────────
#
# Same v2 fix as STORY_SYSTEM / STORY_USER: the system is English (role
# description), the user-turn is localised. Continuation returns plain
# text (not JSON) so there are no field-name pitfalls — the
# `_lang_suffix` is still appended to pin the language hard.

STORY_CONTINUE_SYSTEM = (
    "You are an art-education assistant working inside a primary-school "
    "(grade 2) art lesson tool. Given the first half of an interactive "
    "story and the child's chosen path, write a vivid, engaging "
    "continuation for a 7-8 year old. "
    "Respond with ONLY the continuation text — no JSON, no labels, no "
    "extra formatting, no markdown."
)


def _continue_user_text(req: "StoryContinueRequest") -> str:
    """Localised user-turn text for `/api/story/continue[/stream]`."""
    if req.language == "zh":
        return (
            "故事的前半段:\n"
            f"{req.part1}\n\n"
            f"孩子选择了:「{req.choice_label}」—— {req.choice_desc}\n\n"
            "请承接这个选择，写 2-3 段故事后半段。"
            "保持同样的想象力和叙事语气，多用感官细节，给故事一个令人满意的结尾。"
        )
    return (
        "First half of the story:\n"
        f"{req.part1}\n\n"
        f"The child chose: {req.choice_label} — {req.choice_desc}\n\n"
        "Write a 2-3 paragraph continuation that follows this choice. "
        "Keep the same imaginative tone, use sensory details, and bring "
        "the story to a satisfying close."
    )


class StoryContinueRequest(BaseModel):
    image_base64: str
    image_mime: str = "image/jpeg"
    part1: str
    choice_label: str
    choice_desc: str
    language: str = "en"
    # 🆕 LKP wiring
    lesson_id: Optional[str] = None
    artwork_id: Optional[str] = None


def _build_continue_lesson_context(req: StoryContinueRequest) -> str:
    """
    Same expansion as `_build_story_lesson_context` — we want the
    continuation to keep grounding in the LKP, not drift into generic
    storybook prose just because Part 3 narrowed to one branch.
    """
    if not req.lesson_id:
        return ""
    try:
        ctx = lesson_manager.build_executor_b_context(req.lesson_id, req.artwork_id)
    except ValueError:
        return ""

    lines = ["\n\n[本课信息 / Lesson context]"]
    lines.append(f"课程: 《{ctx['lesson_title_zh']}》")
    if ctx["unit_idea"]:
        lines.append(f"单元大概念: {ctx['unit_idea']}")
    if ctx["learning_task"]:
        lines.append(f"学习任务: {ctx['learning_task']}")

    objs = ctx.get("learning_objectives") or {}
    if objs:
        lines.append("[学习目标]")
        if objs.get("know"):
            lines.append(f"- 知道: {objs['know']}")
        if objs.get("understand"):
            lines.append(f"- 理解: {objs['understand']}")
        if objs.get("do"):
            lines.append(f"- 能做: {objs['do']}")

    if ctx.get("teaching_focus"):
        lines.append(f"[教学重点] {ctx['teaching_focus']}")
    concepts = ctx.get("key_concepts") or []
    if concepts:
        lines.append(f"[关键艺术概念] {'、'.join(concepts)}")
    if ctx.get("story_hint"):
        lines.append(f"故事方向提示: {ctx['story_hint']}")
    return "\n".join(lines)


def _continue_payload(req: StoryContinueRequest, stream: bool = False) -> dict:
    system = (
        STORY_CONTINUE_SYSTEM
        + _build_continue_lesson_context(req)
        + _lang_suffix(req.language)
    )
    return {
        "model": STORY_MODEL,
        "stream": stream,
        "messages": [
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{req.image_mime};base64,{req.image_base64}"
                        },
                    },
                    {"type": "text", "text": _continue_user_text(req)},
                ],
            },
        ],
        "max_tokens": 1000,
    }


@app.post("/api/story/continue")
async def continue_story(req: StoryContinueRequest):
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(
            f"{ARK_BASE}/chat/completions",
            json=_continue_payload(req),
            headers=_ark_headers(),
        )

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"Ark API error: {resp.text}")

    part3_text = resp.json()["choices"][0]["message"]["content"].strip()
    return {"part3": part3_text}


@app.post("/api/story/continue/stream")
async def stream_continue(req: StoryContinueRequest):
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    return StreamingResponse(
        _stream_ark(_continue_payload(req, stream=True)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ════════════════════════════════════════════════════════════════════════
# 7. Part 6 style transfer — Executor D
# ════════════════════════════════════════════════════════════════════════


STYLE_GEN_SYSTEM = (
    "You are an art education assistant. "
    "Given a student sketch and a teacher's lesson context, generate exactly 3 style transfer options. "
    "Each option has a short label and a detailed image generation prompt that will be sent to an AI image model. "
    "The prompts should reflect the lesson goals and transform the sketch accordingly. "
    "Respond ONLY with valid JSON — no markdown fences, no extra text."
)

STYLE_GEN_USER = """\
Lesson context provided by the teacher: {context}

Analyse the sketch above and generate 3 style transfer prompts that align with the lesson goals.

Return exactly this JSON:
{{
  "styles": [
    {{"label": "More exaggerated",     "prompt": "<detailed prompt for the image model>"}},
    {{"label": "More storytelling",    "prompt": "<detailed prompt for the image model>"}},
    {{"label": "More vibrant colours", "prompt": "<detailed prompt for the image model>"}}
  ],
  "lesson_summary": "<2-3 sentences summarising the lesson objectives and why these 3 styles were chosen>"
}}"""


class StyleGenerateRequest(BaseModel):
    image_base64: str
    image_mime: str = "image/jpeg"
    lesson_context: str = ""
    language: str = "en"
    # 🆕 LKP wiring — when present we skip the LLM and return the
    # lesson's predefined 3 styles directly (Branch A), or an empty
    # array marked Branch B for the "no Part-6" case.
    lesson_id: Optional[str] = None


@app.post("/api/part6/generate-styles")
async def generate_styles(req: StyleGenerateRequest):
    # ── LKP-driven shortcut: skip the LLM, return curated styles ────
    if req.lesson_id:
        try:
            ctx = lesson_manager.build_executor_d_context(req.lesson_id)
            if ctx["branch"] == "B":
                return {
                    "lesson_summary": ctx["lesson_summary"],
                    "styles": [],
                    "branch": "B",
                }
            return {
                "lesson_summary": ctx["lesson_summary"],
                "styles": [
                    {
                        "label": s["style_name_zh"],
                        "prompt": s["image_gen_prompt_template_en"],
                    }
                    for s in ctx["styles"]
                ],
                "branch": "A",
            }
        except ValueError:
            # Bad lesson_id — fall through to LLM-generated styles.
            pass

    # ── Original behaviour: ask the vision LLM ──────────────────────
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    payload = {
        "model": STORY_MODEL,
        "messages": [
            {"role": "system", "content": STYLE_GEN_SYSTEM + _lang_suffix(req.language)},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{req.image_mime};base64,{req.image_base64}"
                        },
                    },
                    {
                        "type": "text",
                        "text": STYLE_GEN_USER.format(context=req.lesson_context),
                    },
                ],
            },
        ],
        "max_tokens": 1500,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{ARK_BASE}/chat/completions", json=payload, headers=_ark_headers()
        )

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"Ark API error: {resp.text}")

    raw = resp.json()["choices"][0]["message"]["content"].strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1].lstrip("json").strip() if len(parts) >= 2 else raw

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(500, f"Could not parse styles JSON: {exc}. Raw: {raw[:300]}")

    return data


class StyleTransferRequest(BaseModel):
    image_base64: str
    image_mime: str = "image/jpeg"
    prompt: str
    # 🆕 LKP wiring — accepted but currently only used for log tagging.
    lesson_id: Optional[str] = None


@app.post("/api/part6/transfer")
async def style_transfer(req: StyleTransferRequest):
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    if req.lesson_id:
        print(f"[part6] transfer for lesson {req.lesson_id}", flush=True)

    payload = {
        "model": IMAGE_MODEL,
        "prompt": req.prompt,
        "image": f"data:{req.image_mime};base64,{req.image_base64}",
        "n": 1,
        "size": "2048x2048",
        "response_format": "url",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{ARK_BASE}/images/generations", json=payload, headers=_ark_headers()
        )

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"Image generation API error: {resp.text}")

    data = resp.json()
    try:
        image_url = data["data"][0]["url"]
    except (KeyError, IndexError, TypeError):
        raise HTTPException(500, f"Unexpected image response format: {str(data)[:300]}")

    return {"image_url": image_url}


# ════════════════════════════════════════════════════════════════════════
# 8. Part 7 commenter — Executor A (Part 7)
# ════════════════════════════════════════════════════════════════════════


class Part7CommentRequest(BaseModel):
    student_work_base64: str
    student_work_mime: str = "image/jpeg"
    lesson_id: str
    language: str = "zh"
    student_note: Optional[str] = None


class Part7CommentResponse(BaseModel):
    feedback_text: str
    word_count: int
    dimensions_covered: list[str]
    timestamp: str


@app.post("/api/part7/comment", response_model=Part7CommentResponse)
async def part7_comment(req: Part7CommentRequest):
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    # 1. Load LKP context
    try:
        ctx = lesson_manager.build_part7_comment_context(req.lesson_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc))

    # 2. Build system prompt
    min_w, max_w = ctx["word_count"]
    dimensions_str = "、".join(ctx["dimensions"]) if ctx["dimensions"] else ""
    objectives_str = "\n".join(
        f"- {k}: {v}" for k, v in (ctx["learning_objectives"] or {}).items()
    )
    concepts_str = "、".join(ctx["key_concepts"]) if ctx["key_concepts"] else ""

    extras = [
        ctx["system_prompt"],
        f"\n[本课] 《{ctx['lesson_title_zh']}》— {ctx['learning_task_zh']}",
    ]
    if objectives_str:
        extras.append(f"\n[学习目标]\n{objectives_str}")
    if concepts_str:
        extras.append(f"\n[关键概念] {concepts_str}")
    if dimensions_str:
        extras.append(f"\n[评价维度] 请在评论中覆盖：{dimensions_str}")
    extras.append(f"\n[字数] {min_w}-{max_w} 字")
    extras.append(
        f"\n[语气] {ctx['tone']}（warm=温暖鼓励 / professional=专业客观 / playful=活泼有趣）"
    )
    if req.language == "en":
        extras.append("\nWrite the feedback in English.")

    system_prompt = "\n".join(extras)

    # 3. Build user content (image + optional student note)
    user_text = (
        f"请基于以上学生作品和本课的学习目标，给出 {min_w}-{max_w} 字的鼓励性反馈。"
        if req.language == "zh"
        else f"Please give a warm, {min_w}-{max_w}-word feedback based on this student's artwork and the lesson's learning objectives."
    )
    if req.student_note:
        user_text += (
            f"\n\n学生自评：{req.student_note}"
            if req.language == "zh"
            else f"\n\nStudent's self-reflection: {req.student_note}"
        )

    user_content = [
        {
            "type": "image_url",
            "image_url": {
                "url": f"data:{req.student_work_mime};base64,{req.student_work_base64}"
            },
        },
        {"type": "text", "text": user_text},
    ]

    # 4. Call vision LLM
    payload = {
        "model": STORY_MODEL,  # vision-capable Doubao
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.7,
        "max_tokens": 500,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{ARK_BASE}/chat/completions",
                json=payload,
                headers=_ark_headers(),
            )
    except httpx.TimeoutException:
        raise HTTPException(504, "LLM timeout")

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"Ark API error: {resp.text}")

    feedback_text = resp.json()["choices"][0]["message"]["content"].strip()

    # 5. Post-process — Chinese counts by character; English by whitespace.
    if req.language == "en":
        word_count = len(feedback_text.split())
    else:
        # Strip whitespace + punctuation for a cleaner Chinese count.
        word_count = sum(1 for ch in feedback_text if not ch.isspace())

    dimensions_covered = [d for d in ctx["dimensions"] if d in feedback_text]

    return Part7CommentResponse(
        feedback_text=feedback_text,
        word_count=word_count,
        dimensions_covered=dimensions_covered,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


# ════════════════════════════════════════════════════════════════════════
# 9. TTS
# ════════════════════════════════════════════════════════════════════════


class TTSRequest(BaseModel):
    text: str
    voice_id: str = "zh-CN-XiaoxiaoNeural"


@app.get("/api/tts/voices")
async def get_tts_voices():
    return {"voices": TTS_VOICES}


@app.post("/api/tts")
async def text_to_speech(req: TTSRequest):
    try:
        communicate = edge_tts.Communicate(req.text, req.voice_id)
        audio = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio += chunk["data"]
        return Response(content=bytes(audio), media_type="audio/mpeg")
    except Exception as e:
        print(f"[TTS] edge-tts error: {e}", flush=True)
        raise HTTPException(500, f"TTS failed: {e}")
