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
import re
from datetime import datetime, date, timezone
from pathlib import Path
from typing import Any, AsyncIterator, Optional

import edge_tts
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response, StreamingResponse
from pydantic import BaseModel

# 2026-05 — boto3 is optional at import time so the backend still
# starts when R2 credentials aren't configured (e.g. CI / local dev
# without secrets). The /api/state/* endpoints below return 503 in
# that case so the frontend can fall back to localStorage-only mode.
try:
    import boto3
    from botocore.client import Config as _BotoConfig
    from botocore.exceptions import ClientError as _BotoClientError
    _BOTO3_AVAILABLE = True
except ImportError:  # pragma: no cover — defensive
    boto3 = None
    _BotoConfig = None
    _BotoClientError = Exception
    _BOTO3_AVAILABLE = False

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
            "designRationale。\n"
            "- JSON key 保持英文不变（part1 / choices / label / desc / part3 / "
            "designRationale）—— 不要翻译这些字段名。\n"
            "- 不要混用英文单词、不要保留任何英文词条；外语人名/地名用中文译名。"
        )
    return (
        "\n\n[Language requirement]\n"
        "- Output language: English.\n"
        "- All JSON values must be written in English (part1, choices.label, "
        "choices.desc, part3, designRationale).\n"
        "- Keep JSON keys (part1, choices, label, desc, part3, designRationale) "
        "in English."
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
    "desc / part3 / designRationale). The language of the JSON *values* "
    "is dictated by the [Language requirement] block below."
)


def _story_user_text(language: str) -> str:
    """
    Localised user-turn text for `/api/story/generate` and
    `/api/story/stream`. JSON shape stays identical across locales so
    the frontend parser doesn't care which language was used.

    v3 (2026-05): added hard structural rules for the story *body*
    (part1 / choices / part3), not just designRationale. The previous
    prompt only said "3-4 paragraphs" which let the model write
    generic storybook prose that ignored the LKP's learning
    objectives. The new rules force:
      - part1 / part3 word counts aligned to 180-200 Chinese chars
        (≈120-150 English words) so the two halves read at the same
        pace and the TTS narration feels balanced
      - part1 must use ≥2 visual keywords from [本画作] (lifts the
        story off the page and into the actual painting)
      - 3 choices must each map to a distinct teaching facet of the
        lesson (composition / detail / association / exaggeration …)
        — no parallel "left/right/forward" branches
      - part3 must land back on the lesson's "do" objective so the
        story has educational closure, not just narrative closure
    """
    if language == "zh":
        return (
            "请根据这幅画作为二年级学生创作一个互动故事。\n\n"
            "必须返回如下结构的 JSON（key 保持英文，value 用简体中文）:\n"
            "{\n"
            '  "part1": "<开篇叙事，2-3 段>",\n'
            '  "choices": [\n'
            '    {"id": 0, "label": "<简短的行动标题>", "desc": "<用一句话描述这条路径>"},\n'
            '    {"id": 1, "label": "<简短的行动标题>", "desc": "<用一句话描述这条路径>"},\n'
            '    {"id": 2, "label": "<简短的行动标题>", "desc": "<用一句话描述这条路径>"}\n'
            "  ],\n"
            '  "part3": "<延续选项 0 的故事后半段，2-3 段>",\n'
            '  "designRationale": "<按 [设计理念字段生成要求] 中的 3 段结构生成>"\n'
            "}\n\n"
            "[故事正文生成要求] 严格遵守以下硬约束。\n\n"
            "【part1 · 开篇,3-4 段】\n"
            "- 字数:严格 180-200 个中文字(不含标点)。低于 170 或超过 210 视为不合格。\n"
            "- 必须包含 [本画作] 的「画面描述」中至少 2 个视觉关键词原句"
            "(如「蜿蜒」「长长的」「桃花林」「溪水」等),让孩子在故事中真的看见这幅画。\n"
            "- 必须体现 [学习任务] 中的动词(如「依形创编」对应:先呈现一个长形的具体物,"
            "再由这个形状引出联想)。\n"
            "- 7-8 岁口语化,多用感官细节;不要堆砌成语;不要透露教学概念名词"
            "(像「夸张」「联想」「构图」不要直接出现,要让学生在情节里感受到)。\n\n"
            "【choices · 3 个分支】\n"
            "- label 每条 4-10 个中文字,desc 每条不超过 30 个中文字。\n"
            "- 3 个分支必须各自对应 [关键艺术概念] 中不同的 3 个侧面,例如:\n"
            "  分支 A → 关注画面构图/形式(对应『构图』『形式与内容的关系』)\n"
            "  分支 B → 关注主体细节(对应『主体与背景』『细节表现』)\n"
            "  分支 C → 展开联想(对应『联想』)\n"
            "  分支 D → 尝试夸张(对应『夸张』)\n"
            "- 你必须从本课实际给出的 [关键艺术概念] 中任选 3 个不同侧面来设计 3 条分支,"
            "禁止 3 条都是平行的剧情走向(例如「往左走/往右走/往前走」)。\n"
            "- 每条分支应当让备课老师一眼识别出它对应哪个艺术概念。\n\n"
            "【part3 · 后半段,2-3 段,承接 choice 0】\n"
            "- 字数:严格 180-200 个中文字(不含标点)。**必须与 part1 字数对齐**,"
            "低于 170 或超过 210 视为不合格。\n"
            "- 续写时保持同样的想象力与叙事语气,多用感官细节。\n"
            "- 结尾必须自然落回 [学习目标] 中「能做」层的动作"
            "(即学生在本课要动手做的事),让故事有教学闭环,而不是只有剧情闭环。\n"
            "- 禁止使用「同学们」「小朋友们」等课堂集体称谓打破第四面墙。\n"
        )
    return (
        "Based on this artwork, generate an interactive story for grade-2 students.\n\n"
        "Return exactly this JSON structure:\n"
        "{\n"
        '  "part1": "<3-4 paragraph opening narrative>",\n'
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
        'to the artwork and its educational value>"\n'
        "}\n\n"
        "[Story body requirements] Follow these hard rules:\n\n"
        "[part1 · opening, 3-4 short paragraphs]\n"
        "- Word count: approximately 120-150 English words. Stay close to this band — "
        "shorter than 110 or longer than 160 is not acceptable.\n"
        "- Must include at least 2 concrete visual keywords from the artwork's "
        "[visual_description] (e.g. 'winding stream', 'long scroll', 'peach blossoms') "
        "so the child literally sees the painting through the story.\n"
        "- Must enact the verb in the lesson [learning_task] (e.g. if the task is "
        "'invent stories from long-paper shapes', start by showing a concrete long "
        "object and then let association lead the story).\n"
        "- Voice: spoken-language for a 7-8 year old, rich in sensory detail. Do NOT "
        "name teaching concepts directly ('exaggeration', 'composition', 'association' "
        "etc. should be *felt* through the plot, not stated).\n\n"
        "[choices · 3 branches]\n"
        "- Each label: 2-6 words. Each desc: ≤ 20 words.\n"
        "- The 3 branches must each map to a DIFFERENT facet of the lesson's "
        "[key_art_concepts], not three parallel plot directions ('go left / go right / "
        "go forward'). Examples of distinct facets a teacher should be able to "
        "recognise: composition / main-subject details / association / exaggeration.\n"
        "- A teacher should be able to identify at a glance which concept each branch "
        "is foregrounding.\n\n"
        "[part3 · continuation of choice 0, 2-3 short paragraphs]\n"
        "- Word count: approximately 120-150 English words. **Must match part1's word "
        "count band** so the two halves narrate at the same pace.\n"
        "- Keep the same imaginative tone and sensory richness as part1.\n"
        "- The ending MUST loop back to the 'do' (能做) tier of [learning_objectives] — "
        "i.e. the action the student will perform in this lesson — so the story has "
        "pedagogical closure, not just narrative closure.\n"
        "- Do NOT break the fourth wall with classroom collectives ('students', 'kids').\n"
    )


