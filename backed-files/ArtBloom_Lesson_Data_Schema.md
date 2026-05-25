# 艺芽 AI 系统 — Lesson Data Schema (LKP)

> **定义** Lesson Knowledge Package (LKP) 的完整数据结构,作为 backend 和 frontend 的共享 schema。
>
> **使用者**: Commander (LessonContextManager) 加载 LKP 给 Executors;Community 页面读取 LKP seed 给老师。

---

## 1. 概念定位

### 1.1 LKP 是什么

**LKP (Lesson Knowledge Package)** 是一节课的**完整数据包**,包含:

- 课程元信息(教材年级、单元、课次、目标、概念)
- 7 个 Part 的 seed slides 结构(老师可基于此 deep copy 自定义)
- Executor B/C/D 的预设资源(教材作品、动画风格、Part 6 风格选项)
- Executor A 的 Part-specific system prompt 模板
- Part 7 commenter 的评价 rubric(对照 learning_objectives)

### 1.2 LKP 在系统中的两份存储

| 位置 | 用途 |
|---|---|
| `backend/data/lessons/{lesson_id}.json` | LessonContextManager 加载,给 Executors 注入 context |
| `frontend/src/data/lessons/{lesson_id}.json` | Community 页面读取,展示 seed 卡片 + Save 时 deep copy |

⚠️ **两份必须同步**(可用 git submodule、symlink 或 build 脚本拷贝)。本 spec 推荐**单一来源** + **build 脚本拷贝**:
- source: `backend/data/lessons/*.json`
- frontend build 前,运行 `npm run sync-lessons`(下文定义)
- frontend 直接 `import` 拷贝来的 JSON

### 1.3 与现有 `curriculum.ts` 的关系

`curriculum.ts` 是**课程目录**(列出 12 个册 × 5 单元 × 5 课次 = 300 个 lesson 的简要信息,字段:`id`, `titleEn`, `titleZh`, `task`, `category`, `aiSupport`)。

LKP 是**已完成开发的课程的完整数据**(字段几十个,详见下文)。

对齐方式:
- `curriculum.ts` 的 lesson 中,只有 `available: true` 的 lesson 才有对应的 LKP
- pilot 期间只有 4 节 lesson 有 LKP(U4-L4 / U4-L5 / U5-L1 / U5-L2)
- 老师在 LessonSelectionModal 选课时,如选了无 LKP 的课程,backend 报错"lesson seed not available"

---

## 2. LKP TypeScript 完整接口定义

把以下接口放到 `frontend/src/types/lesson.ts` 和 `backend/lesson_types.py`(Pydantic 镜像)。

### 2.1 顶层接口

```typescript
// frontend/src/types/lesson.ts
export interface LessonSeedData {
  // === 1. 元信息 ===
  lesson_id: string;                  // 'g2v2-u4-l4'(与 curriculum.ts 的 id 一致)
  lesson_title_zh: string;            // '好长好长……'
  lesson_title_en: string;            // 'So Long, So Long...'
  unit_id: string;                    // 'g2v2-u4'
  unit_title_zh: string;
  unit_title_en: string;
  unit_big_idea_zh: string;           // 单元大概念
  grade: number;                      // 1-6
  volume: 1 | 2;                      // 上册 / 下册
  publisher: string;                  // '湖南美术出版社'
  textbook_page_range: [number, number];   // [44, 45]
  teacher_guide_page_range: [number, number];

  // === 2. 课程目标 ===
  category: 'A' | 'B';                // A=2D 绘画 / B=实物制作
  category_reason: string;            // 为什么是 A 或 B 的简短说明
  learning_task_zh: string;           // 教材主任务描述
  learning_objectives: {
    know: string;                     // "知道"层目标
    understand: string;               // "理解"层目标
    do: string;                       // "能做"层目标
  };
  key_art_concepts: string[];         // ['夸张', '联想', '形式与内容的关系']
  teaching_focus_zh: string;          // 教学重点
  teaching_difficulty_zh: string;     // 教学难点
  driving_question_zh: string;        // 驱动性问题
  guiding_questions_zh: string[];     // 引导性问题清单
  assessment_criteria: AssessmentCriterion[];

  // === 3. 7 个 Part 的 seed 结构 ===
  slide_framework: SlideFrameworkEntry[];

  // === 4. Executor B 用 ===
  textbook_artworks: TextbookArtwork[];      // 教材内的艺术家作品
  default_executor_b_artwork_id: string;     // Part 3 默认推荐的作品 id

  // === 5. Executor C 用 ===
  animation_default_mood: string;            // 'gentle, dreamy, slow zoom'

  // === 6. Executor D 用 ===
  executor_d_styles: ExecutorDStyles;        // Part 6 的 3 个风格选项

  // === 7. Executor A 用 ===
  executor_a_part_prompts: ExecutorAPartPrompts;  // 各 Part 的 system prompt 模板

  // === 8. Part 5 example 资源 ===
  example_video_url: string;                 // CDN URL
  example_video_notes_zh: string;            // 教师如何使用此视频的说明

  // === 9. Part 5 音频(可选,仅《听听画画》)===
  audio_resources?: AudioResource[];

  // === 10. TTS / 教学风格 ===
  tts_voice_recommendation: string;          // 'zh-CN-XiaoxiaoNeural'
  classroom_activity: ClassroomActivity;
  suggested_ai_support_zh: string;           // 建议老师使用的 AI 流程总结
}
```

