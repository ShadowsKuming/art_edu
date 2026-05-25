# 艺芽 AI 系统 — Pilot Feature Spec(开发任务总规格)

> 本文档列出 pilot 启动前(2026-06-01)必须完成的开发任务清单。**每个任务给 Claude Code 看一遍就能执行**。
>
> **使用方式**: 工程师把本文档 + KNOWLEDGE_BANK.md 一起喂给 Claude Code,逐任务执行 P0-1 → P0-6 → P1-*。

---

## 1. 任务依赖图

```
P0-1 (后端 LessonContextManager + 4 lesson JSON)
    │
    ├── P0-2 (扩展现有 6 个 endpoints,接收 lesson_id 参数)
    │      └── 前端各 store 调用时传 lesson_id
    │
    ├── P0-3 (新建 /api/part7/comment endpoint)
    │
    ├── P0-4 (前端 Community 改为读取真实 lesson 数据)
    │      └── P0-5 (Community Save 按钮 deep copy seed)
    │             └── P0-6 (Part 7 UI 实现)
    │
    └── P1-1 (localStorage 数据导出)  ← 与 P0 并行可做
        P1-2 (backend 请求日志中间件) ← 与 P0 并行可做
```

执行顺序建议:**P0-1 → P0-2 → P0-3 → P0-4 → P0-5 → P0-6 → P1-1 → P1-2**

---

## 2. P0-1: LessonContextManager 类 + 4 个 lesson JSON

### 2.1 目标

创建 backend 的 LKP 加载机制,作为概念上的 "Commander"。

### 2.2 任务清单(给 Claude Code)

```
请按以下步骤完成:

步骤 1: 创建 backend/lesson_types.py
  - 包含所有 Pydantic 接口(LessonSeedData, TextbookArtwork, etc.)
  - 完整定义见 ArtBloom_Lesson_Data_Schema.md §2.3

步骤 2: 创建 backend/lesson_context.py
  - LessonContextManager 类
  - 完整实现见 ArtBloom_New_API_Spec.md §2.2

步骤 3: 把 4 个 lesson JSON 放到 backend/data/lessons/
  - g2v2-u4-l4.json
  - g2v2-u4-l5.json
  - g2v2-u5-l1.json
  - g2v2-u5-l2.json

步骤 4: 在 backend/main.py 顶部加 import
  from .lesson_context import lesson_manager

步骤 5: 创建 backend/tests/test_lesson_context.py
  - 测试见 ArtBloom_New_API_Spec.md §8.1
```

### 2.3 涉及文件

| 文件 | 操作 |
|---|---|
| `backend/lesson_types.py` | 🆕 新建 |
| `backend/lesson_context.py` | 🆕 新建 |
| `backend/data/lessons/g2v2-u4-l4.json` | 🆕 新建(本 spec 包提供) |
| `backend/data/lessons/g2v2-u4-l5.json` | 🆕 新建 |
| `backend/data/lessons/g2v2-u5-l1.json` | 🆕 新建 |
| `backend/data/lessons/g2v2-u5-l2.json` | 🆕 新建 |
| `backend/main.py` | 🔧 加 1 行 import |
| `backend/tests/test_lesson_context.py` | 🆕 新建 |

### 2.4 验证标准

```bash
cd backend
python -c "from lesson_context import lesson_manager; print(lesson_manager.list_available())"
# 期望输出: ['g2v2-u4-l4', 'g2v2-u4-l5', 'g2v2-u5-l1', 'g2v2-u5-l2']

python -c "from lesson_context import lesson_manager; seed = lesson_manager.load('g2v2-u4-l4'); print(seed.lesson_title_zh)"
# 期望输出: 好长好长……

pytest tests/test_lesson_context.py -v
# 期望: 4 tests passed
```

---

## 3. P0-2: 扩展现有 6 个 endpoints

### 3.1 目标

让现有 endpoints 接收可选的 `lesson_id` / `part_id` / `artwork_id` 参数,通过 LessonContextManager 注入 LKP context。

### 3.2 任务清单(给 Claude Code)

