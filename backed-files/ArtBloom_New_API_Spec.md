# 艺芽 AI 系统 — Pilot 新增/扩展 API 规格

> 定义 pilot 前需要新增或扩展的 backend endpoints。所有改动**仍然在 `backend/main.py` 单文件内**,与现有架构风格一致。

---

## 1. 改动总览

| 操作 | 端点 | 类型 | 任务 ID |
|---|---|---|---|
| 🆕 新建 | `LessonContextManager` 类 | 类 | P0-1 |
| 🔧 扩展 | `/api/story/stream` | endpoint | P0-2 |
| 🔧 扩展 | `/api/story/continue/stream` | endpoint | P0-2 |
| 🔧 扩展 | `/api/animation/submit` | endpoint | P0-2 |
| 🔧 扩展 | `/api/part6/generate-styles` | endpoint | P0-2 |
| 🔧 扩展 | `/api/part6/transfer` | endpoint | P0-2 |
| 🔧 扩展 | `/api/chat` | endpoint | P0-2 |
| 🆕 新建 | `/api/part7/comment` | endpoint | P0-3 |
| 🔧 扩展 | `/health` | endpoint | P1-2 |

---

## 2. LessonContextManager 类(P0-1)

### 2.1 文件位置

新建文件:`backend/lesson_context.py`

### 2.2 完整实现

```python
# backend/lesson_context.py
"""
LessonContextManager (concept-level "Commander"):
Loads LKP from backend/data/lessons/*.json
Provides Part-specific context injection for Executors A/B/C/D
"""

import json
from pathlib import Path
from typing import Optional
from .lesson_types import LessonSeedData

LESSONS_DIR = Path(__file__).parent / "data" / "lessons"


class LessonContextManager:
    """Singleton-style loader. Lessons are cached in-memory after first load."""

    def __init__(self):
        self._cache: dict[str, LessonSeedData] = {}

    def load(self, lesson_id: str) -> LessonSeedData:
        """Load and validate a lesson seed. Raises ValueError if missing or malformed."""
        if lesson_id in self._cache:
            return self._cache[lesson_id]

        path = LESSONS_DIR / f"{lesson_id}.json"
        if not path.exists():
            raise ValueError(f"Lesson seed not found: {lesson_id}")

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Pydantic validation
        seed = LessonSeedData(**data)

        # Custom validation
        self._validate(seed)

        self._cache[lesson_id] = seed
        return seed

    def list_available(self) -> list[str]:
        """List all available lesson IDs (for /health)."""
        if not LESSONS_DIR.exists():
            return []
        return [p.stem for p in LESSONS_DIR.glob("*.json")]

    def _validate(self, seed: LessonSeedData) -> None:
        # slide_framework covers all 7 parts
        part_ids = {entry.part_id for entry in seed.slide_framework}
        if part_ids != {1, 2, 3, 4, 5, 6, 7}:
            raise ValueError(f"slide_framework must cover parts 1-7, got {part_ids}")

        # default_executor_b_artwork_id exists
        artwork_ids = {a.artwork_id for a in seed.textbook_artworks}
        if seed.default_executor_b_artwork_id not in artwork_ids:
            raise ValueError(
                f"default_executor_b_artwork_id {seed.default_executor_b_artwork_id} "
                f"not in textbook_artworks"
            )

        # executor_d_styles has exactly 3
        if len(seed.executor_d_styles.styles) != 3:
            raise ValueError(
                f"executor_d_styles.styles must have 3 items, got {len(seed.executor_d_styles.styles)}"
            )

    # ========================================================================
    # Context injection helpers (called by main.py endpoints)
    # ========================================================================

    def build_executor_a_context(self, lesson_id: str, part_id: int) -> str:
        """
        Returns the system-prompt CONTEXT for Executor A on a given Part.
        Caller appends this to the base system prompt.
        """
        seed = self.load(lesson_id)
        part_prompts = seed.executor_a_part_prompts

        if part_id == 1:
            return part_prompts.part1
        elif part_id == 2:
            return part_prompts.part2
        elif part_id == 4:
            return part_prompts.part4
        elif part_id == 5:
            return part_prompts.part5
        else:
            return ""  # Parts 3/6 use Executors B/C/D, not Executor A
            # Part 7 uses /api/part7/comment, not /api/chat

    def build_executor_b_context(
        self, lesson_id: str, artwork_id: Optional[str] = None
    ) -> dict:
        """
        Returns {artwork, story_hint, learning_task, unit_idea} for Story generation.
        """
        seed = self.load(lesson_id)
        chosen_id = artwork_id or seed.default_executor_b_artwork_id

        artwork = next(
            (a for a in seed.textbook_artworks if a.artwork_id == chosen_id),
            None
        )
        if artwork is None:
            raise ValueError(f"Artwork {chosen_id} not in lesson {lesson_id}")

        return {
            "artwork": artwork.dict(),
            "story_hint": artwork.executor_b_prompt_hint_zh,
            "learning_task": seed.learning_task_zh,
            "unit_idea": seed.unit_big_idea_zh,
        }

    def build_executor_c_context(
        self, lesson_id: str, artwork_id: Optional[str] = None
    ) -> dict:
        """
        Returns {artwork_url, mood} for Animation generation.
        """
        seed = self.load(lesson_id)
        chosen_id = artwork_id or seed.default_executor_b_artwork_id

        artwork = next(
            (a for a in seed.textbook_artworks if a.artwork_id == chosen_id),
            None
        )
        if artwork is None:
            raise ValueError(f"Artwork {chosen_id} not in lesson {lesson_id}")

        if not artwork.recommended_for_executor_c:
            # Caller may warn user, but still allow
            pass

        return {
            "artwork_url": artwork.image_url,
            "mood": seed.animation_default_mood,
        }

    def build_executor_d_context(self, lesson_id: str) -> dict:
        """
        Returns {styles, branch, lesson_summary} for Part 6 style transfer.
        """
        seed = self.load(lesson_id)
        return {
            "styles": [s.dict() for s in seed.executor_d_styles.styles],
            "branch": seed.executor_d_styles.branch,
            "lesson_summary": f"{seed.lesson_title_zh} — {seed.learning_task_zh}",
        }

    def build_part7_comment_context(self, lesson_id: str) -> dict:
        """
        Returns the full context for /api/part7/comment.
        """
        seed = self.load(lesson_id)
        return {
            "system_prompt": seed.executor_a_part_prompts.part7.system_prompt,
            "word_count": seed.executor_a_part_prompts.part7.feedback_word_count,
            "dimensions": seed.executor_a_part_prompts.part7.feedback_dimensions,
            "tone": seed.executor_a_part_prompts.part7.encouragement_tone,
            "assessment_criteria": [c.dict() for c in seed.assessment_criteria],
            "learning_objectives": seed.learning_objectives,
            "key_concepts": seed.key_art_concepts,
        }


# Singleton instance (import this in main.py)
lesson_manager = LessonContextManager()
```