### 2.2 嵌套接口

```typescript
export interface AssessmentCriterion {
  dimension: string;                // '主题表现'
  description_zh: string;           // 学生作品在此维度的期望表现
  excellent_zh: string;             // 优秀级别描述
  acceptable_zh: string;            // 合格级别描述
}

export interface SlideFrameworkEntry {
  page: number;                     // 1-N(N >= 7)
  part_id: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  section: string;                  // '封面' / '导入·儿歌激趣' 等
  content_points: string;           // 该幻灯片内容要点
  asset_types: string;              // '背景图、标题艺术字'
  default_elements?: SlideElement[];        // 该幻灯片的默认元素(可选)
  default_background?: string;              // CDN URL or color code
}

export interface SlideElement {
  // 镜像 frontend/src/stores/slides.ts 中的 SlideElement 接口
  type: 'text' | 'image';
  x: number; y: number; width: number; height: number;
  content: string;
  fontSize?: number; fontWeight?: string; fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  src?: string;                     // 对 image 类型必需
  flipH?: boolean; flipV?: boolean; rotation?: number;
}

export interface TextbookArtwork {
  artwork_id: string;               // 'G2V2-U4-L4-art01'
  title_zh: string;
  artist_zh: string;
  year?: number;
  medium_zh: string;                // '图画书' / '油画' 等
  image_url: string;                // CDN URL (e.g. R2 / OSS)
  license_status: string;           // pilot 版权说明
  textbook_position: string;        // 'page 44'
  visual_description_zh: string;    // 给 LLM 的视觉描述 hint
  teacher_guide_notes_zh: string;
  executor_b_prompt_hint_zh: string;        // 给 Story 生成的内容 hint
  recommended_for_executor_b: boolean;      // 此作品是否适合 Part 3 故事
  recommended_for_executor_c: boolean;      // 此作品是否适合 Part 3 动画
  narrative_richness: 'low' | 'medium' | 'high';
}

export interface ExecutorDStyles {
  branch: 'A' | 'B';                // Part 6 是否激活;某些课 B 类不用 Part 6
  styles: ExecutorDStyle[];         // 3 个固定风格选项
}

export interface ExecutorDStyle {
  style_id: number;                 // 1, 2, 3
  style_name_zh: string;            // '更夸张'
  style_description_zh: string;
  linked_learning_objective: string;
  image_gen_prompt_template_en: string;     // 喂给 Seedream 的 prompt
  model_recommendation: string;             // 'doubao-seedream-5-0-260128'
}

export interface ExecutorAPartPrompts {
  // 每个 Part 的 system prompt 模板,Executor A 根据 part_id 选用
  part1: string;                    // Cover & Opening
  part2: string;                    // Hook & Guided Attention
  part4: string;                    // Making Task
  part5: string;                    // Making Example
  part7: ExecutorAPart7Prompt;      // Part 7 commenter 比较复杂
}

export interface ExecutorAPart7Prompt {
  system_prompt: string;            // 评价学生作品的 system prompt
  feedback_word_count: [number, number];  // [100, 120]
  feedback_dimensions: string[];          // ['主题表现', '夸张运用', '色彩', '故事感']
  encouragement_tone: 'warm' | 'professional' | 'playful';
}

export interface ClassroomActivity {
  task_zh: string;
  task_en: string;
  duration_minutes: number;
  materials_zh: string[];
  safety_notes_zh: string[];
  expected_outcome_zh: string;
}

export interface AudioResource {
  audio_id: string;                 // 'g2v2-u5-l1-audio01'
  title_zh: string;                 // '欢快的舞曲'
  url: string;                      // CDN URL
  duration_seconds: number;
  usage_in_part: 2 | 3 | 4;         // 哪个 Part 用
  description_zh: string;
}
```

