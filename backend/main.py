import json
import os
import uuid
from typing import AsyncIterator

import edge_tts
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="ArtBloom API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ARK_API_KEY   = os.getenv("ARK_API_KEY", "")
STORY_MODEL   = os.getenv("ARK_STORY_MODEL", "doubao-seed-2-0-lite-260215")
CHAT_MODEL    = os.getenv("ARK_CHAT_MODEL",  "doubao-seed-2-0-lite-260215")
VIDEO_MODEL   = os.getenv("ARK_VIDEO_MODEL", "doubao-seedance-2-0-260128")
IMAGE_MODEL   = os.getenv("ARK_IMAGE_MODEL", "doubao-seedream-5-0-260128")
ARK_BASE      = "https://ark.cn-beijing.volces.com/api/v3"

# TTS — Microsoft Edge Neural TTS (no key required, high quality Chinese voices)
# To switch to Volcengine preset voices later, enable 语音合成 at
# console.volcengine.com/speech/new and set VOLCENGINE_SPEECH_API_KEY in .env

TTS_VOICES = [
    {"id": "zh-CN-XiaoxiaoNeural",  "name": "晓晓", "desc": "温暖"},
    {"id": "zh-CN-XiaoyiNeural",    "name": "晓伊", "desc": "活泼"},
    {"id": "zh-CN-YunjianNeural",   "name": "云健", "desc": "深沉"},
    {"id": "zh-CN-YunxiNeural",     "name": "云希", "desc": "清爽"},
    {"id": "zh-TW-HsiaoYuNeural",   "name": "曉雨", "desc": "温柔"},
    {"id": "zh-TW-YunJheNeural",    "name": "雲哲", "desc": "自然"},
]


def _ark_headers() -> dict:
    return {
        "Authorization": f"Bearer {ARK_API_KEY}",
        "Content-Type": "application/json",
    }


def _lang_suffix(language: str) -> str:
    if language == "zh":
        return "\n请用简体中文写所有内容，包括故事文本、选项标签和所有其他字段。"
    return "\nWrite all content in English."


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


# ─── Health ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "ok": True,
        "api_key_set":    bool(ARK_API_KEY),
        "tts_voices":     len(TTS_VOICES),
        "story_model":    STORY_MODEL,
        "video_model":    VIDEO_MODEL,
    }


# ─── Story generation ──────────────────────────────────────────────────────

class StoryRequest(BaseModel):
    image_base64: str       # raw base64, no "data:" prefix
    image_mime: str = "image/jpeg"
    language: str = "en"

STORY_SYSTEM = (
    "You are an art education assistant helping teachers create interactive story-based lessons. "
    "Analyse the artwork and write an engaging, age-appropriate interactive story for elementary students. "
    "Respond ONLY with a valid JSON object — no markdown fences, no extra text."
)

STORY_USER = """\
Based on this artwork, generate an interactive story.

Return exactly this JSON structure:
{
  "part1": "<3-4 paragraph opening narrative immersing the child in the world of the painting>",
  "choices": [
    {"id": 0, "label": "<short action title>", "desc": "<one sentence describing this path>"},
    {"id": 1, "label": "<short action title>", "desc": "<one sentence describing this path>"},
    {"id": 2, "label": "<short action title>", "desc": "<one sentence describing this path>"}
  ],
  "part3": "<2-3 paragraph continuation following choice 0>",
  "designRationale": "<2-3 sentences on how this story connects to the artwork and its educational value>",
  "soundDesign": "<recommended ambient sounds and music for Part 1, the choice moment, and Part 3>"
}"""