### 2.3 在 main.py 中使用

```python
# backend/main.py (顶部 import)
from .lesson_context import lesson_manager
```

---

## 3. 扩展现有 endpoints(P0-2)

所有 6 个 endpoint **新增可选参数**(向后兼容,旧调用方仍能用):

- `lesson_id: Optional[str]` — 选定的 lesson(`g2v2-u4-l4` 等)
- `part_id: Optional[int]` — 用户当前所在 Part(仅 `/api/chat` 需要)
- `artwork_id: Optional[str]` — Executor B/C 用,选 textbook_artworks 中的某个作品

### 3.1 `/api/story/stream` 扩展

**请求 schema 改动**:

```python
# Before:
class StoryGenerateRequest(BaseModel):
    image_base64: str
    image_mime: str
    language: str = "zh"

# After:
class StoryGenerateRequest(BaseModel):
    image_base64: str
    image_mime: str
    language: str = "zh"
    lesson_id: Optional[str] = None      # 🆕
    artwork_id: Optional[str] = None     # 🆕
```

**endpoint 改动**:

```python
@app.post("/api/story/stream")
async def story_stream(req: StoryGenerateRequest):
    # 🆕 注入 LKP context
    lesson_context = ""
    if req.lesson_id:
        try:
            ctx = lesson_manager.build_executor_b_context(req.lesson_id, req.artwork_id)
            lesson_context = (
                f"\n\n[本课信息]\n"
                f"学习任务: {ctx['learning_task']}\n"
                f"单元大概念: {ctx['unit_idea']}\n"
                f"故事提示: {ctx['story_hint']}\n"
            )
        except ValueError as e:
            raise HTTPException(404, str(e))

    # Existing logic 继续(注入 lesson_context 到 STORY_SYSTEM)
    system_prompt = STORY_SYSTEM + lesson_context + _lang_suffix(req.language)
    # ... rest unchanged
```

