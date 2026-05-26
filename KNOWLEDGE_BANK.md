# ArtBloom — Project Knowledge Bank

> Generated knowledge dump for the **ArtBloom** (`art_edu`) repository.
> Repo: https://github.com/ShadowsKuming/art_edu
> Local path: `/Users/kevinlee/Downloads/art_edu`
> Latest commit at time of writing: `3162456` (Update .env.example)
> Last in-session update: 2026-05-25 (Pilot LKP integration —
> backend Commander + Part 7 commenter + frontend LKP wiring).

---

## 0. Pilot LKP integration status (2026-05-25)

Implementation pass for the **Pilot Lesson Knowledge Package (LKP)**
flow described in `backed-files/ArtBloom_Pilot_Feature_Spec.md` and
`backed-files/ArtBloom_New_API_Spec.md`. Status of each subtask:

### Phase A — Backend infrastructure ✅
- `backend/lesson_types.py` — Pydantic mirror of LKP schema.
- `backend/lesson_context.py` — `LessonContextManager` with
  `load()`, `list_available()`, and per-executor context builders
  (`build_executor_a/b/c/d_context`, `build_part7_comment_context`).
- `backend/data/lessons/g2v2-u4-l4.json` — first LKP file
  ("So Long, So Long..." / 好长好长……).
- `backend/main.py` — mounts `/textbook-assets` static files,
  imports + instantiates `LessonContextManager`, exposes
  `available_lessons` on `/health`.

### Phase B — Existing 6 endpoints extended with `lesson_id` ✅
`/api/story/stream`, `/api/story/continue/stream`, `/api/animation/submit`,
`/api/chat`, `/api/part6/generate-styles`, `/api/part6/transfer` all
accept an optional `lesson_id` (and `artwork_id` / `part_id` where
relevant) and short-circuit to the LKP context when present.

### Phase C — New `POST /api/part7/comment` ✅
Returns `{ feedback_text, word_count, dimensions_covered, timestamp }`
for a student-work image, anchored on the lesson's assessment rubric.

### Phase D — Frontend wiring ✅
- `frontend/src/types/lesson.ts` — TS mirror of LKP schema.
- `frontend/scripts/sync-lessons.js` + `package.json` `prebuild`
  script — copies `backend/data/lessons/*.json` into
  `frontend/src/data/lessons/*.json`.
- `frontend/src/data/lessons/index.ts` — `LESSONS` registry +
  `getLesson(id)` + `LESSON_REGISTRY` array.
- `frontend/src/utils/lessonSeed.ts` —
  `hydrateProjectFromLesson(seed, locale)` builds slides + `ProjectMeta`
  from an LKP.
- `frontend/src/stores/projects.ts` — exposes `activeLessonId`
  computed (reads `activeProject.meta.lessonId`).
- `frontend/src/stores/part3.ts` — `setArtworkFromUrl(url, artworkId)`,
  `selectedArtworkId`; all generate calls thread `lesson_id` + `artwork_id`.
- `frontend/src/stores/part6.ts` — both endpoints thread `lesson_id`.
- `frontend/src/stores/part7.ts` — NEW per-slide pair store calling
  `/api/part7/comment`, with student-note and multiple work uploads.
- `frontend/src/components/workspace/WorkspaceChatbot.vue` — threads
  `lesson_id` + `part_id` into `/api/chat`.
- `frontend/src/components/workspace/part3/Part3Content.vue` —
  curated-artwork picker tiles above the upload affordance (only
  rendered when an LKP is loaded).
- `frontend/src/components/workspace/part7/Part7Content.vue` — NEW
  UI: left column with upload + student-work thumbnails, right
  column with image preview, student-note textarea, generate button,
  feedback card with word count + covered dimensions. Empty state
  for non-LKP projects.
- `frontend/src/views/CreateLesson.vue` — Part 7 now renders
  `Part7Content` instead of the placeholder.
- `frontend/src/views/Community.vue` — `LESSON_REGISTRY` rows
  prepended to the card grid; **Save** action calls
  `hydrateProjectFromLesson` → `projectsStore.createProject` →
  `slideStore.loadSnapshot` → navigates to the editor.
- `frontend/src/i18n/{en,zh}.ts` — `part3.pickArtworkLabel`,
  `part3.uploadOrPick`, full `part7.*` keys.

### Phase E — Smoke tests ✅
- `python -c "import main"` from `backend/` succeeds.
- `/health` returns `available_lessons: ['g2v2-u4-l4']`.
- `npx vue-tsc --noEmit` is clean.
- `npx vite build` builds in ~650ms with zero errors.

### Carried over for the next session
- Author additional LKPs (G2V2-U4-L5, U5-L1, U5-L2 — JSONs already
  exist in `backed-files/` but need to be copied + synced).
- Read-only Community **Preview** page is still a stub.
- Backend has TODO comments where Branch B (executor D) needs a
  separate LLM call to derive 3 styles from the canonical
  `executor_d_styles.styles[0]` template — currently returns the
  seed list verbatim for both branches.
- Reset-to-seed action on the lesson editor (re-hydrate without
  losing chat history) — not yet implemented.

---

> Last in-session update: 2026-09-05 (Dashboard "Create Lesson" → 3-stage
> textbook/unit/lesson selection modal wired to a curriculum data module).


---

## 1. High-level overview

ArtBloom is an AI-powered art-education web app that helps teachers build interactive
slide decks for art lessons. A lesson is structured as **7 fixed Parts**, and AI
assists the teacher with:

- Generating an interactive **story** from an artwork image (with branching choices)
- Producing an **image-to-video animation** of the artwork (max 3 attempts)
- **Text-to-speech narration** of the generated story (Chinese Edge Neural voices)
- **Style transfer** on student sketches with 3 lesson-aligned styles
- A general **slide-design chatbot** in the right pane

Everything is single-tenant and stored in `localStorage`; there is no backend DB.

---

## 2. Tech stack

| Layer | Tech |
|-------|------|
| Frontend | Vue 3.5 (Composition API, `<script setup>`), TypeScript, Vite 8, Pinia 3, vue-router 4, vue-i18n 9, Tailwind CSS v4 (`@tailwindcss/vite`) |
| Backend | Python FastAPI 0.115, uvicorn, httpx, pydantic 2, python-dotenv, `edge-tts` |
| AI provider | Volcengine **Ark API** (`https://ark.cn-beijing.volces.com/api/v3`), Doubao models |
| TTS | Microsoft **Edge Neural TTS** via `edge-tts` (no key required, Chinese voices) |
| Tooling | Conda (env name `artbloom`) for backend, npm for frontend |

### Models (configured in `backend/.env`)

| Variable | Default | Use |
|----------|---------|-----|
| `ARK_STORY_MODEL` | `doubao-seed-2-0-lite-260215` | Vision LLM — story + style-prompt generation |
| `ARK_CHAT_MODEL`  | `doubao-seed-2-0-lite-260215` | Slide-design chatbot |
| `ARK_VIDEO_MODEL` | `doubao-seedance-2-0-260128`  | Image-to-video |
| `ARK_IMAGE_MODEL` | `doubao-seedream-5-0-260128`  | Image style transfer |

Default ports: backend `8001`, frontend `5173` (CORS allows 5173 + 5174).
Frontend reads `VITE_API_BASE` (defaults to `http://localhost:8001`).

---

## 3. Repository structure

```
art_edu/
├── README.md                # full setup guide (very thorough)
├── backend/
│   ├── main.py              # ALL FastAPI routes in one file (~533 lines)
│   ├── environment.yml      # conda env spec
│   ├── requirements.txt     # pip deps
│   └── .env                 # ARK_API_KEY (gitignored)
└── frontend/
    ├── index.html, vite.config.ts, tsconfig.*
    ├── public/              # LOGO.png, pig.svg, pig-broken.svg, hero/icons
    └── src/
        ├── main.ts          # Vue + Pinia + router + i18n + base/tokens/fonts CSS
        ├── App.vue          # <RouterView/>
        ├── style.css
        ├── router/index.ts  # Home / Dashboard / Workspace + workspace guard
        ├── i18n/{index.ts, en.ts, zh.ts}
        ├── stores/          # Pinia stores (see §6)
        ├── assets/
        │   ├── images/      # Figma exports: logo, hero-main, hero-photo-{1,2,3},
        │   │                #   tutorial-banner, tutorial-step-{1..5}, contact-banner,
        │   │                #   logo-mark, Underline.svg
        │   └── styles/
        │       ├── tokens.css   # CSS variables (colors, gradients, type, spacing)
        │       ├── base.css     # Reset + body typography + scroll-margin anchors
        │       ├── fonts.css    # @font-face for IF Kica + Waiting for the Sunrise
        │       └── fonts/       # 4 .ttf files (3 IF Kica weights + script)
        ├── views/           # HomePage, MyLessons, CreateLesson, AboutView
        └── components/
            ├── home/        # ── new homepage (Figma redesign, see §13) ──
            │   ├── SiteHeader.vue            # sticky logo + anchor nav + lang + Access
            │   ├── AccessModal.vue           # native <dialog> invitation-code modal
            │   ├── HeroSection.vue           # wordmark over painted shapes + paragraph
            │   ├── HeroPhotoCollage.vue      # 3 rotated photo cards (no captions)
            │   ├── SectionHeading.vue        # title + Underline.svg + subtitle
            │   ├── TutorialSection.vue       # 5-step explainer
            │   ├── TutorialCard.vue          # gradient card w/ overlapping number chip
            │   ├── ContactSection.vue        # 2-column: help + form
            │   ├── HowWeCanHelpCard.vue      # 3 icon rows w/ coloured bubbles
            │   ├── ContactInfoCard.vue       # email + WeChat (vertical, coloured bubbles)
            │   └── ContactForm.vue           # name/email/subject/message form
            └── workspace/
                ├── WorkspaceHeader.vue
                ├── WorkspaceSidebar.vue
                ├── WorkspaceContent.vue       # default Tt/image/video/audio editor
                ├── WorkspaceChatbot.vue
                ├── ColorPicker.vue
                ├── SlideThumbnail.vue
                ├── canvas/{SlideCanvas.vue, SlideElement.vue}
                ├── part3/{Part3Content.vue, Part3StoryPanel.vue, Part3AnimationPanel.vue}
                ├── part5/Part5Content.vue
                ├── part6/{Part6Content.vue, Part6AssistancePanel.vue}
                └── part7/Part7Placeholder.vue
```

Stray files at repo root: `broken pig.svg`, `pig 1.svg` (the canonical assets live
in `frontend/public/`).

---

## 4. Application orchestration / user flow

```
HomePage (/)
   └── Get Started ──► MyLessons (/dashboard)
                           ├── Stat cards + filter tabs
                           ├── Lesson table (resume / preview / start teaching / delete)
                           └── Create Lesson modal
                                 └── createProject() + reset stores ──► CreateLesson (/workspace)
```

`router.beforeEach` redirects `/workspace` → `/dashboard` if no `activeProjectId`.

### CreateLesson (workspace) layout

```
┌──────────────────────────────────────────────────────────────┐
│  WorkspaceHeader (logo, lang, Back, Preview, Start Teaching) │
├────────────┬─────────────────────────────┬────────────-──────┤
│  Sidebar   │     Center content          │   Chat panel      │
│  (260 px)  │  (varies per active part)   │   (resizable)     │
│            │                             │                   │
│  7 parts   │  • Parts 1,2,4 → editor     │ • Default chatbot │
│  + slide   │  • Part 3 → image+modes     │ • Part 3 → Story  │
│  thumbs    │  • Part 5 → video upload    │     or Animation  │
│  + add btn │  • Part 6 → sketch+styles   │     panel         │
│            │  • Part 7 → placeholder     │ • Part 6 → assist │
└────────────┴─────────────────────────────┴───────────────────┘
```

- Sidebar Parts have status `active | completed | inactive`. Inactive parts cannot
  be opened. `maxUnlockedPart` increases via "Save & Next".