# ── designRationale spec (curriculum-anchored, 3-paragraph) ─────────────
#
# Per pilot feedback (2026-05): the AI's designRationale was too short
# and too generic — teachers couldn't see how the story actually mapped
# to the unit big idea, three-tier objectives, or key art concepts in
# the LKP. The curriculum team handed over a specific spec; the block
# below ports it into the system prompt so the model treats
# designRationale as a structured field, not free narration.
#
# 2026-05-28 revision: shortened from 5 paragraphs / 330-360 chars to
# 3 paragraphs / 240-260 chars. The 5th "invitation to iterate" para
# was cut (teachers found it too long for the right-side panel), and
# the original §1 (unit big idea / learning task) + §2 (three-tier
# objectives) were merged into a single §1 (total ~90 chars). The
# remaining §2 (teaching focus / difficulty / key concepts) and §3
# (3 branches → teaching facets) keep their substance at ~90 and ~70
# chars respectively.
#
# Implementation notes:
#   • ZH spec is the canonical copy. Hard char range stays in the
#     prompt (we accept the ~75% one-shot success rate instead of a
#     2-step polish that doubles latency).
#   • EN mode keeps the legacy 2-3 sentence requirement (Q3 = option
#     C) — the pilot is grade-2 Chinese, EN is for demo/screenshot.

def _design_rationale_spec(language: str) -> str:
    if language != "zh":
        # English: keep the legacy short version. No structural rules.
        return ""
    return """

[设计理念(designRationale) 字段生成要求]

在主故事 JSON 输出中，designRationale 字段必须严格遵守以下规范。

字数:严格 240-260 个中文字(不含标点)。低于 230 或超过 270 视为不合格。

读者:本课的备课教师。语气专业、平实，不需要鼓励性辞令，不要写"这个故事会让孩子很喜欢"这类主观判断。

内容结构(按此顺序，共 3 段，段间用 \\n\\n 空行分隔):

【第 1 段 · 单元大观念、学习任务与三层学习目标,约 90 字】
开篇 1-2 句话点明本故事与 [本课信息] 中"单元大概念"和"学习任务"的对应关系，必须直接引用 [本课信息] 给出的"单元大概念"原句和"学习任务"原句中的关键词，不要用自己的话改写。随后分别说明本故事在哪些具体情节、画面、人物选择上支撑 [学习目标] 中的"知道"、"理解"、"能做"这三层目标，每层目标至少对应故事中一个具体情节锚点，不能笼统说"故事呼应学习目标"。

【第 2 段 · 回应教学重点、教学难点、关键概念,约 90 字】
明确指出本故事如何呼应:
(a) [教学重点] 中的具体动作（提取关键词）
(b) [教学难点] 的攻克路径（故事的哪个场景帮助突破难点）
(c) [关键艺术概念] 分别在哪个具体细节体现，每个概念至少 1 处对应

【第 3 段 · 3 个分支对应教学不同侧面,约 70 字】
说明 part1 后的 3 个分支选择各自对应本课的哪个具体侧面，让老师明白每个分支引导学生关注的角度不同，可在教学中根据课堂氛围选用。

写作约束(适用于全部 3 段):
- 不要使用"通过""旨在""旨在让""有助于""能够"等空泛动词，改用具体动词(如"将……转化为""把……的概念落在……上""借助……场景呈现……""锚定在……")
- 不要重复故事内容本身(老师已读过 part1 和 choices)，只解释设计意图
- 不要出现"我希望""我想要""建议老师""教师可以"等第一人称或指令性表达
- 不要使用 markdown 格式(无标题、无列表、无加粗)，纯段落文字
- 教材教参中出现的术语（如"审美感知""文化理解""艺术表现""创意实践""通感""依形创编"）可以使用，但不要堆砌
- 必须引用 [本课信息] 中给出的实际目标和概念原文，不要泛泛而谈

输出位置:designRationale 字段(故事主 JSON 的一部分)，保持现有 JSON schema 不变。各段之间用 \\n\\n 分隔(JSON 字符串里写成 \\n\\n)。"""


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
    system = (
        STORY_SYSTEM
        + _build_story_lesson_context(req)
        + _design_rationale_spec(req.language)
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
                    {"type": "text", "text": _story_user_text(req.language)},
                ],
            },
        ],
        # 2026-05: bumped 2000 → 3500 after the v3 prompt rewrite added
        # the [故事正文生成要求] block AND the 3-段 designRationale spec.
        # The combined output budget now needs to cover:
        #   • part1   180-200 中文字  (≈ 300-400 tokens)
        #   • choices ~50 中文字       (≈ 80-120 tokens)
        #   • part3   180-200 中文字  (≈ 300-400 tokens)
        #   • designRationale 330-360 中文字 (≈ 550-700 tokens)
        #   • JSON keys/punctuation overhead (~150 tokens)
        # Total ≈ 1400-1800 tokens of pure content, but Doubao often
        # overshoots the per-field char targets by 10-30% and we
        # need headroom for any reasoning tokens. Truncating the
        # JSON mid-string was producing "Unexpected end of JSON input"
        # in the frontend; 3500 gives ~ 2× headroom.
        "max_tokens": 3500,
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


def _build_animation_prompt(
    user_prompt: str,
    lesson_mood: str = "",
    animation_brief: str = "",
) -> str:
    """Compose the final text prompt sent to Doubao Seedance.

    Preference order:
      1. If the LKP supplies a per-artwork ``animation_brief`` (English,
         curriculum-authored), use it verbatim. This is the only path
         that gives the video model truly artwork-specific guidance —
         it was written by the curriculum team after looking at the
         picture, so it describes the actual visual motion.
      2. Otherwise fall back to a generic "gentle looping life" base
         plus the lesson-level ``mood`` string. Older LKPs without a
         brief still work this way.

    Teacher's free-text adjustment (``user_prompt``) is always appended
    last so that any custom request overrides the defaults.

    The video model does **not** generate audio, so we deliberately
    never include music or sound-effect language — those words just
    waste tokens and occasionally cause the model to render text/music
    notation into the picture.
    """
    if animation_brief.strip():
        parts = [
            animation_brief.strip(),
            "Preserve the original artwork's style, colour palette, and composition.",
        ]
    else:
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
        parts.append(f"Teacher's adjustment: {user_prompt.strip()}")
    return "  ".join(parts)


@app.post("/api/animation/submit")
async def submit_animation(req: AnimationSubmitRequest):
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    # Inject LKP brief / mood if a lesson_id is provided.
    lesson_mood = ""
    animation_brief = ""
    if req.lesson_id:
        try:
            ctx = lesson_manager.build_executor_c_context(req.lesson_id, req.artwork_id)
            lesson_mood = ctx["mood"]
            # Prefer the English brief (Doubao Seedance is multilingual
            # but tokenises English more efficiently). If only a 中文
            # brief is authored, fall back to that — still beats the
            # generic mood string.
            animation_brief = ctx.get("animation_brief_en") or ctx.get("animation_brief_zh") or ""
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
            {
                "type": "text",
                "text": _build_animation_prompt(req.prompt, lesson_mood, animation_brief),
            },
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


# 2026-05 — The age-phrasing fallback bullet below uses Chinese quotes
# (「」) so we don't need to escape inner ASCII " inside the
# double-quoted Python string.
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
    "• Answer only what was asked. Do not proactively dump a full design proposal unless the teacher explicitly asks for one.\n"
    # 2026-05 — Pilot feedback: without an explicit year-group anchor
    # the model would self-hedge with vague "lower-grade / upper-grade",
    # "K-12 art", "students of different ages" phrasing. When a
    # `lesson_id` is supplied we inject a hard per-grade constraint
    # below via `_age_phrasing_constraint()`. This bullet is the
    # fallback for freeform projects where no lesson is bound.
    "• When you discuss 「year-group / grade / age band」, either use the EXACT grade made clear in the conversation context "
    "(e.g. 「二年级」) or omit the band altogether. NEVER write 「低龄段 / 高龄段 / 中高龄段 / 中小学 / 不同年龄段」 or list younger-vs-older alternatives. "
    "NEVER quote raw ages such as 「7-8 岁」 — always use the grade label."
)


# ── Per-grade Chinese ordinals for prompt injection ─────────────────────
_GRADE_ZH: dict[int, str] = {
    1: "一年级",
    2: "二年级",
    3: "三年级",
    4: "四年级",
    5: "五年级",
    6: "六年级",
}


