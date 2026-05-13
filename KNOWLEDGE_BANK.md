# ArtBloom — Project Knowledge Bank

> Generated knowledge dump for the **ArtBloom** (`art_edu`) repository.
> Repo: https://github.com/ShadowsKuming/art_edu
> Local path: `/Users/kevinlee/Downloads/art_edu`
> Latest commit at time of writing: `3162456` (Update .env.example)
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