- Sidebar shows slide thumbnails + a `+` add button only for slide-editor parts (1,2,3,4).
- Center/right divider is drag-resizable; default chat width = 2/5 of available width.
- "Back" button serializes the current snapshot via `projectsStore.saveCurrentProject(...)`
  before routing to `/dashboard`.

### The 7 Parts

| # | Title | Center component | AI |
|---|-------|------------------|----|
| 1 | Cover & Opening | `WorkspaceContent` (slide editor) | — |
| 2 | Hook & Guided Attention | `WorkspaceContent` | — |
| 3 | Interactive Story | `Part3Content` + `Part3StoryPanel`/`Part3AnimationPanel` | Doubao vision LLM (story) + Seedance (video) + Edge TTS |
| 4 | Making Task | `WorkspaceContent` | — |
| 5 | Making Example | `Part5Content` (predefined slide + video upload) | — |
| 6 | Work Transformation | `Part6Content` + `Part6AssistancePanel` | Doubao vision LLM (style prompts) + Seedream (image) |
| 7 | Share & Feedback | `Part7Placeholder` ("coming soon") | — |

Part 1 has a special rule: changing its background sets a **global theme**
(`globalBackground` / `globalBgColor`) that automatically propagates to every
slide whose `isLocalBackground` is false. Other parts' background changes set
`isLocalBackground = true` and don't propagate.

---

## 5. Backend API (`backend/main.py`)

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/health` | `{ok, api_key_set, tts_voices, story_model, video_model}` |
| POST   | `/api/story/generate` | One-shot artwork → JSON story |
| POST   | `/api/story/stream`   | Same, SSE streaming |
| POST   | `/api/story/continue` | Continuation given Part 1 + chosen branch |
| POST   | `/api/story/continue/stream` | Same, SSE streaming |
| POST   | `/api/animation/submit` | Submits image-to-video task → `{task_id, status}` |
| GET    | `/api/animation/status/{task_id}` | Polls task → `{status, video_url, error}` |
| POST   | `/api/chat` | Slide-design chatbot (history + `language`) |
| POST   | `/api/part6/generate-styles` | Vision LLM → 3 `{label, prompt}` styles + `lesson_summary` |
| POST   | `/api/part6/transfer` | Image style transfer (2048×2048 URL) |
| GET    | `/api/tts/voices` | List 6 zh-CN/zh-TW Edge neural voices |
| POST   | `/api/tts` | Generates audio/mpeg via `edge_tts.Communicate` |

### Key prompts (in `main.py`)

- **STORY_SYSTEM/USER** — strict JSON output:
  `{part1, choices:[3 × {id,label,desc}], part3, designRationale, soundDesign}`.
  Markdown code-fences are stripped on parse.
- **STORY_CONTINUE_SYSTEM/USER** — plain-text 2-3 paragraph continuation, no JSON.
- **CHAT_SYSTEM** — friendly slide-design assistant, max 2-4 short paragraphs.
- **STYLE_GEN_SYSTEM/USER** — exactly 3 options + lesson summary, JSON only.
- `_lang_suffix(language)` injects "请用简体中文…" or "Write all content in English."

### Edge-TTS voices

| Voice ID | Display | Tag |
|----------|---------|-----|
| `zh-CN-XiaoxiaoNeural` | 晓晓 | 温暖 (Warm) |
| `zh-CN-XiaoyiNeural`   | 晓伊 | 活泼 (Bright) |
| `zh-CN-YunjianNeural`  | 云健 | 深沉 (Deep) |
| `zh-CN-YunxiNeural`    | 云希 | 清爽 (Crisp) |
| `zh-TW-HsiaoYuNeural`  | 曉雨 | 温柔 (Gentle) |
| `zh-TW-YunJheNeural`   | 雲哲 | 自然 (Natural) |

> Note: `TTSRequest.voice_id` defaults to `"zh_female_shuangkuaisisi_moon_bigtts"`
> (Volcengine-style) but the frontend always sends an Edge ID, so the default is
> effectively dead code.

---

## 6. Pinia stores (`frontend/src/stores/`)

### `navigation.ts`
Two boolean flags — `canAccessDashboard`, `canAccessWorkspace` — currently unused
by router guards (kept for future gating).

### `projects.ts`
Persisted to `localStorage` keys `artbloom-projects-list` and `artbloom-projects-active`.

```ts
interface Project {
  id: string                  // proj-${Date.now()}
  name: string
  createdAt: string           // ISO
  status?: 'draft' | 'completed' | 'taught' | 'saved'
  snapshot: SlideSnapshot     // slides + activePart + maxUnlockedPart + globals
  part5VideoDataUrl?: string  // entire video embedded as data URL
  part5VideoName?: string
}
```
API: `createProject`, `saveCurrentProject(snapshot, video?, name?)`,
`deleteProject`, `setActiveProject`.

### `slides.ts`  *(core editor state)*

`CANVAS_W = 960`, `CANVAS_H = 540`.

```ts
interface SlideElement {
  id, type:'text'|'image', x,y,width,height,
  content, fontSize, fontWeight, fontFamily, textAlign, color,
  src?, flipH?, flipV?, rotation?, cropT?, cropR?, cropB?, cropL?
}
interface Slide {
  id, partId, elements[], background?, bgColor?, isLocalBackground?
}
```

State: `slides`, `activeSlideId`, `selectedElementId`, `activePart`,
`maxUnlockedPart`, `globalBackground`, `globalBgColor`.

Notable behaviour:
- `addSlide(partId)` inherits the current globals.
- `setSlideBackground(id, bg)` / `setSlideBgColor(id, color)`:
  if `slide.partId === 1` → updates the global theme + propagates to all slides
  with `isLocalBackground === false`; otherwise marks the slide as local.
- `navigateToNextPart()` caps at 7 and pushes `maxUnlockedPart`.
- `getSnapshot` / `loadSnapshot` for project save/resume.
- `removeSlide` keeps at least one slide per part.

### `part3.ts`

Per-slide state, keyed by `slide.id`:

```ts
interface Part3Pair {
  id, imageDataUrl, imageBase64, imageMime,
  storyData: { part1, choices[3], part3, designRationale, soundDesign } | null,
  storyLoading, storyError, storyStreamText,        // SSE buffer
  animationVersions: { taskId, videoUrl, status }[],
  animationLoading, animationError, remainingAttempts (3),
  chosenVideoUrl, selectedChoiceId,
  generatedContinuations: Record<choiceId, string>,
  continuationLoading, continuationError, continuationStreamText
}
```

- `ensurePair(id)` is called whenever the active slide changes (Part 3 watcher in
  `Part3Content.vue`).
- `_readSSE` parses lines starting with `data:`, ignores `[DONE]`, accumulates
  `choices[0].delta.content`.
- `generateAnimation()` decrements `remainingAttempts`, pushes a pending entry,
  then `_pollAnimation` polls every 3 s up to 80 attempts.
- `generateContinuation(choiceId)` caches per-choice continuations; `choice 0` is
  pre-populated from the original story's `part3`.

### `part5.ts`
Tiny: `videoDataUrl`, `videoName`, `setVideo`, `clearVideo`.

### `part6.ts`

```ts
sketchDataUrl/base64/mime
styles[]            // [{label, prompt}, …]
lessonSummary
selectedStyleIdx
generatingStyles, stylesError
view: 'steps' | 'converting' | 'result'
usedStyleIndices[]  // tracks pigs already used → renders pig-broken.svg
latestResult        // {originalUrl, prompt, resultUrl}
conversionError
```
Calls `/api/part6/generate-styles`, then `/api/part6/transfer` on `convert()`.
`convertAgain()` adds the current style to `usedStyleIndices` and resets back to
`steps` view.

---

## 7. i18n

- `vue-i18n` with `legacy: false`, `fallbackLocale: 'en'`.
- Persisted to `localStorage` key `artbloom-locale`. `toggleLocale()` swaps EN ↔ ZH.
- Heavy coverage: `home`, `nav`, `dashboard`, `sidebar`, `content`, `part3`,
  `chatbot`, `part6`. The 7 part labels live in `sidebar.parts[]`.
- **Not internationalised yet**: `Part5Content.vue` (English literals),
  `Part6AssistancePanel.vue` (English literals), `Part7Placeholder.vue`.

---

## 8. Visual / design language

- Primary brand green: `#7FEC8F` (filled buttons, active states, accents)
- Soft green `#B2F4BC` (assistant chat bubble, highlight rings)
- Neutral palette: `#F3F4F4` page bg, `#e5e7eb` / `#e6e6e6` borders, `#111827` text
- Workspace canvas uses a dotted radial-gradient background with inset shadow
- Pill buttons (`border-radius: 999px`), 16 px rounded cards
- Whimsical pig SVGs (`pig.svg` / `pig-broken.svg`) for Part 6 style cards
  ("used" styles use the broken-pig variant)

---

## 9. Persistence model

- **Everything is local.** No auth, no backend DB, no cloud sync.
- Snapshots are written to `localStorage` only on:
  - "Back" button in the workspace header.
  - Implicit watchers on `projects.value` / `activeProjectId`.
- Images and videos are embedded as data URLs inside snapshots → very large
  payloads. There is currently no quota guard.

---

## 10. Current progress (status)

### Git history (5 commits, branch `main`)
```
3162456  Update .env.example         ← HEAD / origin
9c4c3b3  i
c4c9201  update
1c9ab44  Update WorkspaceSidebar.vue
882ad18  Initial commit — ArtBloom art education platform
```

### Working tree (uncommitted at time of writing)

Substantial uncommitted work: a full Figma-driven homepage redesign and a few
TypeScript cleanups. Highlights:

```
deleted:     backend/.env.example          (README still references it)
modified:    frontend/package-lock.json
modified:    frontend/src/main.ts          (imports tokens.css/base.css/fonts.css)
modified:    frontend/src/i18n/en.ts       (home.nav/hero/tutorial/contact namespaces)
modified:    frontend/src/i18n/zh.ts       (matching ZH translations)
modified:    frontend/src/stores/projects.ts            (SlideSnapshot tightened —
                                                         globalBackground/globalBgColor
                                                         now required keys, value
                                                         can be undefined; createProject
                                                         initial snapshot updated)
modified:    frontend/src/components/workspace/part6/Part6AssistancePanel.vue
                                                       (new selectedStyle computed
                                                        replaces 3 null-index errors)
new dir:     frontend/src/components/home/             (10 Vue components, see §13)
new dir:     frontend/src/assets/images/               (13 Figma PNGs + Underline.svg)
new dir:     frontend/src/assets/styles/               (tokens/base/fonts CSS + 4 TTFs)
replaced:    frontend/src/views/HomePage.vue           (was a simple placeholder;
                                                        now orchestrates SiteHeader +
                                                        HeroSection + TutorialSection +
                                                        ContactSection)
```

`npm run build` is **green** (`vue-tsc -b && vite build`, ~400 ms, 0 TS errors).

### ✅ Implemented & functional

- Routing + global layout (Home → Dashboard → Workspace) with route guard.
- Project CRUD, resume, snapshot save, status badges, filter tabs, stat cards.
- Slide editor (Parts 1/2/4): text & image elements with drag/resize/flip,
  font family/weight/size/alignment/color, slide backgrounds (image or solid),
  Part-1 global-theme propagation, slide thumbnails, add/delete slides.
- **Part 3** — fully wired: per-slide pair model, image upload, **streamed**
  story generation with live `part1` preview parsing, choice-based **streamed**
  continuations, animation generation up to 3 attempts with task polling and
  version selection, save chosen video to the pair, 3-tab story panel
  (Story / Design Rationale / Sound Design), TTS narration with 6 voices and
  play/pause/stop controls.
- **Part 5** — instruction video upload + replay on a "Making Example" slide
  that picks up the global theme.
- **Part 6** — sketch upload, contextual chatbot (`Part6AssistancePanel`)
  triggers `generateStyles`, 3-pig style picker, convert + result-compare view,
  "Convert again" tracks used styles via broken-pig icons.