def _age_phrasing_constraint(lesson_id: Optional[str], language: str) -> str:
    """Hard constraint appended to the chat system prompt when an LKP
    is bound, telling the model to stick to ONE grade label and never
    hedge across age bands.

    Returns ``""`` whenever we can't resolve a grade so legacy /
    freeform projects keep the old behaviour (still guarded by the
    fallback bullet in CHAT_SYSTEM above).

    Origin (2026-05): teachers reported the chatbot replying with
    "如果是低龄段…如果是中高龄段…" — model self-hedging because the
    LKP per-part fragment alone didn't pin a year-group. Pinning here
    via the existing ``LessonSeedData.grade`` field (already in every
    shipping LKP) keeps the data flow clean.

    NOTE: this function returns multi-line strings full of Chinese
    quote brackets (「」) and ASCII double quotes. To avoid escaping
    headaches we use triple-quoted f-strings — Python handles the
    nesting transparently.
    """
    if not lesson_id:
        return ""
    try:
        seed = lesson_manager.load(lesson_id)
    except ValueError:
        return ""

    grade = seed.grade
    if not grade or grade not in _GRADE_ZH:
        return ""

    grade_zh = _GRADE_ZH[grade]
    grade_en = f"Grade {grade}"

    if language == "zh":
        return f"""

[学段措辞约束 / 必须遵守]
• 本节课固定面向人教版小学{grade_zh}学生，老师正在为同一个班的{grade_zh}学生备课。
• 涉及受众时**统一**用「{grade_zh}」或「{grade_zh}学生」称呼。
• 严禁出现「低龄段 / 高龄段 / 中高龄段」「不同年龄段」「分年龄段」「中小学美术」「依年龄段调整」「如果是…段就…」等模糊或对比性年龄措辞；也不要列出「低龄/高龄」两套方案让老师二选一。
• 严禁写出具体年龄数字（如「7-8 岁」「8 岁」「8-9 岁」）或「儿童 / 小朋友」这种学段无关的称呼，统一替换为「{grade_zh}」。
• 直接给一套针对{grade_zh}的建议；不需要解释更小 / 更大年级的学生会怎样。"""
    return f"""

[Age-phrasing constraints / hard rules]
• This lesson is fixed for primary-school {grade_en} students; the teacher is preparing for a single {grade_en} class.
• Always refer to the audience as `{grade_en} students` — never `younger / older students`, `lower / upper primary`, `K-12 art`, or `different age groups`.
• Never quote raw ages (`7-8 years old`, `8 yo`, etc.). Always use `{grade_en}`.
• Give exactly one recommendation tuned to {grade_en}; do not list alternatives for other year-groups."""



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
    # 2026-05 — When a lesson is bound, pin the year-group so the
    # model stops hedging across age bands (see the helper docstring).
    age_block = _age_phrasing_constraint(req.lesson_id, req.language)
    # Chat intentionally omits _lang_suffix — CHAT_SYSTEM tells the
    # model to match the user's input language. The UI toggle only
    # informs the *default* if the user message is ambiguous.
    default_lang_hint = (
        "\n(If the user message is ambiguous or empty, default to Simplified Chinese.)"
        if req.language == "zh"
        else "\n(If the user message is ambiguous or empty, default to English.)"
    )
    system = (
        CHAT_SYSTEM
        + (("\n\n" + extra) if extra else "")
        + age_block
        + default_lang_hint
    )

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
    """Localised user-turn text for `/api/story/continue[/stream]`.

    v3 (2026-05): aligned to the new part1/part3 word-count band
    (180-200 ZH chars / ~120-150 EN words) used by the main
    `/api/story/stream`. Also requires the continuation to land back
    on the lesson's "do" (能做) objective so the story has a
    pedagogical close, not just a narrative close.
    """
    if req.language == "zh":
        return (
            "故事的前半段:\n"
            f"{req.part1}\n\n"
            f"孩子选择了:「{req.choice_label}」—— {req.choice_desc}\n\n"
            "请承接这个选择，写 2-3 段故事后半段，严格遵守以下要求:\n"
            "- 字数:严格 180-200 个中文字(不含标点),与前半段字数对齐。"
            "低于 170 或超过 210 视为不合格。\n"
            "- 保持同样的想象力与叙事语气,多用感官细节。\n"
            "- 结尾必须自然落回本课 [学习目标] 中「能做」层的动作"
            "(即学生在本课要动手做的事),让故事有教学闭环,而不是只有剧情闭环。\n"
            "- 不要使用「同学们」「小朋友们」等课堂集体称谓打破第四面墙。\n"
            "- 只输出故事文本,不要写 JSON、标签或额外说明。"
        )
    return (
        "First half of the story:\n"
        f"{req.part1}\n\n"
        f"The child chose: {req.choice_label} — {req.choice_desc}\n\n"
        "Write a 2-3 paragraph continuation that follows this choice. "
        "Hard requirements:\n"
        "- Word count: approximately 120-150 English words. **Must match the "
        "first half's word count band** so the two halves narrate at the same pace.\n"
        "- Keep the same imaginative tone and sensory richness.\n"
        "- The ending MUST loop back to the 'do' tier of the lesson's learning "
        "objectives — i.e. the action the student will perform in this lesson — "
        "so the story has pedagogical closure, not just narrative closure.\n"
        "- Do NOT break the fourth wall with classroom collectives "
        "('students', 'kids').\n"
        "- Output only the continuation text — no JSON, labels, or extra notes."
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
        # 180-200 ZH chars ≈ 300-400 tokens. 1500 gives plenty of
        # headroom for the new word-count-constrained output without
        # ever truncating mid-paragraph.
        "max_tokens": 1500,
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


# ────────────────────────────────────────────────────────────────────────
# 6b. Story revision chat — Executor B (iterative refinement)
#
# Pilot 2026-05: once Part 3 has a story, teachers want to discuss it
# with the AI ("what if the third branch was less scary?" / "rewrite
# part1 with more sensory detail") instead of regenerating from
# scratch and losing the existing draft. This endpoint sits between
# free-form chat (no story output) and `/api/story/stream` (full
# regenerate) — it returns BOTH a conversational reply AND an
# optional revised story JSON that the frontend can apply on demand.
# ────────────────────────────────────────────────────────────────────────


# ── Phase blocks (2026-05) ──────────────────────────────────────────────
# Story chat is now phase-aware. The frontend passes
# `selected_choice_id`:
#   • None  → Phase A — only part1 + choices exist, model must NOT
#             touch part3 and must not invent continuations.
#   • int   → Phase B — at least one continuation is already drafted;
#             the model MUST first ask "clarify-before-edit" if the
#             teacher's latest message is ambiguous about WHICH slice
#             they want changed (part1 / choices / current branch's
#             part3 / a mix).

_STORY_CHAT_PHASE_A = (
    "[CONVERSATION PHASE — A]\n"
    "老师还没有点击 part2 的任何一个互动选项，因此目前 *没有* 生成 part3 后半段。\n"
    "本阶段你 *只可以* 协助老师修改以下两部分：\n"
    "  • part1 — 故事前半段；\n"
    "  • choices — 3 个互动选项（label + desc）。\n"
    "\n"
    "硬约束：\n"
    "  • 严禁生成或改写 part3。若返回 revised_story，必须把 part3 设为空字符串 \"\"，\n"
    "    designRationale 原样回填（或同步修改其中描述 part1/choices 的段落）。\n"
    "  • 不要主动询问老师选哪条分支续写——这是 Part 2 互动按钮的职责。\n"
    "  • 如果老师隐含要改 part3（例如「把后半段写得更紧凑」），用一句话告知：\n"
    "    『请先在「故事预览」中点击 part2 的一个互动选项，生成后半段后我们再讨论怎么改这部分。』\n"
    "    并维持 revised_story = null。\n"
    "\n"
    "MODE A / MODE B 判定（仅作用于 part1 与 choices）：\n"
    "  • 老师问问题、探讨思路、给模糊建议 → MODE A，revised_story = null。\n"
    "  • 老师明确要改 part1 或 choices 的具体内容 → MODE B，返回 revised_story（part3 留空）。"
)

_STORY_CHAT_PHASE_B = (
    "[CONVERSATION PHASE — B]\n"
    "老师已经在「故事预览」中点击过 part2 的一个互动选项（selected_choice_id 见下方上下文），\n"
    "因此 current_story 中已经存在至少一条 part3 续篇（continuations 字典）。\n"
    "\n"
    "在本阶段，老师可能想改动以下四种之一：\n"
    "  ① 故事前半段（即 part1）；\n"
    "  ② 三个互动选项文案（即 choices 的 label/desc）；\n"
    "  ③ 当前正在看的那条分支（id = selected_choice_id）的后半段（即 part3）；\n"
    "  ④ 重新生成整篇故事（part1 + choices + 当前分支 part3 + designRationale 全部重写）。\n"
    "\n"
    "硬约束 —— 先澄清，后修改：\n"
    "  • 如果老师在最新一条消息里 **已经明确指出** 要改哪一部分（例：「把前半段写得更细腻」、\n"
    "    「第三个互动选项太血腥，换温和的」、「分支 2 的后半段结尾呼应一下『能做』」），\n"
    "    → 直接进入 MODE B 输出 revised_story（仅改指定部分；其他字段原样回填）。\n"
    "  • 如果老师 **没有明确指明修改对象**（例：「这段不太行」「太干了」「能不能改改」「让故事更有想象力」），\n"
    "    → 必须先用 MODE A 反问澄清。回复时:\n"
    "        - `reply` 简短，不超过一句话（例如「请问您想修改哪一部分呢？」）。\n"
    "          不要在 `reply` 里再列出 A/B/C/D 任何文字，前端会以按钮形式展示。\n"
    "        - 必须在同一个 JSON 中输出 `clarify_options` 字段，**完全照抄**以下 4 个字符串、\n"
    "          顺序固定、不要改字、不要加序号/字母前缀：\n"
    "             [\n"
    "               \"改故事前半段\",\n"
    "               \"改三个互动选项文案\",\n"
    "               \"改当前分支的后半段\",\n"
    "               \"重新生成故事\"\n"
    "             ]\n"
    "        - 这一轮 revised_story = null、revised_continuations = {}。\n"
    "    严禁把 part1 / part2 / part3 这类英文 token 写进 `reply` 或 `clarify_options`，\n"
    "    严禁在没有明确目标时擅自输出修改稿。\n"
    "\n"
    "  • 当老师点击「重新生成故事」按钮（最新一条 user 消息文本为「重新生成故事」时），\n"
    "    → MODE B 重写 part1、choices 与当前分支 part3，并同步更新 designRationale，\n"
    "      保持画作和教学锚点不变；revised_continuations 包含当前分支 id 的新文本。\n"
    "\n"
    "MODE B 字段回填规则（极重要）：\n"
    "  • revised_story 必须仍含 part1 / choices / part3 / designRationale 四个字段；\n"
    "    凡是老师 *没有* 要求改的字段，必须从 current_story 逐字回填，切勿『顺便』重写。\n"
    "  • 如果老师要改某条 part3 续篇（即 ③ 或 ④ 含 part3），把改后的 part3 文本\n"
    "    *同时* 放在 revised_story.part3 中（用于显示）和 revised_continuations 字典中：\n"
    "        \"revised_continuations\": {{ \"<被修改的 choice id>\": \"<新的 part3 文本>\" }}\n"
    "    revised_continuations 仅含被改的那条分支 id；其他分支续篇不要包含。\n"
    "  • 如果老师没改任何 part3，revised_continuations 为 {{}} 或省略。\n"
    "\n"
    "MODE B 还**必须**返回 `revision_scope` 字段（数组），明确告诉前端这一轮真正改了\n"
    "哪几个字段。前端将据此决定预览卡只渲染哪几段，避免老师误以为没要求改的部分被一并改了。\n"
    "按钮 / 自由文本 → scope 映射（严格遵守）：\n"
    "  - 老师点击「改故事前半段」/ 自由文本只针对 part1 → revision_scope = [\"part1\"]\n"
    "  - 老师点击「改三个互动选项文案」/ 自由文本只针对 choices → revision_scope = [\"choices\"]\n"
    "  - 老师点击「改当前分支的后半段」/ 自由文本只针对当前分支 part3 → revision_scope = [\"part3\"]\n"
    "  - 老师点击「重新生成故事」 → revision_scope = [\"part1\", \"choices\", \"part3\", \"designRationale\"]\n"
    "  - 老师同时要求改 part1 和 choices → revision_scope = [\"part1\", \"choices\"]\n"
    "\n"
    "极其重要 —— designRationale 默认**不**进 scope：\n"
    "  • 除非 revision_scope 显式包含 \"designRationale\"（仅「重新生成故事」会出现），\n"
    "    否则 revised_story.designRationale 必须 **完全照抄** current_story.designRationale，\n"
    "    一个字都不能改。不要因为 part1 或 choices 改了就顺手"
    "升级设计理由的描述。\n"
    "  • 老师对设计理由不感兴趣的改动，AI 也不应当主动重写它。\n"
    "\n"
    "字段级约束沿用故事生成规范（仅作用在 revision_scope 包含的字段上）：\n"
    "  • part1 / part3 严格 180-200 中文字（≈ 120-150 EN words），两半段字数对齐；\n"
    "  • 3 个 choices 各对应不同教学侧面；\n"
    "  • part3 结尾必须回扣 [学习目标] 的「能做」层；\n"
    "  • designRationale 遵循 3 段 240-260 字规范（仅当它在 scope 内被重写时）。"
)


STORY_CHAT_SYSTEM = (
    "You are an art-education assistant having a conversation with a "
    "grade-2 art teacher who is iterating on an interactive story you "
    "previously wrote together. The story (artwork image, current "
    "JSON, lesson curriculum context) is below.\n\n"
    "{phase_block}\n\n"
    "── 通用规则 (无论 Phase A 还是 Phase B 都适用) ──\n"
    "\n"
    "MODE A — Discussion only.\n"
    "  Triggered when the teacher is asking a question, exploring ideas, "
    "asking for advice, or making small/ambiguous suggestions.\n"
    "  Action: reply conversationally (1-3 short paragraphs). Set "
    "revised_story to null and revised_continuations to {{}}.\n"
    "\n"
    "MODE B — Concrete revision.\n"
    "  Triggered ONLY when the teacher has unambiguously specified which "
    "slice of the story to change AND how. Trigger words include:\n"
    "    Chinese: 改、改写、修改、调整、润色、重写、重新生成、换成、把…改成、"
    "改得、改一下、写得、写成、再…一点、更…一点、把第N段、把第N个、把…改、"
    "去掉、删除、加上、增加、补充、丰富、收紧、缩短、加长、变成、改为\n"
    "    English: change, rewrite, replace, revise, polish, tweak, adjust, "
    "make … more …, make … less …, drop, add, expand, shorten, lengthen, "
    "tighten, soften, gentler, more sensory, more vivid, less scary…\n"
    "  Action: return BOTH a 1-2 sentence reply acknowledging what was "
    "changed AND a complete revised_story with ALL FOUR fields (part1, "
    "choices, part3, designRationale). Fields the teacher did NOT ask "
    "you to change must be carried over verbatim from current_story.\n"
    "\n"
    "Output: a single JSON object — no markdown fences, no preamble:\n"
    "{{\n"
    '  "reply": "<conversational reply text>",\n'
    '  "revised_story": null,  // OR the full StoryData JSON in MODE B\n'
    '  "revised_continuations": {{}},  // OR {{ "<choiceId>": "<new part3>" }} when a continuation was changed\n'
    '  "clarify_options": [],  // 仅在 Phase B 澄清回合返回 4 个固定中文字符串；其它情况保持空数组\n'
    '  "revision_scope": []   // MODE B 时给出真正改了哪几段；MODE A 时保持 []\n'
    "}}\n"
    "\n"
    "`clarify_options` 用法：\n"
    "  • 仅当 Phase B 走澄清分支（MODE A 反问）时，照抄上面 4 个固定字符串放进去；\n"
    "  • 其它任何回合（MODE A 自由讨论、MODE B 已经修改、Phase A）必须返回空数组 [] 或省略，\n"
    "    不要返回 null。\n"
    "\n"
    "`revision_scope` 用法：\n"
    "  • MODE B 必须返回，元素只能从 [\"part1\", \"choices\", \"part3\", \"designRationale\"] 中取；\n"
    "  • 必须严格匹配本轮真正改了哪几个字段；不在 scope 内的字段必须从 current_story 逐字回填，\n"
    "    包括 designRationale —— 只要 scope 里没有 \"designRationale\"，就不要重写它。\n"
    "  • MODE A、Phase A 的 revised_story=null 回合必须为 [] 或省略。\n"
    "\n"
    "When revised_story is non-null it must follow the original story "
    "schema (English keys, values in the same language as the conversation)."
)



class StoryChatRequest(BaseModel):
    image_base64: str
    image_mime: str = "image/jpeg"
    messages: list[ChatMsg]
    current_story: dict
    language: str = "zh"
    lesson_id: Optional[str] = None
    artwork_id: Optional[str] = None
    # 2026-05 — phase wiring (Phase A vs Phase B).
    # `selected_choice_id` is None while the teacher is still on the
    # initial generation (part1 + choices visible, no continuation
    # picked yet → Phase A); becomes an int after they click any of
    # the 3 choice buttons (→ Phase B). `continuations` is the full
    # dict of any already-generated part3 texts keyed by choice id,
    # so the model can see what's been written across branches and
    # only rewrite the one the teacher wants changed.
    selected_choice_id: Optional[int] = None
    continuations: Optional[dict[str, str]] = None



def _build_story_chat_context(req: StoryChatRequest) -> str:
    """LKP context + current story snapshot, both injected into the
    chat system prompt so the model has full grounding for every turn."""
    # Reuse the same expanded LKP block used by /api/story/stream so
    # the chat has identical pedagogical grounding (objectives,
    # teaching focus/difficulty, key concepts, artwork notes).
    if req.lesson_id:
        try:
            ctx = lesson_manager.build_executor_b_context(req.lesson_id, req.artwork_id)
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
            if ctx.get("teaching_difficulty"):
                lines.append(f"[教学难点] {ctx['teaching_difficulty']}")
            concepts = ctx.get("key_concepts") or []
            if concepts:
                lines.append(f"[关键艺术概念] {'、'.join(concepts)}")
            if ctx.get("story_hint"):
                lines.append(f"故事方向提示: {ctx['story_hint']}")
            lesson_block = "\n".join(lines)
        except ValueError:
            lesson_block = ""
    else:
        lesson_block = ""

    story_json = json.dumps(req.current_story, ensure_ascii=False, indent=2)
    story_block = f"\n\n[当前故事 / Current story JSON]\n{story_json}"

    # Phase-B aux: per-branch continuations + which one is "current".
    # The model needs this to know which part3 text to rewrite when
    # the teacher says "改一下分支 2 的后半段" without re-clicking the
    # button. continuations is a dict keyed by choice id (stringified).
    phase_aux_lines: list[str] = []
    if req.selected_choice_id is not None:
        phase_aux_lines.append(
            f"\n\n[当前查看分支] selected_choice_id = {req.selected_choice_id}"
        )
    if req.continuations:
        cont_lines = ["\n[已生成的分支续篇 / continuations]"]
        for cid, text in req.continuations.items():
            cont_lines.append(f"  • choice id {cid}: {text}")
        phase_aux_lines.append("\n".join(cont_lines))
    phase_aux_block = "".join(phase_aux_lines)

    # When language is zh AND lesson_id is set, also pass the
    # designRationale spec so MODE B revisions stay within the
    # 5-paragraph 330-360 character contract.
    spec_block = _design_rationale_spec(req.language)

    return lesson_block + story_block + phase_aux_block + spec_block


@app.post("/api/story/chat")
async def story_chat(req: StoryChatRequest):
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    # Phase selection — Phase A while no continuation picked yet,
    # Phase B once any choice has been clicked. The phase block is
    # injected via str.format() so we have to escape literal braces
    # in STORY_CHAT_SYSTEM (already done above with {{ }}).
    phase_block = (
        _STORY_CHAT_PHASE_B
        if req.selected_choice_id is not None
        else _STORY_CHAT_PHASE_A
    )
    system_head = STORY_CHAT_SYSTEM.format(phase_block=phase_block)
    system = (
        system_head
        + _build_story_chat_context(req)
        + _lang_suffix(req.language)
    )

    history = [{"role": m.role, "content": m.text} for m in req.messages]

    # The artwork image is attached to the last user turn so the
    # model can re-examine it when revising visual details. We do
    # this by replacing the final user message's content with a
    # multi-part [image, text] payload.
    if history and history[-1]["role"] == "user":
        last_text = history[-1]["content"]
        history[-1] = {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{req.image_mime};base64,{req.image_base64}"
                    },
                },
                {"type": "text", "text": last_text},
            ],
        }

    payload = {
        "model": STORY_MODEL,
        "messages": [{"role": "system", "content": system}] + history,
        "max_tokens": 2200,
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(
            f"{ARK_BASE}/chat/completions",
            json=payload,
            headers=_ark_headers(),
        )

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"Ark API error: {resp.text}")

    raw = resp.json()["choices"][0]["message"]["content"].strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1].lstrip("json").strip() if len(parts) >= 2 else raw

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # Model didn't follow the JSON envelope — treat the whole
        # response as a discussion-mode reply. This keeps the chat
        # usable even when the model slips up. All optional fields
        # are returned with safe empty defaults so the frontend's
        # type stays stable.
        return {
            "reply": raw,
            "revised_story": None,
            "revised_continuations": {},
            "clarify_options": [],
            "revision_scope": [],
        }

    reply = data.get("reply") or ""
    revised = data.get("revised_story")
    revised_conts_raw = data.get("revised_continuations") or {}

    # `revised_continuations` is a dict keyed by choice id (stringified
    # ints OK). Normalise both keys and values to plain str so the
    # frontend doesn't have to deal with json's mixed int/str-key
    # parsing quirks.
    revised_continuations: dict[str, str] = {}
    if isinstance(revised_conts_raw, dict):
        for k, v in revised_conts_raw.items():
            if isinstance(v, str) and v.strip():
                revised_continuations[str(k)] = v

    # `clarify_options` (Phase B clarification turn only). The model
    # is told to emit a fixed 4-item Chinese array; we still validate
    # defensively because Doubao occasionally drops fields or adds
    # extras. Anything that isn't a non-empty list of clean strings
    # becomes an empty list — the frontend treats `[]` as "no buttons".
    clarify_raw = data.get("clarify_options")
    if (
        isinstance(clarify_raw, list)
        and 0 < len(clarify_raw) <= 4
        and all(isinstance(s, str) and s.strip() for s in clarify_raw)
    ):
        clarify_options = [s.strip() for s in clarify_raw]
    else:
        clarify_options = []

    # `revision_scope` (MODE B only). Frontend uses this to decide
    # which sections of the proposed revision to render. Validate
    # against the canonical 4-key set so a hallucinated scope value
    # (e.g. "title", "rationale") can never poison the UI. Order
    # within the scope array is preserved so the preview renders the
    # same order the model chose.
    SCOPE_ALLOWED = {"part1", "choices", "part3", "designRationale"}
    scope_raw = data.get("revision_scope")
    if isinstance(scope_raw, list):
        revision_scope = [
            s
            for s in scope_raw
            if isinstance(s, str) and s in SCOPE_ALLOWED
        ]
        # Deduplicate while preserving order.
        seen: set[str] = set()
        revision_scope = [s for s in revision_scope if not (s in seen or seen.add(s))]
    else:
        revision_scope = []

    # Sanity-check: revised_story must include all 4 keys to be applied.
    REQUIRED = {"part1", "choices", "part3", "designRationale"}
    if isinstance(revised, dict) and REQUIRED.issubset(revised.keys()):
        return {
            "reply": reply,
            "revised_story": revised,
            "revised_continuations": revised_continuations,
            "clarify_options": clarify_options,
            "revision_scope": revision_scope,
        }
    return {
        "reply": reply,
        "revised_story": None,
        "revised_continuations": revised_continuations,
        "clarify_options": clarify_options,
        # No revised_story → scope is meaningless for the UI; always
        # return empty so the frontend's "if revision_scope?.length"
        # checks stay clean.
        "revision_scope": [],
    }



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
# 7b. Part 6 chat — Executor D conversational front-end
# ════════════════════════════════════════════════════════════════════════
#
# 2026-05 redesign. The original UX asked the teacher to "describe
# your lesson context" in the chat panel and then triggered
# /api/part6/generate-styles with that text — but the backend already
# short-circuits to the LKP's curated `executor_d_styles` whenever
# `lesson_id` is present, so the teacher's input was effectively a
# trigger token, not real context. That was confusing.
#
# The new flow lets the teacher pick from 3 intents (or type freely):
#   • intent="recommend" → return the 3 LKP styles immediately as
#                          `proposed_styles`; no LLM call needed.
#   • intent="skills"    → LLM answers what creative skills students
#                          should master in THIS lesson (grounded in
#                          LKP fields), then keeps chatting.
#   • intent="styles"    → LLM answers what art style/technique THIS
#                          lesson focuses on (grounded in LKP), then
#                          keeps chatting.
#   • intent=None        → freeform follow-up.
#
# At every LLM turn the model returns JSON of shape:
#     { "reply": "<chat text>",
#       "proposed_styles": null | [{ "label": str, "prompt": str } x3] }
# The frontend renders chips + a "Confirm" button whenever
# proposed_styles is non-null, so the teacher can lock in the final
# set whenever discussion has converged.