### 2.3 Pydantic 镜像(backend/lesson_types.py)

```python
# backend/lesson_types.py
from pydantic import BaseModel
from typing import Literal, Optional

class AssessmentCriterion(BaseModel):
    dimension: str
    description_zh: str
    excellent_zh: str
    acceptable_zh: str

class SlideElement(BaseModel):
    type: Literal['text', 'image']
    x: float
    y: float
    width: float
    height: float
    content: str
    fontSize: Optional[float] = None
    fontWeight: Optional[str] = None
    fontFamily: Optional[str] = None
    textAlign: Optional[Literal['left', 'center', 'right']] = None
    color: Optional[str] = None
    src: Optional[str] = None
    flipH: Optional[bool] = None
    flipV: Optional[bool] = None
    rotation: Optional[float] = None

class SlideFrameworkEntry(BaseModel):
    page: int
    part_id: Literal[1, 2, 3, 4, 5, 6, 7]
    section: str
    content_points: str
    asset_types: str
    default_elements: Optional[list[SlideElement]] = None
    default_background: Optional[str] = None

class TextbookArtwork(BaseModel):
    artwork_id: str
    title_zh: str
    artist_zh: str
    year: Optional[int] = None
    medium_zh: str
    image_url: str
    license_status: str
    textbook_position: str
    visual_description_zh: str
    teacher_guide_notes_zh: str
    executor_b_prompt_hint_zh: str
    recommended_for_executor_b: bool
    recommended_for_executor_c: bool
    narrative_richness: Literal['low', 'medium', 'high']

class ExecutorDStyle(BaseModel):
    style_id: int
    style_name_zh: str
    style_description_zh: str
    linked_learning_objective: str
    image_gen_prompt_template_en: str
    model_recommendation: str

class ExecutorDStyles(BaseModel):
    branch: Literal['A', 'B']
    styles: list[ExecutorDStyle]

class ExecutorAPart7Prompt(BaseModel):
    system_prompt: str
    feedback_word_count: tuple[int, int]
    feedback_dimensions: list[str]
    encouragement_tone: Literal['warm', 'professional', 'playful']

class ExecutorAPartPrompts(BaseModel):
    part1: str
    part2: str
    part4: str
    part5: str
    part7: ExecutorAPart7Prompt

class ClassroomActivity(BaseModel):
    task_zh: str
    task_en: str
    duration_minutes: int
    materials_zh: list[str]
    safety_notes_zh: list[str]
    expected_outcome_zh: str

class AudioResource(BaseModel):
    audio_id: str
    title_zh: str
    url: str
    duration_seconds: int
    usage_in_part: Literal[2, 3, 4]
    description_zh: str

class LessonSeedData(BaseModel):
    lesson_id: str
    lesson_title_zh: str
    lesson_title_en: str
    unit_id: str
    unit_title_zh: str
    unit_title_en: str
    unit_big_idea_zh: str
    grade: int
    volume: Literal[1, 2]
    publisher: str
    textbook_page_range: tuple[int, int]
    teacher_guide_page_range: tuple[int, int]
    category: Literal['A', 'B']
    category_reason: str
    learning_task_zh: str
    learning_objectives: dict          # {know, understand, do}
    key_art_concepts: list[str]
    teaching_focus_zh: str
    teaching_difficulty_zh: str
    driving_question_zh: str
    guiding_questions_zh: list[str]
    assessment_criteria: list[AssessmentCriterion]
    slide_framework: list[SlideFrameworkEntry]
    textbook_artworks: list[TextbookArtwork]
    default_executor_b_artwork_id: str
    animation_default_mood: str
    executor_d_styles: ExecutorDStyles
    executor_a_part_prompts: ExecutorAPartPrompts
    example_video_url: str
    example_video_notes_zh: str
    audio_resources: Optional[list[AudioResource]] = None
    tts_voice_recommendation: str
    classroom_activity: ClassroomActivity
    suggested_ai_support_zh: str
```

---

## 3. 字段语义(给 Claude Code 看的"为什么"说明)

每个字段都有明确的消费者,让 Claude Code 知道**为什么**这个字段存在。

### 3.1 Executor A 消费的字段