- Slide-design chatbot for default parts (with i18n suggestions, typing dots).
- FastAPI backend complete: streaming via httpx, Edge-TTS audio bytes,
  Volcengine Ark integration with markdown-fence-tolerant JSON parsing.

### 🆕 Completed this session (2026-09-05)

- **New homepage** built strictly to the Figma design (file `1YkPdpdcSSvcBXPcp5nFxO`):
  sticky `SiteHeader` with logo / Home·Tutorial·Contact anchor nav (active link
  tracked via `IntersectionObserver`) / EN-中文 toggle / Access pill button.
  Hero section overlays the "Art / Bloom" wordmark on the painted-shapes
  illustration; 3-photo collage on the right. Tutorial section: 5 gradient cards
  with overlapping numbered chips. Contact section: how-we-can-help + email/WeChat
  info on the left, semantic `<form>` on the right. All copy is i18n-driven.
- **Design tokens centralised** in `tokens.css` (every Figma color, gradient,
  radius, shadow, spacing step, font stack and clamp-based type-scale step is a
  CSS variable — components reference vars only, no hard-coded design values).
- **Custom typography wired up** — IF Kica (light/regular/bold) for body & display
  copy and Waiting for the Sunrise for handwritten captions, all loaded via
  `@font-face` from local `.ttf` files (no Google Fonts request).
- **Real Figma assets downloaded** — all 13 PNGs (logo, logo-mark, hero-main,
  hero-photo-1/2/3, tutorial-banner, tutorial-step-1..5, contact-banner) plus the
  shared `Underline.svg`. The squiggle in `HeroPhotoCollage` and the underline in
  every `SectionHeading` instance both use the same `Underline.svg`.
- **Pre-existing TypeScript errors fixed** — `Part6AssistancePanel.vue` had 3
  null-index errors on `store.styles[store.selectedStyleIdx]` (idx is
  `number | null`); replaced all 3 sites with a single `selectedStyle` computed
  helper. `MyLessons.vue` had a snapshot-shape mismatch with `slideStore.loadSnapshot`;
  fixed by tightening `SlideSnapshot` in `projects.ts` so `globalBackground` and
  `globalBgColor` are required keys with `string | undefined` values, matching the
  exact return type of `useSlideStore().getSnapshot()`. `createProject()` updated
  to seed those keys with `undefined`.
- **Fine-tuning per design feedback (latest):**
  - Hero paragraph pulled up `-150px` and given `position: relative; z-index: 2`
    so it floats *above* the painted-shapes illustration.
  - Photo collage shifted up `-75px`. Both decorative captions
    ("Start from the textbook…" / "Provide visible guidance…") were removed
    from the hero per latest feedback (i18n keys remain but unused).
  - Hero photo cards no longer have any hover transform/lift — they sit static.
  - Both negative shifts are reset inside `@media (max-width: 1100px)` /
    `(max-width: 900px)` so mobile layouts stay clean.

### 🚧 Not implemented / known gaps

- **Part 7 (Share & Feedback)** is just a placeholder card.
- **"Start Teaching"** header button is permanently disabled
  (`canStartTeaching` is hard-coded `false` in `CreateLesson.vue`); no
  presentation/teaching mode exists.
- **"Preview Lesson"** button is a no-op.
- The plain **"Save"** button at the bottom of every part is a no-op
  (`@click="() => {}"`); only "Save & Next" advances the part.
  Project autosave only happens via the Back button.
- `Project.status` is never written; Dashboard filters/stats other than
  "All" / "Drafts" are always empty in practice.
- ~~Dashboard table column **Unit/Lesson** shows a placeholder `—`.~~ ✅
  Now populated from `Project.meta` (curriculum snapshot captured by the
  lesson-selection modal). Legacy projects without `meta` still fall back
  to `—`. See §14.
- Image-tool dropdown's **"Generate an image"** option is a stub
  (`generateImage()` just closes the menu).
- Toolbar **Video** and **Audio** tool icons are decorative — no behaviour.
- **Part 5** strings are hard-coded English (no i18n).
- **Part6AssistancePanel** hard-codes English assistant messages and does not
  forward `language` to `/api/chat` (the main chatbot does).
- **No backend persistence/auth**; everything is in-browser.
- Two stray SVGs at repo root (`broken pig.svg`, `pig 1.svg`) duplicating
  `frontend/public/`.
- **`backend/.env.example` was just deleted** in the working tree but the
  README still tells users to `cp .env.example .env`. Either restore it or
  update README.
- `TTSRequest.voice_id` default is a Volcengine voice string but the backend
  uses `edge-tts` with Edge IDs — dead default value.
- `home.hero.captionTopRight` and `home.hero.captionBottomRight` i18n keys (EN
  and ZH) are no longer rendered after the latest design feedback removed the
  collage captions — harmless dead strings, candidates for a follow-up cleanup.
- `frontend/src/assets/hero.png` is the original placeholder hero image and is
  no longer referenced (the new homepage uses `assets/images/hero-main.png`).
  Safe to delete.
- The hero photo PNGs are very heavy (15–21 MB each at 2× scale exported from
  Figma). Vite emits them un-optimised; compressing/resizing to ~1–2 MB each
  is a reasonable follow-up.

---

## 11. Code conventions cheat-sheet

- API base in frontend: `import.meta.env.VITE_API_BASE ?? 'http://localhost:8001'`.
- Stores use Vue 3 setup-store style: `defineStore('name', () => { ... })`.
- ID schemes:
  - Project: `proj-${Date.now()}`
  - Slide:   `slide-${Date.now()}`
  - Element: `el-${++elCounter}`
- SSE handling: split on `\n`, lines starting with `data:`, accumulate
  `choices[0].delta.content`. Markdown code fences (` ```json … ``` `) are
  stripped before `JSON.parse`.
- Background propagation: any Part-1 background change sets globals + propagates
  to every slide with `isLocalBackground !== true`.
- Per-slide Part-3 pairs are ensured via
  `watch(slideStore.activeSlideId, id => part3Store.ensurePair(id))`.
- All workspace styles are **scoped** in their respective `.vue` files; no
  global Tailwind component classes; brand color is hard-coded as `#7FEC8F`
  in workspace components, while the **homepage components** consume the
  CSS variables in `assets/styles/tokens.css` (e.g. `var(--color-primary)`,
  `var(--font-display)`, `var(--space-5)`).
- Homepage typography uses CSS variables `--font-display` (IF Kica) and
  `--font-script` (Waiting for the Sunrise); type sizes use `clamp()` for
  fluid responsiveness rather than discrete media-query breakpoints.
- Layout is CSS Grid + Flexbox throughout the new homepage. The **only**
  `position: absolute` exception is the numbered chip overlay on each
  `TutorialCard` (image/body seam) and the wordmark `<h1>` overlaying the
  painted-shapes hero illustration. Everything else is grid/flex/transform.

---

## 12. Quick run / dev checklist

```bash
# Backend
cd backend
conda env create -f environment.yml      # first time
conda activate artbloom
echo "ARK_API_KEY=…" > .env              # required
uvicorn main:app --port 8001 --reload
curl http://localhost:8001/health

# Frontend
cd frontend
npm install
npm run dev          # http://localhost:5173

# Production build
cd frontend && npm run build             # outputs dist/
```

---

---

## 13. New homepage architecture (Figma redesign)

The Figma source (`1YkPdpdcSSvcBXPcp5nFxO`) was reproduced as a fully
componentised, responsive Vue page. The orchestrator is
`frontend/src/views/HomePage.vue`, which mounts `SiteHeader` plus three
anchored `<section>` blocks (`#home`, `#tutorial`, `#contact`).

### Component breakdown

| Component | Responsibility |
|-----------|----------------|
| `SiteHeader.vue` | Sticky brand bar. Logo is a `RouterLink` to `/`. Anchor nav (Home / Tutorial / Contact) uses smooth scroll + `IntersectionObserver` for active-state highlighting. EN/中文 toggle calls `i18n.locale` setter. **"Access" pill** opens `<AccessModal>` via `accessOpen = true`; on submit the header navigates to `/dashboard` (placeholder until backend auth lands). |
| `AccessModal.vue` | Native `<dialog>` invitation-code modal (no teleport / no third-party lib). Props: `open` (v-model). Emits: `update:open`, `submit(code)`. Uses `dlg.showModal()` for free focus trap, ESC-to-close, scroll lock, `::backdrop` styling, and focus restore. Backdrop click + `<form @submit.prevent>` → emits `submit`. Stub: any code is accepted; parent routes to `/dashboard`. |
| `HeroSection.vue` | 2-column grid. Left: `hero-main.png` painted-shapes illustration with the "Art / Bloom" wordmark absolutely positioned over it, plus the body paragraph (pulled up `-150px` and z-indexed above the illustration). Right: `<HeroPhotoCollage>`. |
| `HeroPhotoCollage.vue` | A `<figure><ul>` of 3 photo `<li>` cards, each with its own `--rotate` and `--shift-y` transform. Cards are static (no hover). Captions removed per latest design feedback. |
| `SectionHeading.vue` | Reusable headline component: title + `Underline.svg` decorative underline + optional subtitle. Used by both `TutorialSection` and `ContactSection`. |
| `TutorialSection.vue` | "Tutorial" heading + 5-card grid + introductory paragraph + small footer logo. Renders the bold "ArtBloom" inline via the `home.tutorial.introBold` i18n key. |
| `TutorialCard.vue` | Per-step card. Background gradient varies by step index (1-5) via `--card-gradient` CSS variable. Image at top, body below, numbered chip overlapping the seam (the only `position: absolute` in this component). |
| `ContactSection.vue` | 2-column grid. Left: `<HowWeCanHelpCard>` over `<ContactInfoCard>`. Right: `<ContactForm>`. |
| `HowWeCanHelpCard.vue` | 3 rows (Access Support / Research / Feedback). Each row uses an inline SVG icon inside a coloured circle bubble. |
| `ContactInfoCard.vue` | Email + WeChat with a vertical divider between them. Email is a real `mailto:` link. |
| `ContactForm.vue` | Semantic `<form>` with `<fieldset>`/`<legend>`/`<label>`/`<input>`/`<textarea>` + a "Send Message" pill button. Submission is currently a `console.info` stub. |

### Style architecture

`main.ts` imports the global stylesheets in this order:
```ts
import './assets/styles/fonts.css'
import './assets/styles/tokens.css'
import './assets/styles/base.css'
import './style.css'
```

- `fonts.css` — `@font-face` rules for IF Kica light/regular/bold and Waiting
  for the Sunrise (4 local TTFs in `assets/styles/fonts/`).
- `tokens.css` — single source of truth for design tokens:
  - **Colors:** `--color-bg`, `--color-text`, `--color-text-soft`,
    `--color-primary` (brand green `#7FEC8F`), `--color-primary-soft`,
    `--color-input-bg`, `--color-divider`, …
  - **Tutorial gradients:** `--card-gradient-1` … `--card-gradient-5`
    (peach / mint / lavender / sky / butter — matched to Figma).
  - **Chip & bubble colors:** per-step accent colors for numbered chips and
    icon-bubble fills in `HowWeCanHelpCard`.
  - **Typography:** `--font-display`, `--font-script`, plus
    `--fs-hero` / `--fs-h2` / `--fs-h3` / `--fs-body-lg` / `--fs-body` /
    `--fs-script` — all using `clamp(min, fluid, max)` for fluid scaling.
  - **Spacing:** `--space-1` … `--space-9` (4-pt scale).
  - **Radii:** `--radius-card` (16/30/35), `--radius-pill` (`999px`).
  - **Shadows:** `--shadow-photo`, `--shadow-card`, …
  - **Layout:** `--content-max`, `--gutter`, `--header-height`.
- `base.css` — minimal reset, body typography defaults, `scroll-margin-top`
  for anchor jumps so the sticky header doesn't cover the section, and a
  `.sr-only` utility class.

### Responsive strategy

- **Desktop (default):** multi-column grid, photo collage right of hero,
  5-card tutorial grid, 2-column contact section.