# Phase-specific instruction blocks. The frontend tells us which
# phase the teacher is in (pre-recommend / reviewing / locked) and we
# swap in the matching block so the model knows whether to output
# `proposed_styles` at all this turn.
_PHASE_BLOCK_PRE_RECOMMEND = (
    "当前对话阶段 (phase): pre-recommend —— 老师还没让你推荐过 3 个风格方案，本轮"
    "**不要**输出 proposed_styles。`reply` 用一句话或几句话回答老师的问题即可。\n"
    "  - 这一轮 proposed_styles 必须是 null（前端会自己在你的回复下挂一个「为我推荐方案」按钮，"
    "    引导老师下一步触发推荐）。\n"
    "  - 不要在 reply 里列出风格名字清单，也不要主动建议老师"
    "    「我可以推荐 3 个方案」——前端会用一个按钮提示。"
)
_PHASE_BLOCK_REVIEWING = (
    "当前对话阶段 (phase): reviewing —— 老师已经看过推荐方案，正在审阅 / 修改 3 个风格。"
    "**本轮必须输出完整的 proposed_styles**（恰好 3 项，每项含 label / prompt / prompt_zh）。\n"
    "  - 状态维护：老师只是问问题且没提具体修改 → 沿用上一轮的同一组；老师要求改某一项 → "
    "    只动那一项，另外 2 项原样保留；老师要求全部重做 → 可同时改写但最终仍是 3 项；"
    "    老师明确说 OK/好的/就这样/确认 → 原样返回当前 3 项。\n"
    "  - 不要把英文 prompt 或整段 prompt_zh 粘进 reply——预览框会展示，`reply` 只描述"
    "    本轮做了什么调整或回答老师的问题，1-3 句话即可。"
)
_PHASE_BLOCK_LOCKED = (
    "当前对话阶段 (phase): locked —— 老师已经点了「确认这套风格」，这套风格已锁定，"
    "中间编辑区已经出现了 3 只小猪。**本轮绝对不要**输出 proposed_styles。\n"
    "  - 这一轮 proposed_styles 必须是 null。前端不会再渲染任何风格 chip / 确认按钮。\n"
    "  - `reply` 用 1-3 句话回答老师任何问题（关于本课、关于已锁定的风格如何用、关于"
    "    课堂操作等），但不要再提出新的风格方案。如果老师明确说要换风格，请回复"
    "    「如果想换风格，请点中间区域的『重新讨论风格』按钮重新开始 ☺」。"
)

