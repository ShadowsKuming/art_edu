# 艺芽 AI 系统 — Pilot 开发工程师 Claude Code 使用指南

> 本指南帮助工程师**使用 Claude Code 完成 pilot 前的系统开发**。

---

## 1. 这套 spec 文档的关系

你将收到 5 份文档 + 4 个 JSON 实例,关系如下:

```
本文档 (Engineer_Claude_Code_Guide.md) ──── 你正在读的入口
   │
   ├──► KNOWLEDGE_BANK.md ─────── 系统现状(commit 3162456 的 source of truth)
   │
   └──► ArtBloom_Pilot_Feature_Spec.md ──── pilot 开发任务总清单
           │
           ├──► ArtBloom_Lesson_Data_Schema.md ──── LKP TypeScript 接口 + 字段语义
           │       │
           │       └──► g2v2-u4-l4.json (含真实素材路径)
           │            g2v2-u4-l5.json
           │            g2v2-u5-l1.json
           │            g2v2-u5-l2.json
           │
           └──► ArtBloom_New_API_Spec.md ──── 新增/扩展 backend endpoint
```

---

## 2. 与 Claude Code 协作的推荐方式

### 2.1 第一次会话:让 Claude Code 理解系统现状

**Prompt 模板**:

```
我在做艺芽 AI 系统(ArtBloom)的 pilot 前开发。下面是系统现状文档。
请你先完整阅读,然后用 100 字总结现有架构的 3 个关键事实。
不要做任何代码改动,只读和理解。

<KNOWLEDGE_BANK.md 全文>
```

让 Claude Code 复述系统现状,验证它理解正确,**再开始改动**。

### 2.2 第二次会话:让 Claude Code 理解开发目标

**Prompt 模板**:

```
基于刚才你理解的系统现状,下面是 pilot 前需要完成的开发任务清单。
请你阅读后,用列表形式告诉我:哪些任务需要新建文件、哪些任务需要修改现有文件。
仍然不要写代码。

<ArtBloom_Pilot_Feature_Spec.md 全文>
```

### 2.3 第三次会话开始:开始执行任务

**Prompt 模板**(逐个任务):

```
请你执行 Feature_Spec 中的任务 P0-1(LessonContextManager 创建)。
具体细节我把对应的 Schema 文档给你:

<ArtBloom_Lesson_Data_Schema.md 全文>

开始实现,完成后告诉我:
- 创建了哪些新文件
- 修改了哪些现有文件(用 diff 风格描述)
- 需要我验证什么(测试步骤)
```

---

## 3. 任务执行顺序(强烈建议按此顺序)

| 顺序 | 任务 ID | 任务名 | 依赖 |
|---|---|---|---|
| 1 | P0-1 | 创建 LessonContextManager 类 + 4 个 lesson JSON | 无 |
| 2 | P0-2 | 扩展现有 endpoints 接收 lesson_id + 注入 LKP context | P0-1 |
| 3 | P0-3 | 新建 `/api/part7/comment` endpoint(Executor A for Part 7) | P0-1 |
| 4 | P0-4 | 前端 Community 页面改为读取真实 lesson 数据 | P0-1 |
| 5 | P0-5 | Community Save 按钮:deep copy lesson seed 到 my projects | P0-4 |
| 6 | P0-6 | 实现 Part 7 UI(学生作品上传 + commenter 反馈展示) | P0-3, P0-5 |
| 7 | P1-1 | localStorage 数据导出按钮 | P0-* |
| 8 | P1-2 | backend 请求日志中间件(可选) | 无 |

P0-1 ~ P0-6 是 **pilot 启动前必须完成**的任务。P1-* 提升 pilot 数据质量,可后续补做。

详细任务定义见 `ArtBloom_Pilot_Feature_Spec.md`。

---

## 4. 与 Claude Code 协作的最佳实践

### 4.1 每个任务完成后做 4 件事

1. **跑现有的 build**:`npm run build`(frontend)+ `python -c "import backend.main"`(backend),确认无 break
2. **手动验证一个 happy path**(在 spec 文档每个任务底部有"验证标准")
3. **让 Claude Code 自查**:"刚才的实现是否符合 spec? 是否引入了任何 spec 没要求的额外功能?" (防止 Claude Code 自由发挥)
4. **commit 一个原子提交**(`feat(P0-1): add LessonContextManager`),便于后续 review

### 4.2 让 Claude Code 拒绝"擅自发挥"

在 Prompt 中加一句:

> "如果 spec 中没有明确要求的字段、方法、或 endpoint,请不要添加。如果发现 spec 有模糊或矛盾的地方,请先问我,不要自己猜。"

### 4.3 避免 hallucination 的 3 条铁律

1. **不要假设"应该有"的功能**:如果 spec 没说,就**不要做**。例如 spec 没说 LessonContextManager 要支持缓存,Claude Code 就不要加缓存。
2. **不要假设字段名**:LKP JSON 的字段名以 `Lesson_Data_Schema.md` 为准。任何 `# TODO: should this be xxx?` 必须先问。
3. **不要假设错误处理**:除非 spec 明说,否则只做"happy path"。错误处理另起任务。

### 4.4 当 spec 与 KNOWLEDGE_BANK 矛盾时

- **spec 优先**(spec 是"新目标",KB 是"旧现状")
- 但发现矛盾时,**告诉用户**,让用户决定是改 KB 还是改 spec

---

## 5. pilot 启动时间线

| 时间 | 事件 |
|---|---|
| 当前 | 工程师收到本 spec 包,开始 P0-1 ~ P0-6 |
| W-1 周末 (5/31) | 所有 P0 任务完成,部署到 staging |
| W1 (6/1) | pilot 启动,老师开始使用 |
| pilot 期间 | P1-* 任务边做边补,**不阻塞 pilot** |

强烈建议:**P0 任务必须在 5/29 周三前完成首版**,留 2 天给老师在培训中试用,有问题可调整。

---

## 6. 你不需要做的事

为了避免 scope creep,以下事项 pilot 前**明确不做**:

- ❌ 重写 backend 为 microservices 架构(单文件 `main.py` 继续用)
- ❌ 引入 RAG / vector database(LKP JSON 直接 `import`)
- ❌ 真实用户认证 / 数据库(单租户 + localStorage 继续用)
- ❌ Part 7 之外的"AI 介入"扩展(老师在 Part 1/2/4/5 的 chatbot 已经能用)
- ❌ Community 页面的搜索 / 筛选 / 分页(4 张 pilot lesson 卡固定显示)
- ❌ Multi-language 完整覆盖(Part 5/6/7 当前 EN-only 接受)

这些是 pilot 之后的迭代任务,**不在本 spec 范围**。

---

## 7. 联系研究员

如果 spec 有矛盾、字段含义不明、或 Claude Code 卡住,通过 WeChat 联系研究员。

**研究员的 Office Hour**: 中国时间 20:00-22:00,W1 期间每日,W2/W3 按需。

---

> 本指南作者声明:本文档完全基于真实系统 `art_edu` commit `3162456` 的当前状态生成,**未引入任何不存在于真实系统的概念**。所有"新建/扩展"任务均在真实系统的代码结构(FastAPI 单文件 / Pinia / localStorage)下可直接执行。