```
请按以下步骤逐个扩展(不要重构,只加参数):

步骤 1: 扩展 /api/story/stream
  - 给 StoryGenerateRequest 加 lesson_id, artwork_id (Optional)
  - endpoint 内调用 lesson_manager.build_executor_b_context() 注入 prompt
  - 完整 diff 见 ArtBloom_New_API_Spec.md §3.1

步骤 2: 扩展 /api/story/continue/stream
  - 给 StoryContinueRequest 加 lesson_id (Optional)
  - 详见 §3.2

步骤 3: 扩展 /api/animation/submit
  - 给 AnimationSubmitRequest 加 lesson_id, artwork_id
  - endpoint 内调用 build_executor_c_context() 注入 mood
  - 详见 §3.3

步骤 4: 扩展 /api/part6/generate-styles
  - 给 Part6StylesRequest 加 lesson_id
  - 关键改动:如有 lesson_id,直接返回 LKP 预定义 3 个 style(不再调 LLM)
  - 如 branch=B,返回空 styles 数组,frontend 显示"本课无作品风格转换"
  - 详见 §3.4

步骤 5: 扩展 /api/part6/transfer
  - 给 Part6TransferRequest 加 lesson_id(仅用于日志)
  - 详见 §3.5

步骤 6: 扩展 /api/chat
  - 给 ChatRequest 加 lesson_id, part_id (Optional)
  - endpoint 内调用 build_executor_a_context() 注入 system prompt
  - 详见 §3.6

⚠️ 所有改动严格向后兼容:不传 lesson_id 时,endpoint 行为与之前完全一致。
```

### 3.3 涉及文件

| 文件 | 操作 |
|---|---|
| `backend/main.py` | 🔧 修改 6 个 endpoint + 6 个 Request 类 |
| 无新建文件 | — |

### 3.4 验证标准

```bash
# 启动 backend
uvicorn main:app --port 8001 --reload

# 测试 1: 不传 lesson_id(向后兼容)
curl -X POST http://localhost:8001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"history":[{"role":"user","content":"你好"}],"language":"zh"}'
# 期望: 200 OK,正常回复

# 测试 2: 传 lesson_id + part_id
curl -X POST http://localhost:8001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "history":[{"role":"user","content":"这节课我该怎么导入?"}],
    "language":"zh",
    "lesson_id":"g2v2-u4-l4",
    "part_id":2
  }'
# 期望: 200 OK,回复中提及《好长好长》或"夸张/长形纸"等本课概念

# 测试 3: 传不存在的 lesson_id
curl -X POST http://localhost:8001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"history":[],"language":"zh","lesson_id":"g99","part_id":1}'
# 期望: 200 OK(fallback 为无 lesson context,不报错)
```

---

## 4. P0-3: 新建 /api/part7/comment endpoint

### 4.1 目标

实现 Part 7 commenter — Executor A 在 Part 7 介入,给学生作品做 100-120 字反馈。

### 4.2 任务清单(给 Claude Code)

```
请按以下步骤实现:

步骤 1: 在 backend/main.py 加 Request/Response Pydantic 类
  - Part7CommentRequest
  - Part7CommentResponse
  - 完整定义见 ArtBloom_New_API_Spec.md §4.2

步骤 2: 实现 POST /api/part7/comment endpoint
  - 加载 LKP context (lesson_manager.build_part7_comment_context)
  - 构建 system prompt(注入 learning_objectives + key_art_concepts + dimensions)
  - 构建 user message(图片 base64 + 学生自评 optional)
  - 调用 Doubao Vision LLM(同 ARK_STORY_MODEL)
  - 返回 feedback_text + 实际字数 + dimensions_covered
  - 完整实现见 §4.3

步骤 3: 错误处理
  - lesson_id 不存在 → 404
  - LLM 超时 → 504
  - 字数超出 → 仍返回 200(frontend 决定如何展示)
  - 详见 §4.4
```

### 4.3 涉及文件

| 文件 | 操作 |
|---|---|
| `backend/main.py` | 🔧 新增 1 个 endpoint + 2 个 Pydantic 类(约 80 行代码) |

### 4.4 验证标准