PART6_CHAT_SYSTEM_TEMPLATE = (
    "You are 艺芽 (ArtBloom), an AI co-teacher helping a Chinese primary-school art "
    "teacher prepare Part 6 (风格创作 / personalised style transfer of student artwork) "
    "for the lesson described below. You MUST ground every answer in this lesson's "
    "knowledge package — never invent facts about the textbook.\n\n"
    "════════ LESSON KNOWLEDGE PACKAGE ════════\n"
    "课程：{lesson_title_zh}\n"
    "本课学习任务：{learning_task_zh}\n"
    "单元大概念：{unit_big_idea_zh}\n"
    "学习目标：{learning_objectives_text}\n"
    "教学重点：{teaching_focus_zh}\n"
    "教学难点：{teaching_difficulty}\n"
    "核心美术概念：{key_art_concepts_text}\n"
    "评价标准：{assessment_criteria}\n\n"
    "默认的 3 个风格转换方案（教研团队基于教材教参预设；老师可保留、调整文案，或要求重新设计）：\n"
    "{default_styles_text}\n"
    "════════════════════════════════════════════\n\n"
    "════════ PHASE INSTRUCTION ════════\n"
    "{phase_block}\n"
    "═══════════════════════════════════\n\n"
    "通用规则（无论 phase 如何都适用）：\n"
    "\n"
    "1) 关键术语澄清——「美术风格」在本系统里**特指上方「默认的 3 个风格转换方案」**，"
    "   不是艺术史意义上的「印象派 / 立体派 / 国画 / 油画」这类大类。当老师问"
    "   「这节课重点学习的美术风格是什么」时，你**必须**从上方那 3 个预设方向的"
    "   描述、视觉表现技巧、关联的学习目标来介绍它们。**严禁回答**「本课没有指定"
    "   特定的传统美术风格」或类似措辞——本课已经有 3 个预设风格方案，它们就是答案。\n"
    "\n"
    "2) 当 phase = reviewing 且老师要求修改风格时，`proposed_styles[i]` 字段格式——"
    "   **每一项必须包含 3 个字段**：`label`, `prompt`, `prompt_zh`：\n"
    "   - `label`：中文短名，4-10 字，对老师可读、对小学生友好。\n"
    "   - `prompt`：完整英文 image-to-image 生成 prompt，沿用默认 prompt 的结构（preserve"
    "     child's drawing、image-to-image strength: 0.45-0.65 区间、如孩子作品为黑白线稿则要"
    "     给出明确上色指令等），不少于 60 词。**该 prompt 是给图像模型的，老师不会直接看到。**\n"
    "   - `prompt_zh`：与 `prompt` **逐项对应的中文版**，95-105 个中文字。这是老师在「提示词"
    "     预览」框里实际会看到的内容——必须忠实复述 `prompt` 的关键内容；当 `prompt` 改写时"
    "     `prompt_zh` 必须同步更新。\n"
    "\n"
    "3) `reply` 字段：用 {lang_name} 与老师对话，简洁、亲切、专业；不要把英文 prompt 或整段"
    "   prompt_zh 粘进 `reply` 里——预览框会展示。\n"
    "\n"
    "4) 每一轮回复必须是单个合法 JSON 对象，不要 markdown 代码块、不要前后多余文字。结构：\n"
    '   {{"reply": "<string in {lang_name}>", "proposed_styles": null | [{{"label": "<zh>", "prompt": "<en, 60+ words>", "prompt_zh": "<zh, 95-105 chars>"}}, ..., ...]}}\n'
    "   （是否输出 proposed_styles 由上方 PHASE INSTRUCTION 决定。）\n"
)