- **≤1200/1100px:** photo collage stacks under the hero text, hero shifts
  reset to 0.
- **≤900px:** tutorial grid collapses to 3-then-2 column.
- **≤800/720/540px:** all sections stack to a single column; type scale
  shrinks via the `clamp()` floors; padding/gutters tighten.

### Backwards-compatibility notes

- The old `home.welcome` / `home.desc` / `home.getStarted` i18n keys were
  removed when the placeholder `HomeView.vue` was replaced; ensure any
  external references are updated.
- `assets/hero.png` and `public/draft.png` are no longer referenced from the
  new homepage but remain on disk.

---

---

## Dashboard hub addition (2026-09-05)

A new **Dashboard hub** view was inserted between the homepage Access modal
and the existing lesson-list screen.

### Route table change

| Path        | Name        | Component              | Notes                                         |
|-------------|-------------|------------------------|-----------------------------------------------|
| `/`         | `home`      | `HomePage.vue`         | unchanged                                     |
| `/dashboard`| `dashboard` | **`Dashboard.vue`** ⬅ NEW | 5-card hub landing page                  |
| `/lessons`  | `lessons`   | `MyLessons.vue`        | **moved** from `/dashboard`                   |
| `/workspace`| `workspace` | `CreateLesson.vue`     | guard now redirects to `'lessons'`, not hub   |

### Flow

```
HomePage ─[Access modal → "Enter ArtBloom"]→ Dashboard hub (/dashboard)
                                                  │
                                                  ├─[My Lessons]──→ /lessons (MyLessons.vue)
                                                  ├─[Create Lesson]──→ orphan (no-op, console.info)
                                                  ├─[Community]──→ orphan
                                                  ├─[Start Teaching]──→ orphan
                                                  └─[My Account]──→ orphan
   ▲
   └─ logo button on Dashboard ─ router.push('/')
```

### New files

| File | Purpose |
|---|---|
| `src/views/Dashboard.vue` | Hub page: header + title + decorative hero PNG + 5-card grid |
| `src/components/dashboard/DashboardHeader.vue` | Logo (← home button) on left, avatar + greeting on right, with `#B7B7B7` divider underline |
| `src/components/dashboard/DashboardCard.vue` | Reusable `<button>` action card. Props: `color` (CSS-var token), `icon` (one of 5 inline SVGs: sparkles/palette/book/play/person), `title`, `description`. Pinned entry-arrow circle bottom-right via `margin-top: auto`. |
| `src/stores/user.ts` | Tiny Pinia store: `username` ref persisted to `localStorage['artbloom-username']`, plus `setUsername()` / `clearUsername()`. |
| `src/assets/images/dashboard-hero.png` | 2048×768 painted-shapes decoration (right of title) |
| `src/assets/images/avatar-default.png` | 512×512 placeholder avatar |

### User-name flow

`SiteHeader.onAccessSubmit(code)` now calls `userStore.setUsername(code || 'Guest')`
before `router.push('/dashboard')`. The Dashboard's `<DashboardHeader>` reads
`userStore.username` and renders **verbatim** as `Hi, {code}` (e.g. `Hi, AB-7729-ST`).
Empty input → `Hi, Guest`. Persisted to localStorage so a refresh on /dashboard
keeps the greeting populated.

### New design tokens (in `tokens.css`)

```css
--card-create:    #FFE1F8;  /* pink   — Create Lesson  */
--card-lessons:   #FFE1D2;  /* peach  — My Lessons     */
--card-community: #CEE1FF;  /* blue   — Community      */
--card-teach:     #F2FFA9;  /* yellow — Start Teaching */
--card-account:   #CEFFD6;  /* green  — My Account     */
--shadow-card-soft: 2px 10px 15px rgba(0,0,0,0.05);
--shadow-entry-btn: 2px  4px 10px rgba(0,0,0,0.08);
--shadow-avatar:    3px  3px  6px rgba(0,0,0,0.15);
--shadow-divider:    0   4px  4px rgba(0,0,0,0.10);
```

### New i18n namespace: `dashboardHub.*`

Kept separate from the existing `dashboard.*` (which serves MyLessons) to
avoid key collisions. Includes `title`, `subtitle`, `greeting` (`Hi, {name}`),
`homeAriaLabel`, `entryAriaLabel`, `avatarAlt`, `heroAlt`, and
`cards.{createLesson,myLessons,community,startTeaching,myAccount}.{title,description}`.

### Responsive grid

`grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))` — collapses
5 → 4 → 3 → 2 → 1 columns automatically. The decorative hero hides under
720 px. No `position: absolute` is used for layout (only the underline
overlay on the heading, matching the homepage pattern).

### Caveats / TODO

- The 4 orphan cards visually look fully active per the Figma; clicks
  log `[Dashboard] "<id>" card clicked — view not implemented yet.`
  Replace with real `router.push()` calls as the corresponding views
  ship.
- The avatar is a static placeholder image used for everyone until real
  auth + uploads exist.

---

---

## DashboardHeader sized-up + reused in MyLessons (2026-09-05, follow-up)

The Dashboard hub header was promoted to the canonical authenticated-area
header and now matches `SiteHeader` exactly so the bar feels identical across
the marketing site and the app shell.

### Sizing parity with `SiteHeader`

| Property        | Before                  | After (matches SiteHeader)         |
|-----------------|-------------------------|------------------------------------|
| Bar height      | `min-height: 101px`     | `var(--header-height)` = **88 px** |
| Position        | static                  | **`sticky; top: 0; z-index: 100`** |
| Logo height     | `72px`                  | **`56px`** (40 px @ ≤720 px)       |
| Avatar diameter | `70px`                  | **`52px`** (44 / 38 responsive)    |
| Padding         | `--space-4 --gutter`    | **`--space-3 --gutter`**           |
| Max-width       | none                    | **`var(--content-max)`**           |

The bottom divider (`#B7B7B7` + `0 4px 4px /10%`) is preserved.

### Language switch button added

The same pill button used in `SiteHeader` (`.db-header__lang`, identical
styles + `toggleLocale` from `@/i18n`) sits between the avatar+greeting and
the right edge:

```
[Logo button] ··· [Lang pill] [Avatar] [Hi, {username}]
```

Rationale: keeping the user-identity block right-most matches the original
Figma; the lang pill slots in just to the left, the same way the Access
pill is the right-most element in `SiteHeader`.

### Logo click behaviour

The logo is now a `<button>` (was a static `<img>`) with this handler:

```ts
function onLogoClick() {
  if (route.path === '/dashboard') window.location.reload()
  else router.push('/dashboard')
}
```

So:
- From `/lessons` (or any other authed page) → routes to `/dashboard` (hub).
- From `/dashboard` itself → full page reload (familiar "tap logo to refresh"
  gesture).

Aria label moved from `dashboardHub.homeAriaLabel` to a new key
**`dashboardHub.dashboardAriaLabel`** ("Go to dashboard" / "前往工作台") in
both `en.ts` and `zh.ts`. The old key remains in place for any future caller
that genuinely wants "back to homepage" semantics.

### Reused in `MyLessons.vue`

`MyLessons.vue` previously had its own inline header markup
(`<header class="dash-header">` with a 40 px logo and a separate
`.lang-btn`) plus ~30 lines of bespoke CSS. All of that was deleted and
replaced with a single `<DashboardHeader />` element at the top of its
template. Result: every authenticated screen renders the **same** bar with
the same lang toggle, the same avatar/greeting, and the same logo
behaviour. The `toggleLocale` import was also dropped from `MyLessons.vue`
since the shared header now owns that interaction.

Build status: `npm run build` clean in 388 ms, zero TS errors.

---

## ⚠️ Logo asset convention (important)

There are **two** logo images on disk and they are **not interchangeable**:

| File | Variant | Where it MUST be used |
|---|---|---|
| `frontend/src/assets/images/logo.png` | **Black & white** wordmark | **Only** on the marketing-site header (`SiteHeader.vue`) |
| `frontend/src/assets/images/logo-mark.png` | Full-colour brand mark | **Every other header** in the app — including `DashboardHeader.vue` (Dashboard hub + MyLessons + any future authenticated view) and the workspace header |

When adding a new header / authenticated screen, import `logo-mark.png`,
not `logo.png`. Reserve `logo.png` strictly for the public homepage's
`SiteHeader`.

`DashboardHeader.vue` was updated accordingly: its `logoUrl` import now
points at `@/assets/images/logo-mark.png` with an inline comment
documenting this rule.

---

_Last updated: 2026-09-05 (homepage redesign + TS cleanup + design feedback iteration + Dashboard hub view + DashboardHeader parity & MyLessons reuse + logo asset convention + lesson-selection modal)._

---

## 14. Lesson-selection modal (Dashboard "Create Lesson" flow)

The Dashboard hub's **Create Lesson** card is wired up. Clicking it opens a
single self-contained modal that drives the user through three internal
stages without ever navigating away — only when a lesson is finally picked
does the parent `Dashboard.vue` create a `Project` and route to the workspace.

### Flow

```
Dashboard hub ─[Create Lesson card]─► LessonSelectionModal
                                          │
        Stage 1 — Volume picker  ────────►│  6 grade groups × 2 volume tiles (12 covers)
                                          │  (only g2v2 is `available` during testing)
                                          ▼
        Stage 2 — Unit picker    ────────►│  textbook on left, 5 unit rows ("+") on right
                                          ▼
        Stage 3 — Lesson picker  ────────►│  selected unit becomes "−", reveals 5 lesson pills
                                          ▼
                              emit('select', {volume,unit,lesson})
                                          │
                            Dashboard.vue creates Project + ProjectMeta,
                            slideStore.reset(), part5Store.clearVideo(),
                            router.push('/workspace')
```

The modal's only escape hatch back to stage 1 from later stages is a
"← Back to volume picker" link; the close button (×, ESC, backdrop click)
dismisses the whole flow.

### New / changed files