### 3.2 `/api/story/continue/stream` 扩展

**请求 schema 改动**:

```python
class StoryContinueRequest(BaseModel):
    part1: str
    choice_label: str
    choice_desc: str
    language: str = "zh"
    lesson_id: Optional[str] = None      # 🆕
```

**endpoint 改动**:

类似 `/api/story/stream`,注入 `learning_task` + `unit_idea` 到 system prompt,确保续写仍对齐课程目标。

### 3.3 `/api/animation/submit` 扩展

**请求 schema 改动**:

```python
class AnimationSubmitRequest(BaseModel):
    image_base64: str
    image_mime: str
    lesson_id: Optional[str] = None      # 🆕
    artwork_id: Optional[str] = None     # 🆕
```

**endpoint 改动**:

```python
@app.post("/api/animation/submit")
async def animation_submit(req: AnimationSubmitRequest):
    mood = "gentle, dreamy"  # default
    if req.lesson_id:
        try:
            ctx = lesson_manager.build_executor_c_context(req.lesson_id, req.artwork_id)
            mood = ctx["mood"]
        except ValueError:
            pass  # fallback to default mood

    # Existing Seedance call, append mood to prompt
    # ... rest unchanged
```

### 3.4 `/api/part6/generate-styles` 扩展

**请求 schema 改动**:

```python
class Part6StylesRequest(BaseModel):
    sketch_base64: str
    sketch_mime: str
    language: str = "zh"
    lesson_id: Optional[str] = None      # 🆕
```

**endpoint 改动**:

```python
@app.post("/api/part6/generate-styles")
async def part6_generate_styles(req: Part6StylesRequest):
    # 🆕 如果有 lesson_id,直接返回 LKP 预定义的 3 个 style
    if req.lesson_id:
        try:
            ctx = lesson_manager.build_executor_d_context(req.lesson_id)
            if ctx["branch"] == "B":
                # B 类(实物制作)课程,Part 6 不适用
                return {
                    "lesson_summary": ctx["lesson_summary"],
                    "styles": [],  # frontend 显示"本课无作品风格转换"
                    "branch": "B",
                }
            return {
                "lesson_summary": ctx["lesson_summary"],
                "styles": [
                    {"label": s["style_name_zh"], "prompt": s["image_gen_prompt_template_en"]}
                    for s in ctx["styles"]
                ],
                "branch": "A",
            }
        except ValueError:
            pass  # fallback to LLM generation

    # Existing logic: 用 Vision LLM 生成 3 个 style(向后兼容)
    # ... rest unchanged
```

### 3.5 `/api/part6/transfer` 扩展

**请求 schema 改动**:

```python
class Part6TransferRequest(BaseModel):
    sketch_base64: str
    sketch_mime: str
    style_prompt: str
    lesson_id: Optional[str] = None      # 🆕(用于日志记录,不影响功能)
```

**endpoint 改动**:

如果有 `lesson_id`,在请求日志中记录,便于 pilot 数据分析。功能逻辑**不变**。

### 3.6 `/api/chat` 扩展

这是 Executor A 在 Part 1/2/4/5 的主入口。

**请求 schema 改动**:

```python
class ChatRequest(BaseModel):
    history: list[dict]               # 已有
    language: str = "zh"              # 已有
    lesson_id: Optional[str] = None   # 🆕
    part_id: Optional[int] = None     # 🆕 (1, 2, 4, or 5)
```

**endpoint 改动**:

```python
@app.post("/api/chat")
async def chat(req: ChatRequest):
    # 🆕 注入 Part-specific LKP context
    lesson_context = ""
    if req.lesson_id and req.part_id in (1, 2, 4, 5):
        try:
            lesson_context = lesson_manager.build_executor_a_context(req.lesson_id, req.part_id)
        except ValueError:
            pass

    system_prompt = CHAT_SYSTEM + ("\n\n" + lesson_context if lesson_context else "") + _lang_suffix(req.language)
    # ... rest unchanged
```