def _story_payload(req: StoryRequest, stream: bool = False) -> dict:
    return {
        "model": STORY_MODEL,
        "stream": stream,
        "messages": [
            {"role": "system", "content": STORY_SYSTEM + _lang_suffix(req.language)},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{req.image_mime};base64,{req.image_base64}"},
                    },
                    {"type": "text", "text": STORY_USER},
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


# ─── Animation generation ──────────────────────────────────────────────────

class AnimationSubmitRequest(BaseModel):
    image_base64: str
    image_mime: str = "image/jpeg"
    prompt: str = ""          # optional user refinement text


def _build_animation_prompt(user_prompt: str) -> str:
    base = (
        "Transform this artwork into a gentle, looping animation. "
        "Add subtle life to the painting: soft wind moving trees or flowers, "
        "flowing water or drifting clouds where present, gradual light changes, "
        "and delicate atmospheric particles such as petals or dust motes. "
        "Preserve the original art style and colour palette throughout."
    )
    if user_prompt.strip():
        return f"{base}  Additional instruction: {user_prompt.strip()}"
    return base


@app.post("/api/animation/submit")
async def submit_animation(req: AnimationSubmitRequest):
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    payload = {
        "model": VIDEO_MODEL,
        "content": [
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{req.image_mime};base64,{req.image_base64}"
                },
            },
            {"type": "text", "text": _build_animation_prompt(req.prompt)},
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

    data   = resp.json()
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


# ─── Slide-design chatbot ──────────────────────────────────────────────────

CHAT_SYSTEM = (
    "You are ArtBloom, a friendly AI assistant built into an art-education slide-design tool. "
    "You help teachers create engaging, visually appealing slide decks for art lessons. "
    "You can advise on colour theory, composition, layout, typography, image sourcing, "
    "lesson structure, and age-appropriate content. "
    "Keep replies concise and practical — two to four short paragraphs at most. "
    "When relevant, give concrete, actionable suggestions the teacher can apply immediately."
)


class ChatMsg(BaseModel):
    role: str    # "user" | "assistant"
    text: str


class ChatRequest(BaseModel):
    messages: list[ChatMsg]
    language: str = "en"


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    history = [{"role": m.role, "content": m.text} for m in req.messages]
    system  = CHAT_SYSTEM + _lang_suffix(req.language)

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


# ─── Story continuation ────────────────────────────────────────────────────

STORY_CONTINUE_SYSTEM = (
    "You are an art education assistant helping teachers create interactive story-based lessons. "
    "Given the first half of an interactive story and the child's chosen path, "
    "write a vivid, engaging continuation for elementary school students. "
    "Respond with ONLY the continuation text — no JSON, no labels, no extra formatting."
)

STORY_CONTINUE_USER = """\
First half of the story:
{part1}

The child chose: {choice_label} — {choice_desc}

Write a 2–3 paragraph continuation that follows this choice. \
Keep the same imaginative tone, use sensory details, and bring the story to a satisfying close."""


class StoryContinueRequest(BaseModel):
    image_base64: str
    image_mime: str = "image/jpeg"
    part1: str
    choice_label: str
    choice_desc: str
    language: str = "en"


def _continue_payload(req: StoryContinueRequest, stream: bool = False) -> dict:
    return {
        "model": STORY_MODEL,
        "stream": stream,
        "messages": [
            {"role": "system", "content": STORY_CONTINUE_SYSTEM + _lang_suffix(req.language)},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{req.image_mime};base64,{req.image_base64}"},
                    },
                    {
                        "type": "text",
                        "text": STORY_CONTINUE_USER.format(
                            part1=req.part1,
                            choice_label=req.choice_label,
                            choice_desc=req.choice_desc,
                        ),
                    },
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


# ─── Part 6: Work Transformation ──────────────────────────────────────────

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
    lesson_context: str


@app.post("/api/part6/generate-styles")
async def generate_styles(req: StyleGenerateRequest):
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    payload = {
        "model": STORY_MODEL,
        "messages": [
            {"role": "system", "content": STYLE_GEN_SYSTEM},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{req.image_mime};base64,{req.image_base64}"},
                    },
                    {"type": "text", "text": STYLE_GEN_USER.format(context=req.lesson_context)},
                ],
            },
        ],
        "max_tokens": 1500,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(f"{ARK_BASE}/chat/completions", json=payload, headers=_ark_headers())

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


@app.post("/api/part6/transfer")
async def style_transfer(req: StyleTransferRequest):
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    payload = {
        "model": IMAGE_MODEL,
        "prompt": req.prompt,
        "image": f"data:{req.image_mime};base64,{req.image_base64}",
        "n": 1,
        "size": "2048x2048",
        "response_format": "url",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(f"{ARK_BASE}/images/generations", json=payload, headers=_ark_headers())

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"Image generation API error: {resp.text}")

    data = resp.json()
    try:
        image_url = data["data"][0]["url"]
    except (KeyError, IndexError, TypeError):
        raise HTTPException(500, f"Unexpected image response format: {str(data)[:300]}")

    return {"image_url": image_url}


# ─── TTS ───────────────────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str
    voice_id: str = "zh_female_shuangkuaisisi_moon_bigtts"


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