```bash
# 准备测试图片(任何学生作品风格的图)
TEST_IMG=$(base64 -i ./test-fixtures/sample-student-work.jpg)

curl -X POST http://localhost:8001/api/part7/comment \
  -H "Content-Type: application/json" \
  -d "{
    \"student_work_base64\": \"$TEST_IMG\",
    \"student_work_mime\": \"image/jpeg\",
    \"lesson_id\": \"g2v2-u4-l4\",
    \"language\": \"zh\"
  }"

# 期望:
# - 200 OK
# - feedback_text 字段 100-120 字之间
# - dimensions_covered 数组非空
# - 反馈中提到《好长好长》课程的关键概念(如"夸张"、"长长的")
```

---

## 5. P0-4: 前端 Community 页面读取真实 lesson 数据

### 5.1 目标

把 Community 页面从"6 张静态占位卡"改为"展示 4 节 pilot lesson 的真实卡片"。

### 5.2 任务清单(给 Claude Code)

```
请按以下步骤实现:

步骤 1: 配置 sync-lessons 脚本(详见 ArtBloom_Lesson_Data_Schema.md §5)
  - 新建 frontend/scripts/sync-lessons.js
  - 在 frontend/package.json 加 "sync-lessons" + "prebuild" 钩子

步骤 2: 跑一次 npm run sync-lessons
  - 应当生成 frontend/src/data/lessons/{4 个 JSON}

步骤 3: 创建 src/types/lesson.ts
  - 复制 LessonSeedData 等 TypeScript 接口
  - 详见 ArtBloom_Lesson_Data_Schema.md §2.1-2.2

步骤 4: 改造 src/data/communityDummy.ts
  - 删除原 6 张占位卡
  - 改为从 src/data/lessons/*.json 读取 4 节 lesson
  - 暴露 communityLessons: CommunityLesson[]
  - 字段映射:
    - id: lesson.lesson_id
    - titleEn: lesson.lesson_title_en
    - titleZh: lesson.lesson_title_zh
    - unit: lesson.unit_id
    - lesson: lesson.lesson_id 末段 ('l4')
    - author: 'ArtBloom Team'
    - date: '2026-05-23' (LKP 生成日期)
    - thumbnail: lesson.textbook_artworks[0].image_url (用第一幅作品做封面)

步骤 5: 改造 src/views/Community.vue
  - 把 v-for 数据源从 communityDummy 改为 communityLessons
  - 移除筛选 / 分页 stub(暂不实现)

步骤 6: 修改 src/data/curriculum.ts
  - 给 g2v2-u4-l4 / u4-l5 / u5-l1 / u5-l2 4 个 lesson 加 hasSeedLKP: true 字段
  - 详见 ArtBloom_Lesson_Data_Schema.md §6

⚠️ Community 页的其他元素(标题、Discover 按钮、卡片视觉设计)保持不变。
```

### 5.3 涉及文件

| 文件 | 操作 |
|---|---|
| `frontend/scripts/sync-lessons.js` | 🆕 新建 |
| `frontend/package.json` | 🔧 加 2 个 scripts |
| `frontend/src/data/lessons/*.json` | 🆕 自动同步生成 |
| `frontend/src/types/lesson.ts` | 🆕 新建 |
| `frontend/src/data/communityDummy.ts` | 🔧 重写 |
| `frontend/src/views/Community.vue` | 🔧 改 v-for 数据源 |
| `frontend/src/data/curriculum.ts` | 🔧 加 `hasSeedLKP` 字段 |

### 5.4 验证标准

```bash
cd frontend
npm run sync-lessons
ls src/data/lessons/  # 应当有 4 个 JSON

npm run build
# 期望: 0 TS errors

npm run dev
# 浏览器访问 http://localhost:5173/community
# 期望: 显示 4 张 lesson 卡片(U4-L4 / U4-L5 / U5-L1 / U5-L2),封面是各课第一个 textbook artwork
```

---

## 6. P0-5: Community Save 按钮 — deep copy seed

### 6.1 目标