---

## 4. 新建 `/api/part7/comment`(P0-3)

### 4.1 用途

Part 7 commenter:学生上传一张作品照片,系统返回 100-120 字的反馈评论,涵盖本课的 assessment_criteria + key_art_concepts。

### 4.2 请求 / 响应

**请求**:

```python
class Part7CommentRequest(BaseModel):
    student_work_base64: str          # 学生作品照片(base64)
    student_work_mime: str            # 'image/jpeg' 等
    lesson_id: str                    # 必填,e.g. 'g2v2-u4-l4'
    language: str = "zh"              # 'zh' or 'en'
    student_note: Optional[str] = None  # 学生自评(可选,1-2 句话)
```

**响应**:

```python
class Part7CommentResponse(BaseModel):
    feedback_text: str                # 100-120 字反馈
    word_count: int                   # 实际字数
    dimensions_covered: list[str]     # 实际覆盖的评价维度
    timestamp: str                    # ISO 时间戳
```

### 4.3 实现

```python
@app.post("/api/part7/comment", response_model=Part7CommentResponse)
async def part7_comment(req: Part7CommentRequest):
    # 1. 加载 LKP context
    try:
        ctx = lesson_manager.build_part7_comment_context(req.lesson_id)
    except ValueError as e:
        raise HTTPException(404, str(e))

    # 2. 构建 system prompt
    min_w, max_w = ctx["word_count"]
    dimensions_str = "、".join(ctx["dimensions"])
    objectives_str = "\n".join(
        f"- {k}: {v}" for k, v in ctx["learning_objectives"].items()
    )

    system_prompt = (
        ctx["system_prompt"]
        + f"\n\n[本课学习目标]\n{objectives_str}"
        + f"\n\n[关键概念] {', '.join(ctx['key_concepts'])}"
        + f"\n\n[评价维度] 请在评论中覆盖:{dimensions_str}"
        + f"\n\n[字数要求] {min_w}-{max_w} 字"
        + f"\n\n[语气] {ctx['tone']}(warm=温暖鼓励 / professional=专业客观 / playful=活泼有趣)"
    )
    if req.language == "en":
        system_prompt += "\n\nWrite the feedback in English."

    # 3. 构建 user message(图片 + 学生自评)
    user_content = [
        {
            "type": "image_url",
            "image_url": {
                "url": f"data:{req.student_work_mime};base64,{req.student_work_base64}"
            }
        },
        {
            "type": "text",
            "text": (
                "请基于以上学生作品和本课的学习目标,给出 100-120 字的鼓励性反馈。"
                + (f"\n\n学生自评:{req.student_note}" if req.student_note else "")
            )
        }
    ]

    # 4. 调用 Vision LLM(复用现有 STORY 端点同款模型)
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{ARK_API_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {ARK_API_KEY}"},
            json={
                "model": ARK_STORY_MODEL,  # 用 vision 模型
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                "temperature": 0.7,
                "max_tokens": 400,
            },
        )
        resp.raise_for_status()
        result = resp.json()

    feedback_text = result["choices"][0]["message"]["content"].strip()

    # 5. 后处理(简单字数 + 维度统计)
    word_count = len(feedback_text)  # 中文按字符算

    dimensions_covered = [
        d for d in ctx["dimensions"]
        if d in feedback_text
    ]

    return Part7CommentResponse(
        feedback_text=feedback_text,
        word_count=word_count,
        dimensions_covered=dimensions_covered,
        timestamp=datetime.now().isoformat(),
    )
```

### 4.4 错误处理

| 情况 | HTTP | message |
|---|---|---|
| `lesson_id` 不存在 | 404 | `Lesson seed not found: {lesson_id}` |
| LKP malformed | 500 | `LKP malformed: ...` |
| Ark API 超时 | 504 | `LLM timeout` |
| 字数超出 [min, max] | 200(仍返回) | response 仍返回,frontend 自行决定如何展示 |

---

## 5. 扩展 `/health`(P1-2,可选)

**响应改动**:

