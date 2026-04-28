import json
import os

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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


def _ark_headers() -> dict:
    return {
        "Authorization": f"Bearer {ARK_API_KEY}",
        "Content-Type": "application/json",
    }


# ─── Health ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "ok": True,
        "api_key_set": bool(ARK_API_KEY),
        "story_model": STORY_MODEL,
        "video_model": VIDEO_MODEL,
    }


# ─── Story generation ──────────────────────────────────────────────────────

class StoryRequest(BaseModel):
    image_base64: str       # raw base64, no "data:" prefix
    image_mime: str = "image/jpeg"

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


@app.post("/api/story/generate")
async def generate_story(req: StoryRequest):
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    payload = {
        "model": STORY_MODEL,
        "messages": [
            {"role": "system", "content": STORY_SYSTEM},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{req.image_mime};base64,{req.image_base64}"
                        },
                    },
                    {"type": "text", "text": STORY_USER},
                ],
            },
        ],
        "max_tokens": 2000,
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

    # Strip markdown code fences if the model wraps in ```json ... ```
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1].lstrip("json").strip() if len(parts) >= 2 else raw

    try:
        story = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(500, f"Could not parse story JSON: {exc}. Raw: {raw[:300]}")

    return story


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


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not ARK_API_KEY:
        raise HTTPException(500, "ARK_API_KEY is not set")

    history = [{"role": m.role, "content": m.text} for m in req.messages]

    payload = {
        "model": CHAT_MODEL,
        "messages": [{"role": "system", "content": CHAT_SYSTEM}] + history,
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