| 字段 | Executor A 怎么用 |
|---|---|
| `executor_a_part_prompts.part1` | 老师在 Part 1 触发右侧聊天时,system prompt 注入此模板 |
| `executor_a_part_prompts.part2` | Part 2 chatbot 的 system prompt |
| `executor_a_part_prompts.part4` | Part 4 chatbot |
| `executor_a_part_prompts.part5` | Part 5 chatbot |
| `executor_a_part_prompts.part7` | Part 7 commenter(`/api/part7/comment` 用此 prompt) |
| `learning_objectives` | Part 7 评分时,commenter 对照此目标给反馈 |
| `key_art_concepts` | Part 7 评论时,优先提及这些概念 |
| `assessment_criteria` | Part 7 评分维度直接来自此字段 |

### 3.2 Executor B 消费的字段

| 字段 | Executor B 怎么用 |
|---|---|
| `textbook_artworks[]` | Part 3 老师选作品时,前端展示此列表;`recommended_for_executor_b: true` 的作品优先 |
| `default_executor_b_artwork_id` | 老师如不主动选,自动用此作品(适合"懒人模式") |
| `textbook_artworks[].executor_b_prompt_hint_zh` | 注入到 STORY_SYSTEM prompt,引导故事方向 |
| `textbook_artworks[].visual_description_zh` | 注入 prompt,给 LLM 视觉 hint(如果作品图片质量不高) |
| `learning_task_zh` | 注入,确保故事与本课任务对齐 |
| `unit_big_idea_zh` | 注入,故事呼应单元大概念 |

### 3.3 Executor C 消费的字段

| 字段 | Executor C 怎么用 |
|---|---|
| `textbook_artworks[].image_url` | Part 3 动画生成使用的源图 |
| `textbook_artworks[].recommended_for_executor_c: true` | 标记哪些作品适合做动画(有些静态作品不适合) |
| `animation_default_mood` | 注入到 Seedance 的 prompt(`gentle, dreamy, slow zoom`) |

### 3.4 Executor D 消费的字段

| 字段 | Executor D 怎么用 |
|---|---|
| `executor_d_styles.branch: 'B'` | B 类(实物制作)课程 Part 6 显示"本课无作品风格转换"占位 |
| `executor_d_styles.styles[]` | A 类课程,Part 6 直接展示这 3 个风格 |
| `executor_d_styles.styles[].image_gen_prompt_template_en` | 调用 Seedream 时使用此 prompt |
| `executor_d_styles.styles[].linked_learning_objective` | UI 在风格卡片上展示"对应学习目标"标签 |

### 3.5 Part 5 字段

| 字段 | Part 5 怎么用 |
|---|---|
| `example_video_url` | 老师在 Part 5 默认看到此视频(可替换) |
| `example_video_notes_zh` | 视频下方展示教师指导说明 |
| `audio_resources[]` | 仅《听听画画》(U5-L1)用,在 Part 2/3 嵌入音频播放器 |

### 3.6 Part 7 commenter 评论字段

| 字段 | Part 7 怎么用 |
|---|---|
| `executor_a_part_prompts.part7.system_prompt` | `/api/part7/comment` 的 system prompt |
| `executor_a_part_prompts.part7.feedback_word_count: [100, 120]` | 限制 commenter 输出字数 |
| `executor_a_part_prompts.part7.feedback_dimensions: ['主题表现', ...]` | commenter 评论必须覆盖这些维度 |
| `executor_a_part_prompts.part7.encouragement_tone: 'warm'` | 评论语气 |
| `assessment_criteria` | commenter 实际打分参考 |
| `learning_objectives` | commenter 评论 ground truth |

---

## 4. 校验规则

LessonContextManager 加载 LKP 时,必须校验:

```python
def validate_lesson_seed(data: dict) -> LessonSeedData:
    """
    1. Pydantic 自动校验所有字段类型
    2. 额外校验:
       - slide_framework 必须覆盖 part_id 1-7(每个 part 至少 1 条)
       - default_executor_b_artwork_id 必须存在于 textbook_artworks
       - executor_d_styles.styles 长度必须恰好为 3
       - feedback_word_count 必须 (min, max) 且 min <= max
       - lesson_id 必须匹配 curriculum.ts 的某个 id
    3. 校验失败:抛 HTTPException(500, "LKP malformed: ...")
    """
    seed = LessonSeedData(**data)
    
    # 自定义校验
    part_ids_covered = {entry.part_id for entry in seed.slide_framework}
    if part_ids_covered != {1, 2, 3, 4, 5, 6, 7}:
        raise ValueError(f"slide_framework must cover all 7 parts, got {part_ids_covered}")
    
    artwork_ids = {a.artwork_id for a in seed.textbook_artworks}
    if seed.default_executor_b_artwork_id not in artwork_ids:
        raise ValueError(f"default_executor_b_artwork_id {seed.default_executor_b_artwork_id} not in textbook_artworks")
    
    if len(seed.executor_d_styles.styles) != 3:
        raise ValueError(f"executor_d_styles.styles must have exactly 3, got {len(seed.executor_d_styles.styles)}")
    
    min_w, max_w = seed.executor_a_part_prompts.part7.feedback_word_count
    if min_w > max_w:
        raise ValueError(f"feedback_word_count: min {min_w} > max {max_w}")
    
    return seed
```