| File | Purpose |
|---|---|
| `src/data/curriculum.ts` | Typed curriculum data — `CurriculumVolume` × 12 (Grades 1-6 × Volumes 1-2). Each volume carries its `coverUrl` (Vite-imported PNG), an `available` flag, and a `units[]` array. Only **g2v2** is fully populated during the testing stage; the other 11 volumes have `available: false` and `units: []`. Lesson rows include the verbatim `task`, `category` (A/B), and `aiSupport` columns from the source xlsx so this module also doubles as a lookup for future Part-3 / Part-6 prompts. |
| `src/components/dashboard/LessonSelectionModal.vue` | Three-stage native-`<dialog>` modal (same pattern as `AccessModal.vue`). One `stage` ref drives v-if/v-else branches. Emits `update:open` (v-model) and `select({volume, unit, lesson})`. Reads `useI18n().locale` to switch between `titleEn` / `titleZh` everywhere. **Dumb component** — does not create projects or navigate. |
| `src/assets/images/textbooks/g{1..6}v{1..2}.png` | 12 textbook covers exported from Figma (file `1YkPdpdcSSvcBXPcp5nFxO`, node `563:2601`) at 2× scale. ~2 MB each, room for follow-up compression. |
| `src/i18n/{en,zh}.ts` | New top-level `lessonSelect.*` namespace: `title`, `grade`, `volume`, `unit`, `lesson`, `backToVolumes`, `closeAria`, `volumeAria`. Uses i18n parameters (`{n}`, `{grade}`, `{volume}`) for both languages. |
| `src/stores/projects.ts` | New `ProjectMeta` interface stored alongside each `Project`. Captures `volumeId`, `unitId`, `lessonId` plus a **snapshot** of the `unitTitleEn/Zh` and `lessonTitleEn/Zh` strings (so renaming `curriculum.ts` later won't retroactively rewrite saved decks). `createProject(name, meta?)` accepts the new optional argument; legacy callers (MyLessons "+ New Lesson" prompt) keep working unchanged. |
| `src/views/Dashboard.vue` | Imports `LessonSelectionModal` and binds `v-model:open`. New `onLessonSelect(...)` builds a `ProjectMeta`, creates the project with the locale-appropriate `lessonTitleEn`/`lessonTitleZh` as the project name, resets `slideStore` + `part5Store`, and pushes `/workspace`. The Create-Lesson card click now opens the modal instead of logging "view not implemented". |
| `src/views/MyLessons.vue` | New `unitLessonLabel(project)` helper renders `Unit N: Title · Lesson M: Title` (locale-aware) in the **Unit / Lesson** table column. Returns `null` for legacy projects → falls back to `—`. The label uses the same `lessonSelect.unit` / `lessonSelect.lesson` i18n keys as the modal so the two stay aligned end-to-end. |

### Curriculum data model

```ts
interface CurriculumLesson {
  id: string                  // 'g2v2-u3-l1'
  number: number              // 1..5 within unit
  titleEn: string             // 'Where Is Spring?'
  titleZh: string             // '春天在哪里'
  task: string                // verbatim "Main textbook task" column
  category: 'A' | 'B'         // A = 2D image / B = physical making
  aiSupport: string           // verbatim "Suggested AI support" column
}
interface CurriculumUnit   { id, number, titleEn, titleZh, lessons[] }
interface CurriculumVolume {
  id, grade(1..6), volume(1..2), coverUrl,
  available: boolean,         // only g2v2 = true during testing
  units: CurriculumUnit[]     // [] when !available
}
```

`curriculumByGrade: CurriculumVolume[][]` is a precomputed
`[[g1v1,g1v2],[g2v1,g2v2],…]` grouping that the modal renders directly.

### Modal UX details

- Built on native `<dialog>` (free focus-trap, ESC, scroll-lock, `::backdrop`,
  focus restore). Same defensive CSS pattern as `AccessModal.vue`: **no**
  layout properties on the base `.lsm` rule, all layout gated behind
  `[open]`, so a closed dialog stays `display: none` and never leaks into
  the page on initial load.
- Stage 1 grid: `repeat(3, 1fr)` desktop → `repeat(2, 1fr)` ≤1100 px → `1fr` ≤720 px.
  Each grade group nests a `1fr 1fr` sub-grid for the two volumes.
- Orphan tiles (`available === false`) render at 55 % opacity with
  `cursor: not-allowed` and a `console.info` log on click — same orphan
  pattern the Dashboard cards use for unimplemented routes.
- Stage 2 / 3 share a `panel` two-column grid (cover left, unit list right).
  Tapping a unit row toggles its `expandedUnitId`: pills slide out beneath
  the row and the "+" affordance morphs into "−" (a single horizontal bar
  inside the same dark circle).
- Reset behaviour: every fresh `open` resets `stage`, `selectedVolume`, and
  `expandedUnitId` so reopening always starts at stage 1.
- The lesson **project name** uses the locale-appropriate title at the
  moment of creation; switching language afterwards leaves the saved name
  alone (matches how the unit/lesson labels in MyLessons re-localise via
  `meta` snapshots — names are static, prefixes/titles re-localise).

### Build & type check

`npm run build` clean (`vue-tsc -b && vite build`, ~450 ms, 0 TS errors).
All 12 textbook PNGs are emitted with content-hashed filenames into `dist/assets/`.

### Caveats / TODO

- 11 of 12 volumes are stubbed with `available: false`. To enable another
  volume, populate its `units[]` in `curriculum.ts` and flip the flag.
- The `task` / `category` / `aiSupport` lesson fields are present on every
  lesson row but **not yet consumed** anywhere — they are intended for
  future Part-3 / Part-6 prompt scaffolding.
- Cover PNGs (~2 MB each at 2×) ship un-compressed; same follow-up note as
  the homepage hero photos.
- The two unused `home.hero.captionTopRight` / `captionBottomRight` keys
  remain dead — unrelated, but candidates for the same future cleanup pass.

---

## 15. Community view (lesson library)

The Dashboard hub's **Community** card now routes to a real view at
`/community` instead of logging "view not implemented". The page is
intentionally a *placeholder shell* — the layout, copy, and components
are production-grade, but the data behind them is static.

### Flow

```
Dashboard hub ─[Community card]→ /community  (Community.vue)
                                       │
                                       │ ← Back to Dashboard link
                                       ▼
                           Dashboard hub (/dashboard)
```

### New / changed files

| File | Purpose |
|---|---|
| `src/views/Community.vue` | Top-level view. Composition: `<DashboardHeader>` → "← Back to Dashboard" link → title block (Community + `Underline.svg` + subtitle, with the same `dashboard-hero.png` painted-shapes decoration to the right) → filter bar (Grade Level / Unit / Lesson `<select>` × 3 + green Discover pill) → `<LessonCard>` grid → 3-page pagination with prev/next. Filter and pagination handlers are intentional `console.info` stubs until the backend lands. |
| `src/components/community/LessonCard.vue` | Reusable card matching the Figma `card` group exactly. Props: `id`, `titleEn`, `titleZh`, `unit`, `lesson`, `author`, `date`, optional `thumbnail`. Emits `preview(id)` and `save(id)` so the view (or any future caller) decides behaviour. Title swaps with the language pill via `useI18n().locale`. Date is formatted with `Intl.DateTimeFormat` ("May 12, 2026" in EN, "2026年5月12日" in ZH). |
| `src/data/communityDummy.ts` | Typed `CommunityLesson[]` of 6 placeholder lessons. Each entry carries an `id`, paired `titleEn` / `titleZh`, `unit`, `lesson`, `author`, ISO `date`, and optional `thumbnail`. When the backend lands this module is the obvious replacement target (drop a `useCommunityLessons` composable in the same shape). |
| `src/i18n/{en,zh}.ts` | New `community.*` namespace: `title`, `subtitle`, `backToDashboard`, `heroAlt`, `gridAria`, `filters.{aria,gradeLevel,unit,lesson,allGrades,allUnits,allLessons,discover}`, `card.{preview,save,unitLessonShort}` (uses `{unit}` / `{lesson}` parameters), `pagination.{aria,prev,next}`. |
| `src/router/index.ts` | New route `{ path: '/community', name: 'community', component: () => import('@/views/Community.vue') }`. Lazy-loaded; no guard. |
| `src/views/Dashboard.vue` | `onCardClick('community')` now calls `router.push('/community')` instead of falling through to the "view not implemented" `console.info` branch. |

### Layout / responsive

- Title block + decorative hero use the same `grid-template-columns: 1fr 1fr` → single-column collapse pattern that the `Dashboard.vue` hero uses, so the two pages feel like the same family. The hero is hidden under 720 px (matches Dashboard).
- Filter row uses `flex-wrap: wrap` with each `<label>` flexed to `1 1 200px` and capped at `240px`, so the three dropdowns keep equal widths until the viewport gets narrow, then stack to full width with the Discover button.
- Card grid: `grid-template-columns: repeat(auto-fit, minmax(380px, 1fr))` — natural 3-col → 2-col → 1-col collapse without media queries.
- Pagination is centred via `justify-content: center` on a flex container; active page uses `--color-primary` filled, others are outlined `#dedede`.

### LessonCard internals

- 240 × ~135 thumbnail on the left (16:9 aspect ratio) — flat `#f1f1f1` block when no `thumbnail` prop is provided, matching the Figma placeholder rectangle.
- Right column: `Title` (20 px bold, `#2f3334`) → `Unit N • Lesson M` (14 px, `#4e607c`) → action row pinned to the bottom via `margin-top: auto`.
- Save button uses the brand green at 50 % opacity (`rgba(127,236,143,0.5)`) per the Figma; Preview is an outlined neutral.
- Footer separator is a 1 px `#d9d9d9` rule with the avatar / author / date row underneath. Avatar reuses `assets/images/avatar-default.png`.

### Caveats / TODO

- The card "Save" and "Preview" buttons are both stubs (`console.info`). When real bookmarking lands, wire them to a new `useUserBookmarks` Pinia store (or whatever the backend dictates).
- Filter `<select>`s currently only have an "All …" option each. Once curriculum filtering is real, populate them from `curriculumByGrade` / a flattened lesson list.
- Pagination is decorative (3 pages, all rendering the same 6 cards). Replace `pages = [1,2,3]` with a computed value driven by total result count once the API is in place.
- The decorative hero is `dashboard-hero.png` reused for weight savings rather than the dedicated Figma asset (`0ea3f8e98bc534401cfb1162e52ff9a392202b24`). Easy to swap later if pixel-perfect parity matters.
- Build is green: `vue-tsc -b && vite build` ~430 ms, 0 TS errors. The Community route emits `Community-*.js` (8 kB) + `Community-*.css` (7 kB).


## 16. My Account view (avatar picker + profile + feedback)

Wires up the fifth Dashboard card (`myAccount`) to a real route at
`/account`. Reproduces the Figma frame `564:4677` ("My account-1") and
its avatar-picker overlay (`680:1280`, "My account-2").

### New / changed files

| File                                              | Purpose                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/data/avatars.ts`                             | 12 avatar images + `getAvatar(idx)` + `DEFAULT_AVATAR_INDEX = 8`                     |
| `src/stores/user.ts`                              | Extended: `inviteCode`, `displayName`, `bio`, `avatarIndex`, `displayLabel`, setters |
| `src/components/account/AvatarPickerPopover.vue`  | Native-`<dialog>` 6 × 2 grid picker                                                  |
| `src/views/MyAccount.vue`                         | Full account page (profile, invite-code card, feedback CTA, Picasso quote)           |
| `src/router/index.ts`                             | New `/account` route → lazy `MyAccount.vue`                                          |
| `src/views/Dashboard.vue`                         | `myAccount` card now `router.push('/account')`                                       |
| `src/components/dashboard/DashboardHeader.vue`    | Avatar block is now a button → `/account`; avatar driven by `getAvatar(userStore.avatarIndex)`; greeting uses `userStore.displayLabel` |
| `src/i18n/{en,zh}.ts`                             | New `account.*` namespace + `dashboardHub.accountAriaLabel`                          |
| `src/assets/images/avatars/avatar-{01..12}.png`   | 12 × 512 px Figma exports (the picker grid)                                          |
| `src/assets/images/account-decor.png`             | Right-side decorative collage on `/account`                                          |
| `src/assets/images/quote-banner.png`              | Background for the bottom Picasso-quote card                                         |

> Note: the legacy avatar import `assets/images/avatar-default.png` is
> no longer referenced by `DashboardHeader.vue`; if other views still
> import it (e.g. `LessonCard.vue` for the community-card author row)
> leave it on disk — it's still a valid static asset. Search before
> deleting.

### `useUserStore` API (canonical → legacy)

```ts
// canonical
inviteCode    : Ref<string>          // verbatim AccessModal invite code
displayName   : Ref<string>          // optional profile override
bio           : Ref<string>          // teaching motto
avatarIndex   : Ref<number>          // 0..11, defaults to 8
displayLabel  : Computed<string>     // displayName || inviteCode || 'Guest'
setInviteCode(code), setDisplayName(name), setBio(text), setAvatarIndex(n)
clearAll()                           // wipes all 4 fields + LS keys

// legacy aliases (kept so existing call sites don't churn)
username      = inviteCode
setUsername   = setInviteCode
clearUsername = () => clear inviteCode only
```

LocalStorage keys: `artbloom-username` (legacy, == invite code),
`artbloom-display-name`, `artbloom-bio`, `artbloom-avatar-index`.

### `AVATARS` data module

The picker grid is **6 × 2** with the Figma "selected" tile at row 2,
col 3. To keep the visual order identical to Figma while making
"selected" the array default, the array order is:

```
index :  0   1   2   3   4   5
file  : 06  05  04  12  11  10     ← row 1
index :  6   7   8   9  10  11
file  : 03  02  01* 09  08  07     ← row 2, *default = index 8
```

`getAvatar(idx)` is clamp-safe — out-of-range / NaN falls back to
`DEFAULT_AVATAR_INDEX`, so callers can always do
`getAvatar(store.avatarIndex).src` without a null check.

### `MyAccount.vue` layout (Figma `564:4677`)

```
┌─ DashboardHeader (logo • lang • avatar→/account) ──────────┐
│
│  ← Back to Dashboard
│  My Account               (Underline.svg)
│  Welcome, {displayLabel}
│  Manage your profile, share feedback, and stay inspired.
│
│  ┌── profile (green gradient) ──┬── invite code (blue) ──┐
│  │  [avatar + ✎ edit pencil]    │  Invitation Code       │
│  │  Display Name [input]        │   ABCD-1234            │
│  │  Teaching Motto [textarea]   │                        │
│  └──────────────────────────────┴────────────────────────┘
│
│  ┌── feedback (yellow) ─────────────────────────────────┐
│  │  Help us improve ArtBloom            [Send Feedback →]│
│  └─────────────────────────────────────────────────────-┘
│
│  ┌── Picasso quote banner (full-width) ────────────────-┐
│  │  "Every child is an artist…" — Picasso                │
│  └─────────────────────────────────────────────────────-┘
│
│                                              [account-decor.png →]
└────────────────────────────────────────────────────────────┘
```

- **Back link** → `router.push('/dashboard')`.
- **Edit pencil** → opens `<AvatarPickerPopover v-model:open="pickerOpen" />`.
- **Send Feedback** → `router.push({ path: '/', hash: '#contact' })`
  (re-uses the existing homepage contact section; do **not** add a new
  `/feedback` route until product confirms a separate page is wanted).
- **Display name / bio** are bound to local `ref`s so typing is fast;
  changes flush to the Pinia store on `change` / `blur`.
- **Decorative right-side image** (`account-decor.png`) is `position:
  absolute` and faded into the page background via a CSS `mask-image`
  linear-gradient (we cannot apply `box-shadow: inset` to an `<img>`).
  It hides under 1100 px to free up horizontal space for the cards.

### `AvatarPickerPopover.vue` (Figma `680:1280`)

- Native `<dialog>` — same defensive pattern as `AccessModal` /
  `LessonSelectionModal`. ESC, focus-trap, scroll-lock, `::backdrop` are
  all "free".
- Watches `props.open` and calls `dlg.showModal()` / `dlg.close()`
  imperatively (Safari still ignores the boolean attribute).
- Layout: `grid-template-columns: repeat(6, 1fr)` with a 10 px gap;
  collapses to 4 cols at 720 px and 3 cols at 480 px.
- The selected tile sits inside a white pill (`.apk__cell--selected`)
  with a `3 3 6 / 15 %` shadow + `translateY(-2px)` lift to match Figma.
- Click → `userStore.setAvatarIndex(idx)` → emit `update:open=false`.
  No "Save / Cancel" — picking is the commit, like macOS Memoji.

### DashboardHeader changes (avatar block now interactive)

- Replaced `<div class="db-header__user">` with a `<button>` so the
  whole avatar + greeting cluster is keyboard-focusable. New aria label:
  `dashboardHub.accountAriaLabel` (`Open my account` / `打开我的账户`).
- Click handler `onUserClick`: if already on `/account`, reload (mirrors
  `onLogoClick`'s symmetry); otherwise `router.push('/account')`.
- Hover: `background: rgba(127,236,143,0.12)` pill + 2 % scale, matching
  the logo button. `border-radius: var(--radius-pill)` so the focus
  ring wraps cleanly around the whole pill.
- Avatar `<img>` now uses `getAvatar(userStore.avatarIndex).src` instead
  of the static `avatar-default.png` import — the user's pick on the
  account page is reflected everywhere immediately (Pinia reactive
  binding + LS persistence).
- Greeting now renders `userStore.displayLabel`, so once the user sets a
  display name it replaces the invite code in `Hi, {name}` across every
  authenticated header.

### i18n (`account.*`)

```
account.title                  account.welcome (with {name})
account.backToDashboard        account.subtitle
account.profile.displayName    account.profile.displayNamePlaceholder
account.profile.bio            account.profile.bioPlaceholder
account.profile.editAvatarAria
account.inviteCode.label
account.feedback.title         account.feedback.body         account.feedback.send
account.quote.text
account.picker.title           account.picker.ariaLabel      account.picker.closeAria
account.decorAlt
+ dashboardHub.accountAriaLabel  ('Open my account' / '打开我的账户')
```

### Build verification

`npm run build` completes in ~480 ms with 0 type errors. Two new
chunks: `MyAccount-*.js` (~6 kB / 2.3 kB gzip) + `MyAccount-*.css`
(~8 kB / 2.2 kB gzip). Avatar PNGs (~16 kB each at 512 px) are emitted
under `dist/assets/`.

### Caveats / TODO

- The Send Feedback CTA does a soft re-route to `/#contact`; nothing
  pre-fills the form with the current invite code. If product wants
  feedback to carry the code automatically, push a query param (e.g.
  `/?contact=1&code=…`) and read it in `ContactSection.vue`.
- Display name and bio are persisted only to localStorage. When real
  auth lands, swap the AccessModal handler from `setInviteCode(code)`
  to a `userStore.bootstrapFromAPI(payload)` action and treat LS as the
  cache.
- The Picasso quote text is hard-coded; if the design team wants
  rotating quotes, move it to an array in `account.quote.options[]` and
  pick a deterministic index from `userStore.inviteCode`.
- Avatar pool is fixed at 12 PNGs. To support uploads later, extend
  `Avatar` with `kind: 'preset' | 'custom'` and store the data-URL of
  custom uploads under `artbloom-avatar-custom`. The picker can then
  show a "+" tile that triggers `<input type="file" accept="image/*">`.
- The decorative right-side image is a single 824 × 1462 PNG (~1.8 MB).
  If page-weight matters on slower networks, run it through a webp
  pipeline; we deliberately kept the PNG to match Figma's `imageRef`
  exactly for now.



## 17. G2V2-U4-L4 designed slides + bilingual element text (2026-05-25)

The pilot LKP `g2v2-u4-l4` ("好长好长……") gained **5 fully designed
slides** across Parts 1 / 2 / 4 — the first time any LKP shipped real
layouts rather than the generic "section title + content_points"
fallback in `lessonSeed.ts`. The same change introduced **per-element
bilingual text** so the existing EN/中 toggle in `WorkspaceHeader.vue`
now swaps overlay copy live without losing the other language's edits.

### Schema additions

`SlideElementSeed` (TS in `frontend/src/types/lesson.ts`, Pydantic in
`backend/lesson_types.py`) gained two optional fields:

```ts
content_en?: string
content_zh?: string
```

`SlideElement` (the runtime Pinia type in `frontend/src/stores/slides.ts`)
gained the matching pair:

```ts
contentEn?: string
contentZh?: string
```

When at least one of the two LKP fields is present, `lessonSeed.ts`
populates both runtime fields and projects whichever side matches the
hydration locale into `content` (falling back to the other side if
only one was authored).

### Runtime model

`useSlideStore()` now exposes:

- `locale: Ref<'en' | 'zh'>` — mirror of `i18n.global.locale.value`.
- `setLocale(next)` — walks every slide, re-projects `content` from
  `contentEn` / `contentZh` for elements that have either set. Hand-
  created text (no variants) is left alone, so the Add Text button
  still behaves exactly as before.
- `updateElement(slideId, id, patch)` — when `patch.content` is
  present *and* the element is bilingual, the new text is mirrored
  into the active locale's variant. The other language survives.

`App.vue` runs a `watch(locale, …, { immediate: true })` that calls
`slideStore.setLocale(...)` so the workspace's EN/中 button now drives
slide text in addition to UI chrome.

### Seeder behaviour

`buildElements()` in `frontend/src/utils/lessonSeed.ts`:

- Used to gate on `default_elements && default_elements.length` —
  changed to `default_elements !== undefined` so an explicit empty
  array means "image-only slide, skip the generic fallback". The
  Part 1 cover slide uses this to render the artwork full-bleed
  without redundant overlay text.
- `buildSlides(seed, locale)` now threads the active locale through
  to each element constructor.

### LKP rewrite

`backend/data/lessons/g2v2-u4-l4.json`'s `slide_framework` grew from
7 → **9 entries** (Part 2 ×2, Part 4 ×2, others ×1):

| page | part | slide title (zh / en) |
|---|---|---|
| 1 | 1 | 封面 (image-only cover) |
| 2 | 2 | 长长的纸，不一样！/ Long Paper Is Different! |
| 3 | 2 | 长纸能做什么？/ What Can Long Paper Do? |
| 4 | 3 | (placeholder, no design yet) |
| 5 | 4 | 摆一摆，想一想 / Lay It Out, Think It Through |
| 6 | 4 | 画一画，添细节 / Draw It, Add the Details |
| 7 | 5 | (placeholder) |
| 8 | 6 | (placeholder) |
| 9 | 7 | (placeholder) |

Each designed slide ships title + subtitle + image + 3 step-cards, every
text element carrying both Chinese (extracted from the textbook author
team's PPTX) and freshly authored English. The cover background and
the four content-slide images live in
`frontend/src/assets/textbook-assets/G2V2-U4-L4/design/` and are
served by the backend's `/textbook-assets` static mount on port 8001.

### Source assets

The 5 design images were extracted from `好长好长part1.pptx` /
`part2.pptx` / `part4.pptx` (now in the same folder) using
`unzip → ppt/media/image*.png`. The PPTX files are kept on disk so
later edits can re-extract; the canonical assets in `design/` are
what the LKP URLs point at.

### Caveats / TODO

- Parts 3 / 5 / 6 / 7 still render via the generic seeder fallback
  (section title + content_points). When those parts get designed
  layouts, follow the same `default_elements` pattern and the
  bilingual text will Just Work.
- Multi-slide-per-part is supported by the seeder (`buildSlides`
  produces one Slide per `slide_framework` entry regardless of how
  many share a `part_id`), so the `WorkspaceSidebar` already shows
  "Part 2 · 1 / 2" style numbering correctly.
- The `lessonSeed.ts` seeder's locale parameter is read at *create*
  time. After hydration, the workspace's locale toggle is what drives
  swaps — no need to re-hydrate.
- `vue-tsc --noEmit` ✓ and Pydantic `LessonSeedData.model_validate(...)`
  ✓ on the rewritten JSON.


## 18. Community Preview popup + Save-to-MyLessons + global toast (2026-05-25)

The Community page's Preview / Save buttons used to be functional
stubs — Preview just opened the lesson in the workspace (no read-only
view existed), and Save was a `console.info` placeholder. Both are now
real, and a small global toast system was added en route.

### Behavioural change

- **Preview** opens a centred modal showing every slide of the
  selected LKP as a vertically scrollable thumbnail list. The modal
  is read-only — no edit controls, no buttons except a close ✕.
  Closes on backdrop click, ✕, or Esc. Does *not* navigate away.
- **Save** copies the LKP into the teacher's My Lessons library as a
  new Project tagged with `status: 'saved'` (so it lands in the
  existing "Saved" filter tab on `/dashboard/lessons`), then fires a
  bottom-right toast. The previously-active project is restored, so
  whatever the user has open in the workspace isn't disturbed.
- **Duplicate guard** — when a project already exists with the same
  `meta.lessonId`, the LessonCard's Save button switches to a muted
  grey "Saved" pill with a filled-bookmark/checkmark icon, and
  re-clicking fires an "Already in My Lessons" toast instead of
  creating a duplicate.

### New / changed files

| File | Purpose |
|---|---|
| `src/components/community/SlidePreviewModal.vue` | **New.** Teleported read-only deck previewer. Props: `open`, `slides: Slide[]`, `title`, `subtitle?`. Renders one `SlideThumbnail` per slide inside a 16:9 frame with a "Part N · Slide M" label. Locks body scroll while open. Reusable — drop into the My Lessons row "Preview" action later. |
| `src/components/common/ToastHost.vue` | **New.** Single global renderer. Teleports a pill-shaped card to the bottom-right with a slide+fade transition. Tone class (`success` / `info` / `warning`) shifts the icon colour. Click-to-dismiss. |
| `src/stores/toast.ts` | **New.** Tiny Pinia store: `show(text, tone='success', durationMs=3000)`, `dismiss()`, `current`. Single in-flight message — calling `show()` again replaces and resets the timer. No queue. |
| `src/App.vue` | Mounts `<ToastHost />` once (still owns the i18n→slide-store locale watcher). |
| `src/views/Community.vue` | `onPreview` hydrates the LKP and pops the modal (no more workspace navigation). `onSave` hydrates → dedupes by `meta.lessonId` → `createProject` + `saveCurrentProject` + tags `status: 'saved'` → restores `activeProjectId` → fires toast. A reactive `savedLessonIds` Set drives the new card state. Removed the now-unused `slideStore` / `part5Store` imports. |
| `src/components/community/LessonCard.vue` | New optional `saved?: boolean` prop. When true, the Save button renders as a muted grey "Saved" pill (`#e5e7eb` background, `#d1d5db` border, `#4b5563` text + icon) with a filled bookmark + checkmark glyph. Still clickable so the parent can fire the "Already in My Lessons" toast. |
| `src/i18n/{en,zh}.ts` | New keys: `community.card.saved`, `community.preview.{title,slideOf,close,empty}`, `community.save.{savedToMyLessons,alreadySaved}`. |

### State-flow

```text
LessonCard ──(@save id)──► Community.onSave
                              │
                              ├─ savedLessonIds.has(lessonId)?
                              │     └─ yes → toast.show("Already in My Lessons", "info")
                              │
                              ├─ hydrateProjectFromLesson(seed, locale)
                              ├─ prevActiveId = projectsStore.activeProjectId
                              ├─ projectsStore.createProject(name, meta) → newId  (side-effect: sets newId as active)
                              ├─ projectsStore.saveCurrentProject(snapshot)
                              ├─ projects.find(newId).status = 'saved'
                              ├─ projectsStore.setActiveProject(prevActiveId ?? '')
                              └─ toast.show("Saved to My Lessons", "success")
```

`savedLessonIds` is a `computed` over `projectsStore.projects` so the
Save → Saved transition re-renders every visible card immediately
after a successful save.

### Edit path

Editing a community-saved lesson is *already* wired — `MyLessons.vue`
→ Edit button → `resumeProject(id)` → `slideStore.loadSnapshot(...)`
→ router-push to `/workspace`. No additional changes needed.

### Caveats / TODO

- The dedupe key is `meta.lessonId`. If we ever let teachers
  *manually* duplicate a saved lesson (e.g. "Save another copy") we'll
  need either a UI affordance to bypass the guard or to lift the key
  to a composite (`lessonId + userIntent`).
- The toast store is single-slot deliberately. If product later wants
  stacked toasts (e.g. multi-action confirmations) replace `current`
  with a queue and let `ToastHost` render a list.
- The Preview modal numbers slides per-Part ("Part 2 · Slide 1 / 2")
  to mirror the workspace sidebar. If the eventual full-deck preview
  wants page numbers instead, just swap the computed in
  `SlidePreviewModal.vue` — it's a single Map<partId, count> walker.
- `vue-tsc --noEmit` ✓.

---

## 19. Production deployment — Pages + Render + R2 (2026-05-25)

### Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  Cloudflare Pages              Render Free                R2       │
│  ───────────────────           ──────────────             ───      │
│  artbloom.pages.dev   ──API──► artbloom-api.onrender.com           │
│         │                              │                           │
│         └─────────── assets ───────────┴──► pub-<hash>.r2.dev      │
│                                                                    │
│  Vue/Vite SPA                  FastAPI 0.115             Static    │
│  auto-deploy from main         auto-deploy from main     PNG/JPG   │
└────────────────────────────────────────────────────────────────────┘
```

Three independent surfaces, each deploys on `git push origin main`:

| Layer    | Host                 | Trigger              | Cost                  |
|----------|----------------------|----------------------|-----------------------|
| Frontend | Cloudflare Pages     | GitHub push          | Free (unlimited builds) |
| Backend  | Render               | GitHub push          | Free (750 hrs/mo, sleeps after 15 min idle) |
| Assets   | Cloudflare R2 bucket | `npm run r2:sync`    | Free up to 10 GB + 1 M class-A ops/mo |

The backend is **stateless** — Render's sleep cycle is fine; first
request after sleep cold-starts in ~50 s, subsequent requests are sub-second.

### Files added for deployment

| File                                      | Role                                                                                                                                   |
|-------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| `render.yaml`                             | Render Blueprint — declares the `artbloom-api` web service, build/start commands, env-var slots (`sync: false` for secrets).           |
| `backend/.env.example`                    | Documents all backend env vars (ARK_*, CORS_ALLOW_ORIGINS, TEXTBOOK_ASSETS_URL, future Volcengine Speech keys).                        |
| `backend/main.py` (patched)               | CORS origins now env-driven; StaticFiles mount skipped when `TEXTBOOK_ASSETS_URL` is set; defensive when `frontend/` dir missing (Render slug only ships `backend/`). |
| `backend/requirements.txt`                | Adds missing `edge-tts==7.0.0` (was imported but absent).                                                                              |
| `frontend/.env.example`                   | Documents `VITE_API_BASE` + `VITE_ASSETS_BASE`.                                                                                        |
| `frontend/public/_redirects`              | `/* /index.html 200` — SPA fallback so Vue Router history mode works on Pages.                                                         |
| `frontend/src/data/lessons/index.ts` (patched) | `rewriteAssetUrls()` walks each LKP at module load and swaps `http://localhost:8001/textbook-assets/` → `VITE_ASSETS_BASE` when set. |
| `frontend/scripts/sync-r2-assets.js`      | One-shot uploader for `textbook-assets/` → R2 via `wrangler r2 object put`.                                                            |
| `frontend/package.json`                   | New `r2:sync` script + `wrangler@^4` devDep.                                                                                           |

### Env var matrix

| Variable                | Where set                  | Dev value                          | Prod value                                |
|-------------------------|----------------------------|------------------------------------|-------------------------------------------|
| `ARK_API_KEY`           | Render → Environment       | local `backend/.env`               | (pasted in Render UI, `sync: false`)      |
| `ARK_STORY_MODEL`       | Render → Environment       | unset → default                    | unset → default, or custom ID             |
| `ARK_CHAT_MODEL`        | Render → Environment       | unset → default                    | unset → default, or custom ID             |
| `ARK_VIDEO_MODEL`       | Render → Environment       | unset → default                    | unset → default, or custom ID             |
| `ARK_IMAGE_MODEL`       | Render → Environment       | unset → default                    | unset → default, or custom ID             |
| `CORS_ALLOW_ORIGINS`    | Render → Environment       | unset (localhost dev ports)        | `*` (dev pilot) or `https://artbloom.pages.dev` |
| `TEXTBOOK_ASSETS_URL`   | Render → Environment       | unset (uses StaticFiles mount)     | `https://pub-<hash>.r2.dev`               |
| `VITE_API_BASE`         | Pages → Env Vars (prod)    | `http://localhost:8001`            | `https://artbloom-api.onrender.com`       |
| `VITE_ASSETS_BASE`      | Pages → Env Vars (prod)    | unset (LKP uses localhost URLs)    | `https://pub-<hash>.r2.dev`               |
| `NODE_VERSION`          | Pages → Env Vars (prod)    | n/a                                | `20`                                      |

### One-time setup runbook

**Step 1 — Cloudflare Wrangler login (interactive, you click)**

```bash
cd frontend
npx wrangler login            # opens browser → authorise → "Allow"
npx wrangler whoami           # should print your Cloudflare email
```

**Step 2 — Create R2 bucket + enable public access**

```bash
npx wrangler r2 bucket create artbloom-textbook-assets
```

Then in the dashboard:
1. https://dash.cloudflare.com → **R2** → `artbloom-textbook-assets`
2. **Settings** → **Public access** → **Allow Access** → **r2.dev subdomain**
3. Copy the resulting URL — e.g. `https://pub-abc123def456.r2.dev`

**Step 3 — Upload textbook assets**

```bash
npm run r2:sync
```

13 files (~5 MB total) — should take under a minute. Verify one URL works in a browser:
`https://pub-<hash>.r2.dev/G2V2-U4-L4/design/p1-s1-cover.png` → should display the cover image.

**Step 4 — Deploy backend on Render**

1. https://dashboard.render.com → **New** → **Blueprint**
2. Connect `ShadowsKuming/art_edu`; Render auto-detects `render.yaml`
3. **Apply** → wait ~3 min for first build
4. Service → **Environment** → paste:
   ```
   ARK_API_KEY               = <your Volcengine Ark key>
   TEXTBOOK_ASSETS_URL       = https://pub-<hash>.r2.dev
   CORS_ALLOW_ORIGINS        = *
   ```
   (Skip `ARK_*_MODEL` rows — defaults in `main.py` are fine.)
5. Render redeploys; wait ~1 min
6. Smoke test: `curl https://artbloom-api.onrender.com/health`
   → expect `{"ok":true,"api_key_set":true,"tts_voices":6,...}`

**Step 5 — Deploy frontend on Cloudflare Pages**

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Authorise the Cloudflare GitHub app on `ShadowsKuming/art_edu`
3. Select repo → **Begin setup** → branch `main`
4. **Build settings:**
   - Framework preset: **Vue**
   - Build command: `cd frontend && npm ci && npm run build`
   - Build output directory: `frontend/dist`
   - Root directory: *(blank)*
5. **Environment variables** (Production):
   ```
   VITE_API_BASE       = https://artbloom-api.onrender.com
   VITE_ASSETS_BASE    = https://pub-<hash>.r2.dev
   NODE_VERSION        = 20
   ```
6. **Save and Deploy** — first build ~2 min
7. Open `https://<project-name>.pages.dev`

### Deploy after first-time setup

Both Render + Pages auto-deploy on `git push origin main`. No manual steps.

To refresh R2 assets after editing PNG/JPG:
```bash
cd frontend && npm run r2:sync
```
Existing keys are overwritten — Cloudflare caches for 1 h by default; either wait or purge the bucket cache in the dashboard.

### Rollback

- **Pages:** Workers & Pages → project → **Deployments** → previous deployment → **Rollback to this deployment**.
- **Render:** service → **Events** tab → click any prior deploy → **Rollback**.
- **R2 assets:** no built-in versioning on the free tier; keep the canonical PNG/JPG in git under `frontend/src/assets/textbook-assets/` so a re-sync recreates the working set.

### Cold-start caveat

Render free tier spins the dyno down after 15 min of zero traffic. First request after sleep:
- `GET /health` → ~50 s
- `POST /api/story/stream` → adds normal Doubao latency on top

A simple cron-style ping every 10 min would defeat the free tier's purpose; for a 2-user pilot the cold start is acceptable. Upgrade to Render's $7/mo Starter plan to keep the dyno always-on.

### Where to lock down later

- Set `CORS_ALLOW_ORIGINS` on Render to the exact Pages URL once a custom domain is wired.
- Restrict R2 bucket public access to specific paths via Worker proxy if asset hotlinking becomes a concern.
- Move `ARK_API_KEY` from Render env to Cloudflare Secrets Store + Worker proxy once the backend is rewritten in TS (Option B from the original plan) — keeps the key off Render entirely.


---

## 20. Production deployment — pilot is live (v1.0)

> **Status: shipped.** Cloudflare Pages serves the Vue SPA + static textbook assets; Render Free serves the FastAPI backend. R2 was provisioned but is **not in the request path** — the team simplified the architecture mid-deploy.

### 20.1 Final architecture (what shipped vs. what was originally planned)

```
                                ┌──────────────────────────┐
       Browser  ────────────►   │  Cloudflare Pages         │
                                │  *.pages.dev              │
                                │  (project in ShadowsKuming │
                                │   or kevinalyst account)   │
                                │                           │
                                │  • Vue 3 SPA              │
                                │  • Static textbook-assets │  ← key change
                                │    (served from /public/) │
                                └────────────┬──────────────┘
                                             │  fetch(API_BASE/...)
                                             ▼
                                ┌──────────────────────────┐
                                │  Render Free (Oregon)     │
                                │  artbloom-api.onrender.com│
                                │                           │
                                │  • FastAPI / uvicorn      │
                                │  • Volcengine Ark proxy   │
                                │  • edge-tts               │
                                │  • LKP loader             │
                                │  • Sleeps after 15min idle│
                                └───────────────────────────┘

      Cloudflare R2  ❌  unused — bucket still exists but no traffic
      pub-f7d0ce9b…r2.dev   (kept as cold backup; safe to delete)
```

| Component | Plan (KB §19) | Actual (shipped) |
|---|---|---|
| Frontend host | Cloudflare Pages | ✅ Cloudflare Pages |
| Backend host | Render Free Blueprint | ✅ Render Free (Oregon, plan=free, autoDeploy=on push) |
| Textbook assets | Cloudflare R2 via runtime URL rewriting | ❌ **Moved to `frontend/public/textbook-assets/`** — served by Pages |
| Runtime URL rewriter (`rewriteAssetUrls`) | Module-load transform | ❌ **Removed** in commit `1bacb41` |
| `VITE_ASSETS_BASE` env var | Required | ❌ Removed — no longer needed |
| Backend `TEXTBOOK_ASSETS_URL` toggle | R2 prod / StaticFiles dev | Still in code; defaults to local StaticFiles |
| Saved-project URL migration | Not needed | ✅ Added in `b2a397e` — strips `http://localhost:8001/` prefixes |
| Lesson JSON ↔ frontend sync | `npm run sync-lessons` (prebuild) | ✅ Same — wired as `prebuild` in `package.json` |

### 20.2 Why the team pivoted away from R2 (mid-deploy decision)

The original §19 plan had:
1. Upload `textbook-assets/*` to R2 → `pub-f7d0ce9b…r2.dev`.
2. Frontend module-load hook (`rewriteAssetUrls` in `data/lessons/index.ts`) swaps every `http://localhost:8001/textbook-assets/…` URL inside lesson JSON to the R2 public URL.

This worked, but had four cost-of-complexity issues that emerged once the Pages deploy was live:

| Issue | Symptom | Pivot solution |
|---|---|---|
| **Cross-origin asset fetches** | R2's `*.r2.dev` is a separate origin → preflight CORS for non-GET requests (e.g. fetching audio blob to feed `MediaSource`); occasional cache-miss waterfalls | Co-locate assets on Pages → same origin → zero CORS, browser caches share session |
| **URL rewriting was a runtime side-effect** | `rewriteAssetUrls` mutated module-scope `LESSONS` object on import → if Pages env var was wrong/missing, app silently shipped broken URLs | Move assets to `public/`, ship root-relative URLs in JSON → no env var means no failure mode |
| **Two egress allowances to monitor** | R2 free is 10 GB/mo egress; Pages free is unlimited bandwidth → single-account-on-Pages = single quota | Single source of truth: Pages unlimited |
| **Saved-project snapshots had absolute URLs** | Projects saved during dev had `http://localhost:8001/textbook-assets/p1-s1-cover.png` literally embedded in slide elements → broke in prod | `projects.ts` migration on store init replaces any `http://localhost:8001/` prefix with `/` |

**Net effect:** Pages bundle is ~50–80 MB larger (the textbook PNGs/JPGs), but Cloudflare's edge cache + Pages' build artefact storage is unlimited on Free tier, so this is a non-cost. **R2 bucket stays as cold backup**; can be safely deleted, or kept for the day a single lesson asset exceeds Pages' 25 MB per-file limit.

### 20.3 Cross-account collaboration friction (and how it got resolved)

Recap of what happened (KB §19 didn't anticipate this):

1. **Domain & R2 on `kevinalyst` Cloudflare account.** Repo `ShadowsKuming/art_edu` on GitHub. Kevin and Shadows are different humans collaborating.
2. **Cloudflare Pages GitHub App scoping**: when Kevin logged in to his Cloudflare account, the Pages "Connect to Git" repo picker only listed repos owned by `kevinalyst`. `ShadowsKuming/art_edu` was invisible because the App can't see collaborator-only repos through someone else's installation.
3. **Failed workaround 1** — Try to install the App as `ShadowsKuming` from kevin's Cloudflare → uncaught error *"Could not find selected Git installation"* (the GitHub-account dropdown was empty because the App handshake didn't fully register).
4. **Failed workaround 2** — Try Cloudflare's "Add a site" zone-transfer flow → would have moved DNS from kevin's account to shadows', destroying R2 custom domain potential. Aborted.
5. **What shipped**: ShadowsKuming deployed the Pages project from **his own** Cloudflare account, against the repo he owns. Kevin owns the domain and R2. The fully-resolved cross-account dance is parked until a custom domain is wired up. For now the pilot runs on `*.pages.dev` (no custom domain).

**Lesson learned for future projects with shared GitHub repos:** decide where Pages will live *before* setting up the GitHub repo, ideally with the Pages-account holder owning the repo. If not possible, plan for one of:
- **Cloudflare account membership** — invite the other person to your CF account.
- **Direct Upload via wrangler** — skip GitHub integration entirely.
- **Fork the repo** to the same GitHub account that owns Pages.

### 20.4 Deployment commit timeline

```
69389d4  downsizing five assets                          (Shadows; perf polish)
b2a397e  fix(migration): strip legacy localhost:8001     ← saved-project URL fix
1bacb41  fix(assets): remove runtime URL rewriting       ← R2 → public/ pivot
1286ada  change the path                                 (Shadows; path fix)
47bd6d3  frontend                                        (Shadows; CF Pages deploy)
5b7cd20  update chatbot history                          (chatbot store extracted)
24c6f15  api update
010417e  deployment                                       ← Render backend live
fb7e8d8  Update README.md
6db7c70  Merge branch 'main'
cd49c0f  some update update
─────────────────────────────────────────────────────────────────
2c7329c  Revert Alibaba ECS                              ← previous KB §19 head
7091b8f  docs(kb): §19 — production deployment runbook
```

Eleven commits from "infra in place" to "pilot is live", mostly across May 25–26 2026.

### 20.5 New plumbing introduced post-§19

| Surface | What changed | Why it matters |
|---|---|---|
| `frontend/src/stores/chatbot.ts` | **New** dedicated Pinia store for chatbot history (`messages[]`, `setMessages`, `push`) | Decouples chat from `slides`/`projects` so save/restore works without crowding the project snapshot schema |
| `frontend/src/stores/projects.ts` | URL migration on store init (commit `b2a397e`) | Old projects render in prod without manual user action |
| `frontend/src/data/lessons/index.ts` | `rewriteAssetUrls` removed (commit `1bacb41`); typed `LessonSeedData` cast retained | Smaller, safer; one fewer module-load side-effect |
| `frontend/.env.example` | `VITE_ASSETS_BASE` removed; only `VITE_API_BASE` documented | Reflects single env-var contract |
| `frontend/public/textbook-assets/` | New directory; mirrors the canonical `src/assets/textbook-assets/` shape but is what Vite/Pages actually serves | Drop a new asset here AND in the LKP JSON → it ships |
| `frontend/public/textbook-assets/G2V2-U4-L4/design/p*.png` | 5 new "design reference" PNGs (cover, paper-roll, caterpillar, landscape, playground) | Slide-template hero imagery for the Hairy Pose lesson |
| `backend/main.py` | Minor tweak in commit `010417e` to align with Render's `$PORT` and CORS env-var defaults | Already pre-baked from §19 but verified live |
| `package.json` (frontend) | `r2:sync` script retained but **unused in shipping path** | Kept for the day assets exceed Pages limits |

### 20.6 Production URLs & env-var contract

```
Backend (Render)
   URL:        https://artbloom-api.onrender.com
   Health:     https://artbloom-api.onrender.com/health
   Region:     Oregon
   Plan:       Free  (sleeps after 15 min idle, ~50 s cold start)
   Env vars:   ARK_API_KEY              <pasted in Render dashboard>
               CORS_ALLOW_ORIGINS        *
               (TEXTBOOK_ASSETS_URL — set but ignored; assets served from Pages)
   Auto-deploy: enabled on push to main

Frontend (Cloudflare Pages)
   URL:        https://<project-slug>.pages.dev   (project in ShadowsKuming or kevinalyst CF account)
   Build:      cd frontend && npm ci && npm run build
   Output:     frontend/dist
   Env vars:   VITE_API_BASE     https://artbloom-api.onrender.com
               NODE_VERSION      20
   Auto-deploy: enabled on push to main

Assets (Cloudflare Pages — same origin as frontend)
   Path:       /textbook-assets/G2V2-U4-L4/...
   Source:     frontend/public/textbook-assets/

Cloudflare R2 (provisioned but unused)
   Bucket:     artbloom-textbook-assets
   Public URL: https://pub-f7d0ce9b502b4622869a73beb2084a84.r2.dev
   Status:     cold backup; safe to delete
   Cost:       $0 (well under free-tier limits with zero traffic)

DNS zone (kevin's CF account)
   Domain:     artbloomedu.com
   Pages:      not yet attached — pending cross-account resolution
   R2:         not yet attached — would only matter if R2 comes back into use
```

### 20.7 Known limitations / "find out it's broken" cheat-sheet

1. **Render cold start (~50 s):** first request to a sleeping `artbloom-api` blocks the UI. Mitigations available, none implemented for the pilot:
   - Free uptime monitor (UptimeRobot / Cron-job.org) pinging `/health` every 10 min.
   - Render Starter plan ($7/mo) — service stays warm.
   - Spinner / "warming up" message in frontend during first AI call.

2. **No custom domain.** Until `artbloomedu.com` is wired up: pilot uses `*.pages.dev` + `*.onrender.com`. Custom domain decision parked (see §20.3).

3. **Single lesson live.** Only `g2v2-u4-l4` is in `LESSON_REGISTRY`. To add a lesson:
   1. Add LKP JSON to `backend/data/lessons/<id>.json`
   2. Drop assets under `frontend/public/textbook-assets/<UPPER_ID>/`
   3. Add `import x from './x.json'` + entry in `LESSON_REGISTRY` in `frontend/src/data/lessons/index.ts`
   4. Commit → Render + Pages both auto-deploy

4. **Bilingual content drift risk.** EN/中 strings live in `frontend/src/i18n/{en,zh}.ts`; LKP JSONs have their own `{ zh, en }` content fields. Renaming a key requires updating both surfaces. No CI enforcement.

5. **localStorage migration is permanent.** The `projects.ts` localhost-URL stripper runs on every store init. Could be retired in ~3 months once we're confident no pilot teacher still has pre-deploy snapshots.

6. **Cloudflare Pages 25 MB per-file limit.** Currently safe (largest asset ~3 MB). If a single asset exceeds this — most likely a high-res masterpiece scan — switch to R2 for *that one file* and override the URL inline in the LKP JSON.

7. **Render free's 750 hrs/mo cap.** With auto-sleep enabled, this is comfortable for a 2-user pilot. If user count grows, the second always-on service would push past the limit.

### 20.8 Open items (post-pilot follow-ups)

- [ ] Add custom domain `artbloomedu.com` to Pages (requires cross-account decision per §20.3; account-membership invite is the cleanest path).
- [ ] Wire `api.artbloomedu.com` CNAME to Render service once custom domain lands.
- [ ] Add UptimeRobot ping for `/health` to keep backend warm.
- [ ] Decide whether to delete the unused R2 bucket or keep as cold backup.
- [ ] Onboard remaining 24 lessons (LKP JSON authoring is the bottleneck, not code).
- [ ] Tighten `CORS_ALLOW_ORIGINS` from `*` to the actual Pages domain once a custom domain is locked in.
- [ ] Decide on a TTS migration story (current `edge-tts` is free but unofficial Microsoft endpoint; Volcengine TTS keys are already in `.env.example`).