# Map the wire-format phase string to the corresponding instruction
# block. Unknown values fall back to pre-recommend (the safest mode
# — model won't accidentally re-propose styles).
_PHASE_BLOCKS = {
    "pre-recommend": _PHASE_BLOCK_PRE_RECOMMEND,
    "reviewing": _PHASE_BLOCK_REVIEWING,
    "locked": _PHASE_BLOCK_LOCKED,
}


def _format_part6_chat_system(ctx: dict, language: str, phase: str = "pre-recommend") -> str:
    """Stitch the LKP context dict into the Part-6 chat system prompt.

    All multi-value fields are flattened to readable lines because Doubao
    follows hand-written prose more reliably than nested JSON dumped via
    `json.dumps(..., ensure_ascii=False)`.

    `phase` tells the model whether to output proposed_styles this turn:
    pre-recommend / locked → must be null; reviewing → must contain 3
    items. The backend also enforces this server-side after the call.
    """

    # learning_objectives in the current LKP schema is
    # {tier: str} (e.g. {"know": "...", "understand": "...", "do": "..."}),
    # but earlier seed drafts used {tier: [str, ...]}. Handle both so a
    # future schema bump doesn't silently render "学习目标：—".
    lo = ctx.get("learning_objectives") or {}
    TIER_LABELS = {"know": "知道", "understand": "理解", "do": "能做"}
    if isinstance(lo, dict) and lo:
        lo_lines = []
        for tier, items in lo.items():
            label = TIER_LABELS.get(tier, tier)
            if isinstance(items, list):
                value = "; ".join(s for s in items if s)
            else:
                value = str(items or "")
            if value:
                lo_lines.append(f"  - {label}: {value}")
        learning_objectives_text = "\n" + "\n".join(lo_lines) if lo_lines else "—"
    else:
        learning_objectives_text = str(lo) or "—"

    kac = ctx.get("key_art_concepts") or []
    key_art_concepts_text = "、".join(kac) if isinstance(kac, list) else str(kac) or "—"

    styles = ctx.get("styles") or []
    if styles:
        default_styles_lines = []
        for i, s in enumerate(styles, 1):
            label = s.get("style_name_zh", "")
            desc = s.get("style_description_zh", "")
            obj = s.get("linked_learning_objective", "")
            prompt_en = s.get("image_gen_prompt_template_en", "")
            # 2026-05: also expose the curriculum-team's Chinese-version
            # prompt so the model has a reference for how to keep the
            # `prompt_zh` field aligned with `prompt` (English) when
            # iterating on a style.
            prompt_zh = s.get("image_gen_prompt_template_zh", "") or desc
            default_styles_lines.append(
                f"  {i}. {label}\n"
                f"     - 描述: {desc}\n"
                f"     - 关联目标: {obj}\n"
                f"     - 默认 prompt (英文,给图像模型): {prompt_en}\n"
                f"     - 默认 prompt_zh (中文,给老师审阅): {prompt_zh}"
            )
        default_styles_text = "\n".join(default_styles_lines)
    else:
        # Branch B — no curated styles. Tell the model to design from
        # scratch on confirm.
        default_styles_text = "  （本课没有预设风格，请基于学习目标自行设计 3 个方向）"

    lang_name = "中文" if language.lower().startswith("zh") else "English"

    phase_block = _PHASE_BLOCKS.get(phase, _PHASE_BLOCK_PRE_RECOMMEND)

    return PART6_CHAT_SYSTEM_TEMPLATE.format(
        lesson_title_zh=ctx.get("lesson_title_zh") or "—",
        learning_task_zh=ctx.get("learning_task_zh") or "—",
        unit_big_idea_zh=ctx.get("unit_big_idea_zh") or "—",
        learning_objectives_text=learning_objectives_text,
        teaching_focus_zh=ctx.get("teaching_focus_zh") or "—",
        teaching_difficulty=ctx.get("teaching_difficulty") or "—",
        key_art_concepts_text=key_art_concepts_text,
        assessment_criteria=ctx.get("assessment_criteria") or "—",
        default_styles_text=default_styles_text,
        lang_name=lang_name,
        phase_block=phase_block,
    )