---

## 5. 文件命名 + 同步约定

### 5.1 文件命名

每个 lesson 对应 1 个 JSON 文件:

```
backend/data/lessons/
├── g2v2-u4-l4.json
├── g2v2-u4-l5.json
├── g2v2-u5-l1.json
└── g2v2-u5-l2.json
```

⚠️ 文件名小写,与 `curriculum.ts` 的 `lesson_id` 完全一致。

### 5.2 同步到 frontend

在 frontend `package.json` 加 script:

```json
{
  "scripts": {
    "sync-lessons": "node scripts/sync-lessons.js"
  }
}
```

`frontend/scripts/sync-lessons.js`:

```javascript
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../../backend/data/lessons');
const DST = path.resolve(__dirname, '../src/data/lessons');

if (!fs.existsSync(SRC)) {
  console.error(`Source missing: ${SRC}`);
  process.exit(1);
}

if (!fs.existsSync(DST)) {
  fs.mkdirSync(DST, { recursive: true });
}

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.json'));
for (const f of files) {
  fs.copyFileSync(path.join(SRC, f), path.join(DST, f));
  console.log(`✓ synced ${f}`);
}
console.log(`Synced ${files.length} lesson files.`);
```

调用方式:
- 每次 backend 改 LKP 后,在 frontend 跑 `npm run sync-lessons`
- 也可加到 `prebuild` 钩子:`"prebuild": "npm run sync-lessons"`

---

## 6. 与 curriculum.ts 的对齐

工程师需要同时改 `curriculum.ts`,标记 4 个 pilot lesson 为 `available: true`(其他保持 `false`),并加一个新字段:

```typescript
// frontend/src/data/curriculum.ts (扩展)
export interface CurriculumLesson {
  id: string
  number: number
  titleEn: string
  titleZh: string
  task: string
  category: 'A' | 'B'
  aiSupport: string
  hasSeedLKP?: boolean;           // 🆕 新增:是否有 LKP seed
}
```

在 g2v2 unit 4 / unit 5 的对应 lesson 行,加 `hasSeedLKP: true`。

LessonSelectionModal 看到 `hasSeedLKP: true` 的课次,标"★ Pilot 课程"标签(或类似明显标识)。

---

## 7. 实例化的 4 个 lesson JSON

4 个具体的 LKP JSON 文件(`g2v2-u4-l4.json` 等)随本 spec 一起交付,工程师可以直接放到 `backend/data/lessons/` 目录使用。

⚠️ 4 个 JSON 中的 `image_url` / `example_video_url` 字段当前是占位 CDN 路径(如 `https://artbloom-cdn.example.com/lessons/g2v2-u4-l4/artworks/art01.jpg`),**研究员会单独提供真实素材包**,工程师把素材上传到实际 CDN 后,**批量替换**这些 URL。

具体素材上传 + URL 替换流程:

1. 研究员把素材包(图片 + 视频 + 音频)通过云盘共享给工程师
2. 工程师把素材上传到 CDN(R2 / OSS / Cloudinary),保持目录结构:
   ```
   {cdn-base}/lessons/g2v2-u4-l4/artworks/art01.jpg
   {cdn-base}/lessons/g2v2-u4-l4/example/video.mp4
   {cdn-base}/lessons/g2v2-u5-l1/audio/audio01.mp3
   ```
3. 工程师在 4 个 LKP JSON 中,把所有 `https://artbloom-cdn.example.com` 全局替换为实际 CDN 域名
4. 跑 `npm run sync-lessons` 同步到 frontend

---

> 本 schema 作者声明:本规格基于真实系统 `art_edu` commit `3162456` 设计,所有字段名、类型、命名约定均与现有代码风格(Vue + TypeScript + FastAPI + Pydantic)兼容。Claude Code 实现时**严格按本 schema**,不可自由添加字段。