老师点 Community 卡片的 "Save" 按钮 → 把 lesson seed 完整 deep copy 到老师的 projects(my lessons)。

### 6.2 任务清单(给 Claude Code)

```
请按以下步骤实现:

步骤 1: 在 src/utils/ 创建 lessonSeed.ts
  - 实现 hydrateProjectFromLesson(lesson: LessonSeedData): { project, snapshot }
  - 把 lesson.slide_framework 转换为 SlideSnapshot
  - 每个 framework entry 变成一个 Slide:
    - id: `slide-${Date.now()}-${page}`
    - partId: entry.part_id
    - elements: entry.default_elements (如果有) 或 []
    - background: entry.default_background
  - project.meta 写入 lesson 的元信息

步骤 2: 修改 src/components/community/LessonCard.vue
  - "Save" 按钮 emit('save', lessonId) 已存在
  - 不改 LessonCard 本身,只改 Community.vue 的 handler

步骤 3: 修改 src/views/Community.vue
  - 添加 onSave(lessonId) handler:
    1. import lesson JSON
    2. 调用 hydrateProjectFromLesson(lessonData)
    3. 调用 projectsStore.createProject(name, meta) 创建项目
    4. 立即 projectsStore.saveCurrentProject(snapshot) 保存内容
    5. 弹出 toast "已保存到我的课程"
    6. 不自动跳转(老师在 Community 继续浏览,或自己点 My Lessons)

步骤 4: (可选)在 LessonCard 加"Saved" 视觉状态
  - 如果 projectsStore.projects 中已有该 lesson_id 的项目,Save 按钮改为 "✓ Saved"

⚠️ deep copy 不包含 video / audio 资源(URL 引用即可),避免 localStorage 体积爆炸
   即 part5.videoDataUrl 不预填,老师如果需要可以重新上传
```

### 6.3 涉及文件

| 文件 | 操作 |
|---|---|
| `frontend/src/utils/lessonSeed.ts` | 🆕 新建 |
| `frontend/src/views/Community.vue` | 🔧 加 onSave handler |
| `frontend/src/components/community/LessonCard.vue` | 🔧 (可选)Saved 状态 |
| `frontend/src/stores/projects.ts` | (无改动,已支持 createProject + saveCurrentProject) |

### 6.4 验证标准

```bash
# 浏览器测试
1. 访问 /community
2. 点 U4-L4《好长好长》的 Save 按钮
3. 期望:出现 toast "已保存到我的课程"
4. 访问 /lessons (My Lessons)
5. 期望:看到 1 个项目 "U4-L4 So Long, So Long..."
6. 点该项目进入 workspace
7. 期望:7 个 part 都已经有 seed 内容(slide_framework 转换出的 slides)
```

---

## 7. P0-6: Part 7 UI 实现(学生作品上传 + commenter 反馈展示)

### 7.1 目标

把 Part7Placeholder 改造成真实的 Part 7 界面:
- 学生作品上传区(支持多张)
- 调用 `/api/part7/comment` 获取反馈
- 反馈展示卡片

### 7.2 任务清单(给 Claude Code)

```
请按以下步骤实现:

步骤 1: 新建 src/stores/part7.ts
  - 类似 part3.ts 的结构,按 slide.id keyed:
    interface Part7Pair {
      id: string;
      studentWorks: StudentWork[];  // 多张学生作品
      activeWorkIdx: number;
      generatingComment: boolean;
      commentError: string | null;
    }
    interface StudentWork {
      id: string;
      imageDataUrl: string;
      imageBase64: string;
      imageMime: string;
      studentNote: string;          // 学生自评(可选)
      feedbackText: string;          // commenter 返回
      feedbackWordCount: number;
      feedbackDimensions: string[];
      feedbackTimestamp: string;
      generatingFeedback: boolean;
      feedbackError: string | null;
    }
  - actions: addStudentWork, removeStudentWork, generateComment(workIdx)

步骤 2: 新建 src/components/workspace/part7/Part7Content.vue
  - 中央区域,展示当前选中 slide 的 Part7Pair
  - 左侧:学生作品上传 / 已上传作品列表(thumbnail)
  - 右侧:反馈展示区(选中作品的 commenter 反馈)
  - 上传区:支持点击 / 拖拽

步骤 3: 新建 src/components/workspace/part7/Part7CommentCard.vue
  - 展示一条 commenter 反馈:
    - 顶部:学生作品 thumbnail
    - 中间:反馈文字
    - 底部:字数 + dimensions_covered + 重新生成按钮

步骤 4: 修改 src/views/CreateLesson.vue
  - Part 7 时,把 <Part7Placeholder /> 换成 <Part7Content />

步骤 5: 删除或保留 Part7Placeholder.vue(可保留作为 fallback)

⚠️ Part 7 不需要 ChatPanel(无右侧助手面板,因为反馈本身就是 Executor A 的输出)
   sidebar 的 slide 缩略图行为与 Parts 1-6 一致(可以加多张 slide,每张 slide 一组学生作品)
```