class Part6ChatMessage(BaseModel):
    role: str       # "user" | "assistant"
    text: str


class Part6ChatRequest(BaseModel):
    lesson_id: str
    messages: list[Part6ChatMessage] = []
    language: str = "zh"
    intent: Optional[str] = None  # "recommend" | "skills" | "styles" | None
    # 2026-05 — conversation phase, driven by the frontend.
    #   pre-recommend → teacher hasn't asked for a recommendation yet;
    #                   we never output proposed_styles.
    #   reviewing     → recommend has fired (or LKP styles came in);
    #                   teacher may be tweaking; output 3 styles every turn.
    #   locked        → teacher clicked Confirm; styles are committed
    #                   to the middle canvas; no further style output.
    phase: str = "pre-recommend"


@app.post("/api/part6/chat")
async def part6_chat(req: Part6ChatRequest):
    """Conversational front-end for Part 6 style design.

    See the section banner above for the design rationale.
    """
    # Load LKP — 404 if the lesson isn't in our seed library.
    try:
        ctx = lesson_manager.build_executor_d_context(req.lesson_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc))

    # ── Fast path: teacher asked for an immediate recommendation ───
    #
    # Skip the LLM entirely — we already have curated styles in the
    # LKP, and rolling them through a model would just add latency and
    # a translation-drift risk (the prompts are hand-tuned English).
    if req.intent == "recommend":
        if ctx["branch"] == "B" or not ctx["styles"]:
            return {
                "reply": (
                    f"本课《{ctx['lesson_title_zh']}》在教研团队的教材教参中尚未预设风格方案。"
                    "请告诉我你希望学生在创作中练习什么技能，我来为你设计 3 个方向。"
                ),
                "proposed_styles": None,
            }
        # 2026-05: include both the English prompt (sent verbatim to
        # Doubao Seedream when the teacher hits Convert) AND the
        # curriculum-team-authored Chinese version (shown to the teacher
        # in the chat panel's preview box). Falls back to the short
        # description if the LKP hasn't been backfilled with `_zh` yet.
        proposed = [
            {
                "label": s["style_name_zh"],
                "prompt": s["image_gen_prompt_template_en"],
                "prompt_zh": (
                    s.get("image_gen_prompt_template_zh")
                    or s.get("style_description_zh", "")
                ),
            }
            for s in ctx["styles"]
        ]
        # Build a friendly intro line that quotes each style's
        # description so the teacher can review without expanding.
        intro_lines = [
            f"基于本课《{ctx['lesson_title_zh']}》的学习任务"
            f"「{ctx['learning_task_zh']}」，"
            "我为你推荐以下 3 个风格转换方向："
        ]
        for s in ctx["styles"]:
            intro_lines.append(
                f"• {s['style_name_zh']}：{s.get('style_description_zh', '')}"
            )
        intro_lines.append("如果觉得方向合适就点「确认这套风格」，也可以告诉我想调整的地方。")
        return {
            "reply": "\n".join(intro_lines),
            "proposed_styles": proposed,
        }

    # ── LLM path: skills / styles / freeform conversation ─────────
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    # Build the phase-aware system prompt so the model knows whether
    # to output proposed_styles this turn.
    api_messages = [
        {
            "role": "system",
            "content": _format_part6_chat_system(ctx, req.language, req.phase),
        },
    ]
    for m in req.messages:
        # Map our "assistant"/"user" roles straight to OpenAI roles.
        api_messages.append({"role": m.role, "content": m.text})

    payload = {
        "model": CHAT_MODEL,
        "messages": api_messages,
        "max_tokens": 1500,
        # Ark / Doubao supports `response_format: json_object` the same
        # way OpenAI does, which lets us skip the fragile fenced-JSON
        # parser we wrote for /api/part6/generate-styles.
        "response_format": {"type": "json_object"},
        "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{ARK_BASE}/chat/completions", json=payload, headers=_ark_headers()
        )

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"Ark API error: {resp.text}")

    raw = resp.json()["choices"][0]["message"]["content"].strip()

    # Defensive: strip any stray markdown fences even though we asked
    # for JSON mode. Doubao occasionally returns ```json ... ``` when
    # it's confused by the system prompt.
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1].lstrip("json").strip() if len(parts) >= 2 else raw

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # Graceful degradation — wrap the model's plain text in our
        # schema. proposed_styles stays None so the UI just shows the
        # message, no confirm button.
        return {"reply": raw, "proposed_styles": None}

    reply = data.get("reply") or ""
    proposed = data.get("proposed_styles")

    # ── Phase enforcement (server-side) ─────────────────────────────
    #
    # The PHASE INSTRUCTION block in the system prompt asks the model
    # to honour the phase, but Doubao is not perfectly compliant. We
    # also drop proposed_styles server-side whenever phase is NOT
    # `reviewing`, regardless of what the model returned. This is the
    # single source of truth for the UI state machine — the frontend
    # can trust that pre-recommend / locked turns will never contain
    # a phantom proposal.
    if req.phase != "reviewing":
        return {"reply": reply, "proposed_styles": None}

    # Validate `proposed_styles`: must be a 3-item list of
    # {label, prompt, prompt_zh}. `prompt_zh` is *required* under the
    # 2026-05 schema, but to keep the chat usable if the model
    # occasionally omits it we fall back to a best-effort source:
    # whichever LKP default style sits at the same index (for an
    # un-modified style this carries the curriculum copy through),
    # or finally an empty string.
    if isinstance(proposed, list) and len(proposed) == 3 and all(
        isinstance(s, dict) and "label" in s and "prompt" in s for s in proposed
    ):
        default_zh_by_idx = [
            (
                (ds.get("image_gen_prompt_template_zh") or "")
                or ds.get("style_description_zh", "")
            )
            for ds in ctx["styles"]
        ] if ctx.get("styles") else ["", "", ""]
        proposed_styles = [
            {
                "label": str(s["label"]),
                "prompt": str(s["prompt"]),
                "prompt_zh": str(
                    s.get("prompt_zh")
                    or (default_zh_by_idx[i] if i < len(default_zh_by_idx) else "")
                ),
            }
            for i, s in enumerate(proposed)
        ]
    else:
        proposed_styles = None

    return {"reply": reply, "proposed_styles": proposed_styles}


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


# ════════════════════════════════════════════════════════════════════════
# 10. Per-user state (Cloudflare R2 user "database")
# ════════════════════════════════════════════════════════════════════════
#
# 2026-05 — Pilot teachers complained that hitting the browser refresh
# in the workspace nuked all their work (slides, chat history, AI
# story etc.). Root cause: every workspace store lived only in browser
# memory + (best case) localStorage. There was no server-side user
# database.
#
# This section adds a minimal per-user persistence layer on top of
# Cloudflare R2 (S3-compatible). The teacher's invitation code is
# their primary key; each user owns exactly one JSON blob at
# `user-state/{invite_code}.json`. The frontend reads it on login,
# debounce-saves it on every change.
#
# Why R2 and not Postgres / KV / disk:
#   • R2 is already provisioned for textbook assets — credentials and
#     the wrangler/dashboard workflow are familiar.
#   • Free tier is enormous (10 GB / 1M write Class A ops / 10M
#     read Class A ops per month). For 1-4 pilot users this costs $0.
#   • Object-per-user keeps the schema flat — no migrations needed
#     when we add a Pinia store.
#   • Easy to inspect / export post-pilot: `wrangler r2 object get
#     artbloom-user-state/<code>.json` dumps the entire teacher's
#     workspace as a single JSON file we can hand off.
#
# Audit log: a separate object `user-state/{code}.log.{YYYY-MM-DD}.jsonl`
# records each save with timestamp, size and current schema_version.
# These are append-only-per-day (because R2 doesn't natively append,
# we read-modify-write the day's file). For higher-volume audit we'd
# switch to Postgres or Cloudflare D1; for 1-4 pilots this is fine.