```python
@app.get("/health")
async def health():
    return {
        "ok": True,
        "api_key_set": bool(os.getenv("ARK_API_KEY")),
        "story_model": ARK_STORY_MODEL,
        "video_model": ARK_VIDEO_MODEL,
        "image_model": ARK_IMAGE_MODEL,
        "tts_voices": [...],  # 已有
        # 🆕 新增
        "available_lessons": lesson_manager.list_available(),
    }
```

---

## 6. 完整 endpoints 清单(改造后)

| Method | Path | 改动 |
|---|---|---|
| GET    | `/health` | 🔧 新增 `available_lessons` 字段 |
| POST   | `/api/story/generate` | (向后兼容,可不动) |
| POST   | `/api/story/stream` | 🔧 新增 `lesson_id`, `artwork_id` 参数 |
| POST   | `/api/story/continue` | (向后兼容,可不动) |
| POST   | `/api/story/continue/stream` | 🔧 新增 `lesson_id` 参数 |
| POST   | `/api/animation/submit` | 🔧 新增 `lesson_id`, `artwork_id` 参数 |
| GET    | `/api/animation/status/{task_id}` | 不变 |
| POST   | `/api/chat` | 🔧 新增 `lesson_id`, `part_id` 参数 |
| POST   | `/api/part6/generate-styles` | 🔧 新增 `lesson_id` 参数 |
| POST   | `/api/part6/transfer` | 🔧 新增 `lesson_id` 参数(仅日志) |
| GET    | `/api/tts/voices` | 不变 |
| POST   | `/api/tts` | 不变 |
| **POST** | **`/api/part7/comment`** | 🆕 新建 |

---

## 7. 向后兼容性

所有 `lesson_id` 字段都是 `Optional`。即使前端旧代码不传 `lesson_id`,endpoint 也能照常工作(回退到原有逻辑)。

这意味着:
- 工程师可以**逐步**前端,而不会 break 现有功能
- pilot 之外的老师如不指定 lesson 也能用系统

---

## 8. 测试验证

### 8.1 LessonContextManager 单元测试

```python
# backend/tests/test_lesson_context.py (新建)
import pytest
from backend.lesson_context import lesson_manager

def test_load_all_4_pilot_lessons():
    for lesson_id in ["g2v2-u4-l4", "g2v2-u4-l5", "g2v2-u5-l1", "g2v2-u5-l2"]:
        seed = lesson_manager.load(lesson_id)
        assert seed.lesson_id == lesson_id

def test_load_missing_raises():
    with pytest.raises(ValueError, match="Lesson seed not found"):
        lesson_manager.load("g99v9-u9-l9")

def test_executor_b_context_default_artwork():
    ctx = lesson_manager.build_executor_b_context("g2v2-u4-l4")
    assert ctx["artwork"]["recommended_for_executor_b"] is True
    assert "learning_task" in ctx

def test_executor_d_context_branch_b():
    # U5-L2 是 B 类(自制乐器),Part 6 不适用
    ctx = lesson_manager.build_executor_d_context("g2v2-u5-l2")
    assert ctx["branch"] == "B"
```

### 8.2 集成测试

```bash
# 测试 LKP 注入是否正常工作
curl -X POST http://localhost:8001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "history": [{"role": "user", "content": "我该怎么开始这节课?"}],
    "language": "zh",
    "lesson_id": "g2v2-u4-l4",
    "part_id": 1
  }'

# 期望:返回的助手回复中包含与 U4-L4《好长好长》课程目标相关的引导
```

### 8.3 Part 7 commenter 测试

```bash
# 需要一张测试图片
curl -X POST http://localhost:8001/api/part7/comment \
  -H "Content-Type: application/json" \
  -d '{
    "student_work_base64": "<base64 string>",
    "student_work_mime": "image/jpeg",
    "lesson_id": "g2v2-u4-l4",
    "language": "zh"
  }'

# 期望:
# - feedback_text 100-120 字
# - dimensions_covered 数组非空
# - 反馈中提到本课的"夸张"/"联想"等 key_art_concepts
```

---

> 本 API spec 作者声明:所有 endpoint 改动**严格基于真实系统 `backend/main.py` (commit 3162456) 的现有结构**进行扩展,**不重构任何现有逻辑**。Claude Code 实现时,务必使用现有的 `httpx.AsyncClient` / `StreamingResponse` / `_lang_suffix` 等已有 utility,不要自造轮子。