### 7.3 涉及文件

| 文件 | 操作 |
|---|---|
| `frontend/src/stores/part7.ts` | 🆕 新建 |
| `frontend/src/components/workspace/part7/Part7Content.vue` | 🆕 新建 |
| `frontend/src/components/workspace/part7/Part7CommentCard.vue` | 🆕 新建 |
| `frontend/src/views/CreateLesson.vue` | 🔧 Part 7 时换组件 |
| `frontend/src/components/workspace/part7/Part7Placeholder.vue` | (保留作为 fallback) |

### 7.4 验证标准

```bash
# 浏览器测试
1. 访问 /workspace 一个已有 lesson 项目(已 save U4-L4)
2. sidebar 点 Part 7
3. 期望:中央区域显示"上传学生作品"区
4. 上传一张测试图(可以是任意儿童画)
5. 点"生成反馈"按钮
6. 期望:右侧展示 100-120 字反馈文字 + dimensions 标签
7. 反馈中应当提到《好长好长》课程的关键概念
```

---

## 8. P1-1: localStorage 数据导出按钮

### 8.1 目标

让老师能把自己的 localStorage 数据导出为 JSON 文件,发回研究员。

### 8.2 任务清单(给 Claude Code)

```
请按以下步骤实现:

步骤 1: 新建 src/utils/exportLocalData.ts
  - 函数 exportAllLocalData(): Blob
  - 收集所有 artbloom-* localStorage keys
  - 排除 part5VideoDataUrl(避免 100MB+ 体积)
  - 返回格式化 JSON Blob

步骤 2: 在 src/views/MyAccount.vue 加导出按钮
  - 位置:profile 卡片下方
  - 文字:"导出我的数据 (给研究员)" / "Export My Data (for researcher)"
  - 点击:触发下载 artbloom-export_{username}_{date}.json

步骤 3: 文件命名约定
  - 文件名:artbloom-export_{username}_{ISO 日期}.json
  - 例:artbloom-export_AB-7729-ST_2026-06-15.json
```

### 8.3 涉及文件

| 文件 | 操作 |
|---|---|
| `frontend/src/utils/exportLocalData.ts` | 🆕 新建 |
| `frontend/src/views/MyAccount.vue` | 🔧 加导出按钮 |
| `frontend/src/i18n/en.ts` | 🔧 加 "exportData" 文案 |
| `frontend/src/i18n/zh.ts` | 🔧 加 "exportData" 文案 |

### 8.4 验证标准

```bash
# 浏览器测试
1. 访问 /account
2. 点"导出我的数据"按钮
3. 期望:浏览器下载 artbloom-export_{您的用户名}_{日期}.json
4. 用 VS Code 打开 JSON,验证包含 projects / preferences / locale 字段
5. 验证 part5VideoDataUrl 字段被排除(单个 project 应该 < 1MB)
```

---

## 9. P1-2: backend 请求日志中间件

### 9.1 目标

给 backend 加一个简单的请求日志,记录每个 API 调用的元数据(不存请求 body),便于 pilot 数据分析。

### 9.2 任务清单(给 Claude Code)