_R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL", "").strip()
_R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "").strip()
_R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "").strip()
_R2_USER_STATE_BUCKET = os.getenv("R2_USER_STATE_BUCKET", "artbloom-user-state").strip()

# Singleton boto3 client. Lazy-init so we don't blow up startup when
# the secrets aren't set — the endpoints below return 503 instead.
_r2_user_client = None


def _get_r2_user_client():
    """Return a cached boto3 S3 client pointed at R2, or None if the
    env vars / boto3 aren't available. Endpoints check the return
    value and respond with HTTP 503 when the persistence layer isn't
    configured, so the frontend can degrade gracefully to
    localStorage-only mode (same as the chatbot store's existing
    behaviour in offline environments)."""
    global _r2_user_client
    if _r2_user_client is not None:
        return _r2_user_client
    if not _BOTO3_AVAILABLE:
        return None
    if not (_R2_ENDPOINT_URL and _R2_ACCESS_KEY_ID and _R2_SECRET_ACCESS_KEY):
        return None
    try:
        # `signature_version="s3v4"` is what R2 expects — using the
        # legacy v2 sig will yield 403 SignatureDoesNotMatch.
        _r2_user_client = boto3.client(  # type: ignore[union-attr]
            "s3",
            endpoint_url=_R2_ENDPOINT_URL,
            aws_access_key_id=_R2_ACCESS_KEY_ID,
            aws_secret_access_key=_R2_SECRET_ACCESS_KEY,
            config=_BotoConfig(signature_version="s3v4"),  # type: ignore[arg-type]
        )
        print(
            f"[startup] user-state R2 ready: bucket={_R2_USER_STATE_BUCKET}, "
            f"endpoint={_R2_ENDPOINT_URL}",
            flush=True,
        )
        return _r2_user_client
    except Exception as exc:  # pragma: no cover — defensive
        print(f"[startup] user-state R2 init failed: {exc}", flush=True)
        return None


# Invite codes are pilot-issued + human-readable. We allow letters,
# digits, and a single class of separators. Everything else is
# rejected as 400 to keep the R2 object-key surface tight (no path
# traversal, no spaces, no UTF-8).
_USER_CODE_RE = re.compile(r"^[A-Za-z0-9_-]{4,64}$")


def _ensure_safe_code(user_code: str) -> str:
    """Normalise + validate the invite code. Returns the canonical
    form (upper-cased) used everywhere as the R2 object key segment.

    We upper-case because the access UX in `AccessModal.vue` is
    case-insensitive — the teacher might type lowercase by mistake
    and that should still land in the same R2 object. Whitespace is
    rejected explicitly so a stray space at the end of the code
    can't create a phantom user.
    """
    if not isinstance(user_code, str):
        raise HTTPException(400, "user_code must be a string")
    candidate = user_code.strip().upper()
    if not _USER_CODE_RE.match(candidate):
        raise HTTPException(
            400,
            "user_code must be 4-64 chars, letters / digits / '-' / '_' only",
        )
    return candidate


@app.get("/api/state/{user_code}")
async def load_user_state(user_code: str):
    """Return the user's full state blob from R2.

    Response shape:
        200 → the JSON blob (whatever the frontend last PUT).
        204 → "no state yet for this user" — frontend should start fresh.
        503 → R2 not configured (frontend falls back to localStorage).
    """
    code = _ensure_safe_code(user_code)
    client = _get_r2_user_client()
    if client is None:
        # Persistence layer unavailable — let the frontend know so it
        # can degrade gracefully instead of looping retries.
        raise HTTPException(503, "user-state persistence is not configured")

    key = f"user-state/{code}.json"
    try:
        obj = client.get_object(Bucket=_R2_USER_STATE_BUCKET, Key=key)
    except _BotoClientError as exc:  # type: ignore[misc]
        # NoSuchKey → empty 204 (first login on this code).
        code_str = getattr(exc, "response", {}).get("Error", {}).get("Code", "")
        if code_str in ("NoSuchKey", "404"):
            return Response(status_code=204)
        # Any other client error is a real problem.
        print(f"[user-state] GET {key} failed: {exc}", flush=True)
        raise HTTPException(502, f"R2 read failed: {exc}")
    except Exception as exc:  # pragma: no cover — defensive
        print(f"[user-state] GET {key} unexpected failure: {exc}", flush=True)
        raise HTTPException(502, f"R2 read failed: {exc}")

    body = obj["Body"].read()
    # Stream the bytes back unchanged (already JSON) so we don't pay
    # the parse → re-serialise round-trip cost.
    return Response(
        content=body,
        media_type="application/json",
        headers={"Cache-Control": "no-store"},
    )


class UserStateBody(BaseModel):
    """Pydantic wrapper around the opaque payload. We let the
    frontend decide the schema; the only field we read here is
    `schema_version` for the audit log. Everything else is stored
    verbatim. Using a `dict` field instead of a typed schema keeps
    the contract loose so adding a new Pinia store later doesn't
    require a backend deploy."""
    payload: dict[str, Any]


@app.put("/api/state/{user_code}")
async def save_user_state(user_code: str, body: UserStateBody, request: Request):
    """Persist the user's full state blob.

    The frontend POSTs a JSON envelope `{ payload: <opaque> }` so the
    Pydantic validator can stay simple (a dict is JSON-safe by
    construction). Body size is implicitly capped by the upstream
    proxy (Render's free tier ~ 100 MB request body, well above the
    20 MB target).
    """
    code = _ensure_safe_code(user_code)
    client = _get_r2_user_client()
    if client is None:
        raise HTTPException(503, "user-state persistence is not configured")

    # Add server-side timestamp so the frontend can detect "newer on
    # backend" even if its local clock drifts. We don't trust the
    # client's `updated_at` for conflict resolution.
    payload = dict(body.payload)
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    payload.setdefault("schema_version", 1)

    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    key = f"user-state/{code}.json"
    try:
        client.put_object(
            Bucket=_R2_USER_STATE_BUCKET,
            Key=key,
            Body=raw,
            ContentType="application/json",
            CacheControl="no-store",
        )
    except Exception as exc:
        print(f"[user-state] PUT {key} failed: {exc}", flush=True)
        raise HTTPException(502, f"R2 write failed: {exc}")

    # ── Append a one-line audit entry per save. We use a per-day
    # file so the read-modify-write cost stays bounded (one day of
    # one user's saves is maybe a few hundred lines, ~ tens of KB).
    log_entry = json.dumps(
        {
            "ts": payload["updated_at"],
            "size": len(raw),
            "schema_version": payload.get("schema_version", 1),
            "ip": (request.client.host if request.client else None),
        },
        ensure_ascii=False,
    ) + "\n"
    log_key = f"user-state/{code}.log.{date.today().isoformat()}.jsonl"
    try:
        existing = b""
        try:
            existing_obj = client.get_object(
                Bucket=_R2_USER_STATE_BUCKET, Key=log_key
            )
            existing = existing_obj["Body"].read()
        except _BotoClientError as exc:  # type: ignore[misc]
            code_str = (
                getattr(exc, "response", {}).get("Error", {}).get("Code", "")
            )
            if code_str not in ("NoSuchKey", "404"):
                raise
        client.put_object(
            Bucket=_R2_USER_STATE_BUCKET,
            Key=log_key,
            Body=existing + log_entry.encode("utf-8"),
            ContentType="application/x-ndjson",
        )
    except Exception as exc:  # pragma: no cover — best-effort
        # Audit log failure must NOT cascade into a failed save. The
        # canonical state is already on R2; we just lose one log
        # entry. Print to stderr so the operator can investigate.
        print(f"[user-state] audit log append failed for {code}: {exc}", flush=True)

    return {
        "ok": True,
        "updated_at": payload["updated_at"],
        "size": len(raw),
    }