```
请按以下步骤实现:

步骤 1: 在 backend/main.py 加 logging middleware
  - 每个 /api/* 请求记录:request_id, timestamp, method, path, duration_ms,
    status_code, body_size_bytes, teacher_hint (来自 X-Pilot-Teacher header)
  - 不存请求 body 内容(隐私 + 体积)
  - 写入 backend/pilot_logs/{YYYY-MM-DD}.jsonl

步骤 2: 在 frontend 所有 API 调用处加 X-Pilot-Teacher header
  - 从 localStorage 取 artbloom-username
  - 在 fetch wrapper 或 axios interceptor 中统一加

步骤 3: 在 .gitignore 加 backend/pilot_logs/

步骤 4: 扩展 /health endpoint
  - 加 pilot_log_count_today 字段
```

### 9.3 涉及文件

| 文件 | 操作 |
|---|---|
| `backend/main.py` | 🔧 加 middleware + 扩展 /health |
| `frontend/src/utils/api.ts` (或现有 fetch wrapper) | 🔧 加 header |
| `backend/.gitignore` | 🔧 加 pilot_logs/ |

### 9.4 验证标准

```bash
# 跑几个 API 调用,然后:
cat backend/pilot_logs/$(date +%Y-%m-%d).jsonl
# 期望:每行一个 JSON,含 request_id / path / duration_ms 等

curl http://localhost:8001/health
# 期望:返回 pilot_log_count_today >= 1
```

---

## 10. 关键防 hallucination 提示(每次新会话提醒 Claude Code)

```
在你开始改代码前,请确认以下事实:

1. 真实系统是 FastAPI 单文件 backend/main.py(约 533 行),不要重构。
2. 真实系统没有数据库,所有持久化在前端 localStorage。
3. "Commander" 和 "Executor A/B/C/D" 是概念命名,代码层面:
   - Commander = LessonContextManager 类(本 spec 新建)
   - Executor A = 现有 /api/chat (Part 1/2/4/5) + 新建 /api/part7/comment (Part 7)
   - Executor B = 现有 /api/story/* endpoints
   - Executor C = 现有 /api/animation/* endpoints
   - Executor D = 现有 /api/part6/* endpoints
4. 不引入 RAG / vector database / 用户认证 / 真实数据库 — 这些不在 pilot 范围
5. 所有 lesson_id 字段都是 Optional,向后兼容(不传时 endpoint 行为不变)
6. 4 个 lesson JSON 的字段格式严格按 ArtBloom_Lesson_Data_Schema.md
```

---

## 11. 完成度跟踪表

| 任务 | 完成 | 验证 | 注释 |
|---|---|---|---|
| P0-1 LessonContextManager + 4 JSON | ☐ | ☐ | |
| P0-2 扩展 6 个 endpoints | ☐ | ☐ | |
| P0-3 新建 /api/part7/comment | ☐ | ☐ | |
| P0-4 Community 真实数据 | ☐ | ☐ | |
| P0-5 Community Save deep copy | ☐ | ☐ | |
| P0-6 Part 7 UI | ☐ | ☐ | |
| P1-1 数据导出按钮 | ☐ | ☐ | |
| P1-2 请求日志中间件 | ☐ | ☐ | |

工程师在每个任务完成后,把☐ 改为☑,并 commit 一个原子提交(`feat(P0-1): add LessonContextManager`)。

---

## 12. 后续(pilot 之后)的非 P0/P1 任务

以下事项**不在 pilot 范围**,记录在此供未来参考:

- 真实用户认证(替代 invite code stub)
- 真实 backend 数据库(替代 localStorage)
- "Start Teaching" 演示模式(目前永久禁用)
- 多老师协作 / Community 真实社区(用户上传 lesson)
- Part 5 / Part 6 / Part 7 完整 i18n
- 老师之间分享 lesson(fork from peer)
- 数据可视化 dashboard(老师查看自己使用统计)

---

> 本 Feature Spec 作者声明:本文档基于真实系统 `art_edu` commit `3162456` 设计,所有任务严格在现有架构(FastAPI 单文件 + Vue + Pinia + localStorage)下可执行。Claude Code 严格按本 spec 实现,**不擅自添加未列出的功能**。
