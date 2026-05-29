# ArtBloom — Project Knowledge Bank

> Generated knowledge dump for the **ArtBloom** (`art_edu`) repository.
> Repo: https://github.com/ShadowsKuming/art_edu
> Local path: `/Users/kevinlee/Downloads/art_edu`
> Latest commit at time of writing: `3162456` (Update .env.example)
> Last in-session update: 2026-05-28 (Contact form bugfix —
> fieldset+grid rendering bug caused inputs to disappear on the
> homepage; rewritten with plain div containers + simplified to
> single Name field per pilot spec).

---

## Bugfix log

### 2026-05-28 — Homepage "Contact Us" form inputs were invisible

**Symptom.** The right column of the `#contact` section on the homepage
rendered as an empty area: the heading + banner row showed correctly,
but the form (name / email / phone / message / send) was completely
missing. Left column ("How We Can Help" + email/WeChat card) rendered
fine.

**Root cause.** `frontend/src/components/home/ContactForm.vue` wrapped
each row of inputs in a `<fieldset>` element and then applied
`display: grid` (`.contact-form__fieldset--row`) or `display: flex`
(`.contact-form__fieldset`) to that fieldset. `<fieldset>` historically
forces its anonymous content box to `display: block` in Chrome/Safari
regardless of the author's `display` declaration — applying `grid` to
the fieldset itself silently collapses the row layout and, combined
with the second column using an `sr-only` label, made the inputs
render with zero effective height in our pages.

**Fix.** Replaced every `<fieldset>` in `ContactForm.vue` with a plain
`<div>` container; the email/phone two-column row now uses
`.contact-form__row { display: grid; grid-template-columns: 1fr 1fr }`
on a `<div>`, which honours grid layout correctly. Each input still
has its own `<label for="">` so accessibility semantics are preserved.

While there, the form was also simplified per the pilot Figma:
- Single 姓名 / Name field (the previous First + Last split was a
  Figma-template carryover that wasn't used on the Chinese site).
- Send button label shortened from "发送消息" → "发送" (and
  "Send Message" → "Send" in English) to match the spec.
- Added `messagePlaceholder` and `namePlaceholder` i18n keys in
  both `frontend/src/i18n/zh.ts` and `frontend/src/i18n/en.ts`.
- Legacy `firstNamePlaceholder` / `lastNamePlaceholder` keys are
  kept in both i18n files (commented as "legacy") so any
  half-stale import doesn't trigger a missing-key warning.

**Files touched.**
- `frontend/src/components/home/ContactForm.vue`
- `frontend/src/i18n/zh.ts` (`home.contact.form.*`)
- `frontend/src/i18n/en.ts` (`home.contact.form.*`)

Verified with `npx vue-tsc --noEmit` (clean) and `npx vite build`
(~530ms, no errors).

---

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

---

## 21. Part 3 story prompt v3 + TTS segment picker (2026-05-27)

> Source: discussion thread reviewing the Part 3 "故事预览" output against
> the教材/教参 (teacher's edition) knowledge encoded in the LKP. Three
> teacher-facing issues raised; all three landed in the `5.27update*`
> commit train (`a178b68` … `4c5d9b2`).

### 21.1 What teachers said was wrong

| # | Pilot teacher feedback (paraphrased) | Where it manifested |
|---|---|---|
| **Q1** | "第三部分: 故事后半段" reads much shorter than "第一部分: 故事前半段" — pace breaks during read-aloud. | `STORY_USER` prompt only said *"2-3 paragraphs"* for `part3` while `part1` was free-form. Models defaulted to a 90-110 字 tail vs. a 200-字 opener. |
| **Q2** | Story is generic — could be about any landscape painting; teacher can't see the lesson's unit big idea / learning objectives / key art concepts surfacing. | `STORY_SYSTEM` only got the artwork image + a thin English role description. The LKP fields (`unit_big_idea_zh`, `learning_objectives.{know,understand,do}`, `key_art_concepts`, `teaching_focus_zh`, `teaching_difficulty_zh`, per-artwork `visual_description_zh` / `teacher_guide_notes_zh` / `story_hint_zh`) existed in the JSON but weren't being threaded into the system prompt. |
| **Q3** | "音效设计" panel's TTS only ever reads `part1`; teachers can't preview-read the post-choice continuation aloud. | The TTS `read` button hard-coded `storyData.part1` as the text source; `part3` was unreachable. |

### 21.2 Q1 — Word-count alignment (180-200 字 for both halves)

**Shipped in:** `backend/main.py` → `_story_user_text(language)`
(rewrite landed in `a178b68` / `5.27update2`).

The ZH prompt now carries **hard structural rules** in a `[故事正文生成要求]` block, separated into three sub-blocks:

- **`【part1 · 开篇, 3-4 段】`**
  - "字数: 严格 180-200 个中文字 (不含标点). 低于 170 或超过 210 视为不合格."
  - Must include ≥ 2 visual keywords from `[本画作] 画面描述`.
  - Must enact the verb in `[学习任务]` (e.g. 「依形创编」 → 先呈现一个长形的具体物, 再由形状引出联想).
  - 7-8 岁口语化; **must not** name teaching concepts directly (「夸张」「联想」「构图」 must be *felt*, not stated).

- **`【choices · 3 个分支】`**
  - `label` 4-10 字; `desc` ≤ 30 字.
  - Three branches must map to **three different** facets of `[关键艺术概念]` (e.g. composition / main-subject details / 联想 / 夸张). The prompt explicitly forbids parallel plot directions ("往左走 / 往右走 / 往前走").
  - "每条分支应当让备课老师一眼识别出它对应哪个艺术概念."

- **`【part3 · 后半段, 2-3 段, 承接 choice 0】`**
  - "字数: 严格 180-200 个中文字 (不含标点). **必须与 part1 字数对齐**, 低于 170 或超过 210 视为不合格."
  - Same imaginative tone + sensory richness as part1.
  - Ending **must** loop back to the 能做 (do) tier of `[学习目标]` — so the story has **pedagogical closure**, not just narrative closure.
  - Forbids fourth-wall breaks ("同学们", "小朋友们").

The English path mirrors the structure at ~120-150 English words with the same hard constraints. `STORY_SYSTEM` stays English (vendor fine-tuning is English-biased) but `_story_user_text` is fully language-aware so the model gets pulled into the right output language by the immediately-preceding user turn.

**Side-effect:** `_story_payload` had to bump `max_tokens` `2000 → 3500`. Combined budget for part1 (180-200 字 ≈ 300-400 tokens) + choices (~120 tokens) + part3 (180-200 字 ≈ 300-400 tokens) + designRationale (330-360 字 ≈ 550-700 tokens) + JSON keys/punctuation (~150 tokens) + reasoning headroom = ~1400-1800 content tokens; 3500 gives ~2× headroom. Before the bump, the model occasionally truncated mid-`designRationale` string and the frontend `JSON.parse` blew up with *"Unexpected end of JSON input"*.

### 21.3 Q2 — Curriculum grounding (LKP fields → system prompt)

**Shipped in:** `_build_story_lesson_context(req)` in `backend/main.py` +
`_design_rationale_spec(language)`. The story `payload.system` is now:

```python
system = (
    STORY_SYSTEM
    + _build_story_lesson_context(req)   # ← [本课信息] block
    + _design_rationale_spec(language)   # ← 5-段 spec for designRationale field
    + _lang_suffix(req.language)         # ← ZH/EN value-language directive
)
```

`_build_story_lesson_context` walks `LessonContextManager.build_executor_b_context(lesson_id, artwork_id)` and emits a `[本课信息]` block containing every curriculum field the LKP team encoded:

| Prompt line | LKP source field | Why the model needs it |
|---|---|---|
| `课程: 《<lesson_title_zh>》` | `lesson_title_zh` | Frames the writing voice for primary-school art class. |
| `单元大概念: …` | `unit_big_idea_zh` | The 5-段 designRationale must **directly cite** this string. |
| `学习任务: …` | `learning_task_zh` | The opening of `part1` must enact this task's verb. |
| `[学习目标] - 知道 / - 理解 / - 能做` | `learning_objectives.{know, understand, do}` | Each tier must be anchored by a concrete plot moment; `part3` ending must close on the 能做 action. |
| `[教学重点] …` | `teaching_focus_zh` | designRationale §3 must explicitly map to it. |
| `[教学难点] …` | `teaching_difficulty_zh` | designRationale §3 must describe which scene helps overcome it. |
| `[关键艺术概念] A、B、C` | `key_art_concepts[]` | The 3 choices must each foreground a different concept. |
| `[评价标准] - …` | `assessment_criteria[]` | (Available but not heavily used by the story prompt — leveraged by Part 7's commenter prompt.) |
| `[本画作] 《…》 / 画面描述 / 教参解读 / 故事方向提示` | `textbook_artworks[<id>].executor_b_per_artwork.{visual_description_zh, teacher_guide_notes_zh, story_hint_zh}` | The model must include ≥ 2 visual keywords from `visual_description` literally in `part1`. `teacher_guide_notes` and `story_hint` give the writing room to land on the curriculum's preferred reading of the artwork. |

This is what fixes the "stories feel generic" complaint — the model can no longer write a free-floating landscape vignette, because half its system prompt is now the actual lesson's pedagogy.

#### 21.3.1 The 5-段 `designRationale` spec (curriculum-anchored)

`_design_rationale_spec("zh")` ports the curriculum team's verbatim spec into the prompt. The `designRationale` field is no longer free-form — it must produce **330-360 中文字 (320-380 hard range), 5 paragraphs separated by `\n\n`**, with this exact structure:

| 段 | 字数 | Content |
|---|---|---|
| 1 | ~60 | 与"单元大概念"和"学习任务"的对应 — must *directly quote* keywords from those LKP fields. |
| 2 | ~100 | Three-tier 学习目标 ("知道" / "理解" / "能做") — each tier must be anchored by a **concrete plot moment** (情节锚点), not a generic gesture. |
| 3 | ~100 | (a) `教学重点` keywords (b) the scene that **breaks** `教学难点` (c) each `关键艺术概念` at least once with the detail it lives in. |
| 4 | ~60 | What each of the 3 `choices` foregrounds pedagogically — so the teacher can pick a branch by the room's energy. |
| 5 | **strict 25-35 字** | One-line invitation to the teacher to keep iterating, with a **specific** follow-up question example (must reference a design choice from §1-4, not "do you want a different story?"). Uses 「我」 (AI) and 「您」 (teacher). |

Banned vocabulary (across all 5 段): 「通过」「旨在」「有助于」「能够」 — replaced with concrete verbs like 「将…转化为」「锚定在」「借助…场景呈现」. Markdown is forbidden (no headers, no bullets, no bold). The English code path keeps the legacy "2-3 sentences" requirement (`_design_rationale_spec` returns `""`) because the pilot ships in Chinese; the English mode is for screenshots/demos.

> One-shot success rate: ~75% (the model occasionally drifts to 290-320 字, which we accept rather than spending a second LLM call on polishing — that would double Part 3 latency).

### 21.4 Q3 — TTS segment picker (part1 vs part3)

**Shipped in:** `frontend/src/components/workspace/part3/Part3StoryPanel.vue`
(commit `d8739d1` / `5.27update3`, +284 lines in that file).

UI change in the "音效设计" panel:

```
   故事朗读                     [当前段落]
   ─────────────────         ┌──────────────┐
                              │ 第一部分 ●  │  ← single-select pill row
                              │ 第三部分     │
                              └──────────────┘
   [声音类型] [▶ 播放] [⏸ 暂停] [⏹ 停止]
```

Implementation details:

```ts
type TtsSegment = 'part1' | 'part3'
const selectedSegment = ref<TtsSegment>('part1')

// part3 has a fallback ladder: live continuation → choice-0 default
const part3Text = computed(() => {
  const pair = store.activePair
  if (!pair) return ''
  return store.activeContinuation
      ?? pair.generatedContinuations?.[0]
      ?? ''
})

const ttsReadText = computed(() => {
  const sd = store.storyData
  if (!sd) return ''
  if (selectedSegment.value === 'part3') return part3Text.value
  return sd.part1
})

// Stop any in-flight audio when the user toggles segments so
// the UI never shows "playing" against the wrong text.
watch(selectedSegment, () => { ttsStop() })

// Disable Play + show a hint when part3 isn't generated yet
const part3NotReady = computed(() =>
  selectedSegment.value === 'part3' && !part3Text.value.trim()
)
```

Notes / decisions:

- **Part 2 (互动选项) is intentionally not in the picker.** Choices are UI affordance, not narrative content — reading "选项1: 跟着溪水走" out loud during a classroom recap is awkward.
- **Sensible default for part3 text** — when no branch has been clicked yet, `activeContinuation` is `null` but the original story payload always pre-fills choice-0's continuation in `generatedContinuations[0]`. So a teacher who jumps straight from the cover to the audio panel can still hear the post-choice half.
- **Both TTS backends respect the segment.** `edge-tts` (primary, via `POST /api/tts`) and `window.speechSynthesis` (fallback when the datacenter IP is rate-limited by Microsoft) both read whatever `ttsReadText.value` resolves to.
- **i18n keys** added in `frontend/src/i18n/{en,zh}.ts`:
  `part3.storyPanel.ttsSegmentLabel`, `…ttsSegmentPart1`, `…ttsSegmentPart3`.

### 21.5 Acceptance check (how to verify this in the running app)

1. Open `/create-lesson` → pick **G2V2-U4-L4 《好长好长……》** from the dashboard.
2. Navigate to **Part 3**. Trigger story generation (the painting will be the LKP default `art01-taohuayuan1`).
3. In "故事预览" — confirm both **part1** and **part3** read ~180-200 字 and feel paced the same.
4. In `designRationale` — confirm 5 paragraphs separated by blank lines; §1 quotes the unit big idea **literally** (look for 「童话故事 / 想象 / 长形」-style strings drawn from `unit_big_idea_zh`).
5. In "音效设计" — toggle the pill row between **第一部分** / **第三部分**, hit **▶ 播放** for each. The audio content should match the visible text in "故事预览" for that segment. Toggle mid-playback → audio cuts cleanly to the new segment on the next Play press.
6. (Backend-only) Hit `POST /api/story/generate` with `{lesson_id: 'g2v2-u4-l4'}` and **without** it — the no-lesson_id response will read as generic storybook prose; the with-lesson_id response should reference 「桃花林」「溪水」「依形创编」-style keywords from the LKP.

### 21.6 Open work after this pass

- [ ] The 字数 hard rules are enforced **only in the prompt**; we don't post-validate. If Doubao drifts (especially over the part3 180-200 band), the only fallback is regenerate. A `validate_story_length(payload)` helper that flags drift in the streamed JSON would let the UI show "the model wrote a 145-字 ending — regenerate?" without a server round-trip.
- [ ] designRationale §5's "specific follow-up question" sometimes regresses to a generic prompt ("您想换一个画风吗?"). Consider adding a 1-shot example pair inside the spec to anchor the format.
- [ ] TTS segment picker is currently part1/part3 only. If a teacher generates **multiple** branch continuations (clicks choice-0, then choice-1, etc.), only the last one is reachable through the picker. A "branch dropdown" inside the part3 pill would surface them all — deferred until the pilot teachers ask.
- [ ] Per-artwork `story_hint_zh` is wired but the curriculum team has only filled it for 2/3 artworks per lesson. The third falls back to the generic visual description.

---

## §22 — vue-i18n `@` escaping in homepage Contact section (2026-05)

### 22.1 Symptom

On the deployed homepage (`/` → "联系我们"), only the **"我们能帮你什么"** card rendered. The right-hand `ContactForm` (姓名 / 邮箱 / 手机 / 信息 / 发送) **and** the email + WeChat `ContactInfoCard` were missing. The Chrome DevTools console showed repeated:

```
SyntaxError: Invalid linked format
  at El (logo-mark-…js:1:96764)
  at d  (…js:2:951)
  at Ce (…js:2:6665)
  at we (…js:2:6828)
  at Object.Te [as nextToken] (…js:2:7370)
  …
  at Object.v [as parse] (…js:2:11638)
  at au (…js:3:549)
```

Locally (`npm run dev`) everything rendered fine.

### 22.2 Root cause

In `vue-i18n` v9+, the character `@` is reserved for the **linked-message** mini-syntax inside message strings:

- `@:foo.bar`        → inline another message by key
- `@.upper:foo.bar`  → linked + modifier
- `@@`               → literal `@`

The tokenizer expects one of `:`, `.`, or `@` immediately after `@`. Our zh/en message tables contained:

```ts
emailValue:        'machi2019uk@163.com',
emailPlaceholder:  '1234567890@163.com',
```

`@163.com` → after the `@`, `1` is invalid → `SyntaxError: Invalid linked format`.

**Why local ≠ prod:** the `vue-i18n.esm-bundler.js` runtime has two execution paths, one for `NODE_ENV !== 'production'` (only `warn()`s on bad formats and returns the original string) and one for production (`throw`s). The thrown error crashed `<ContactInfoCard>`'s setup, which (because Vue propagates child render errors to the parent) also prevented its sibling `<ContactForm>` from being committed in the same `<ContactSection>` render pass — hence "only the help card shows".

### 22.3 Fix

Escape `@` using vue-i18n's `{'@'}` literal interpolation. The rendered output is still `machi2019uk@163.com` so `mailto:` links + visible text are unchanged.

`frontend/src/i18n/zh.ts` and `frontend/src/i18n/en.ts`:

```ts
emailValue: "machi2019uk{'@'}163.com",
// …
emailPlaceholder: "1234567890{'@'}163.com",
```

See inline comments at those lines for the long-form rationale so future contributors don't "clean up" the escape thinking it's a stray template literal.

### 22.4 Reserved characters checklist — do NOT put these raw in i18n messages

| Char  | Meaning                                                | How to escape                 |
| ----- | ------------------------------------------------------ | ----------------------------- |
| `@`   | Linked-message marker (`@:`, `@.`, `@@`)               | `{'@'}` or `@@`               |
| `{ }` | Named/positional interpolation                         | `{'{'}` / `{'}'}`             |
| `\|`  | Plural form separator                                  | `{'|'}` (rarely needed)       |
| `$`   | Reserved for some formatters in legacy mode            | usually fine in v9 non-legacy |

Any time we add a message containing emails, prices (`$5.00`), JSON-ish text, or template-literal-looking placeholders, do a quick scan over `frontend/src/i18n/*.ts` for unescaped `@ { } |` characters before merging. The vue-i18n compiler error only fires in the production build, so missing it in PR review = broken homepage on the deployed site.

### 22.5 Acceptance check

1. `cd frontend && npm run build && npm run preview` → open the homepage.
2. Console: no `SyntaxError: Invalid linked format`.
3. "联系我们" shows three cards: 我们能帮你什么 / 邮箱+微信 / 表单（姓名 + 邮箱 + 手机 + 信息 + 发送）.
4. Click the email value — the mailto opens `machi2019uk@163.com`.
5. Toggle the language selector (中文 ↔ English) — both locales render correctly.


## 23. Story-chat clarify-button flow, scoped revisions, Part-5 video+slides, R2 user-state DB, AccessModal skip (2026-05-28)

A grab-bag of pilot polish landed in one push. Each subsection is self-contained — read whatever bit you're touching.

### 23.1 Story-chat Phase B → clarify chips (4 buttons)

**Problem.** When the teacher typed an *ambiguous* edit request in Part 3's
"与艺芽讨论修改" panel (e.g. `让故事更有想象力`, `太干了`, `能不能改改`),
Doubao would slip into MODE A free-form discussion and miss the chance to
ask which slice they wanted changed. The original prompt's MODE A
description specifically allowed "ambiguous suggestions", so the model
was technically obeying the contract — just the wrong one.

**Fix — `backend/main.py`.** Three layers in series:

1. **`_STORY_CHAT_PHASE_A` / `_STORY_CHAT_PHASE_B`** each got an
   explicit `[Phase X 优先级决策树 — 必须按顺序执行]` block at the top
   with Step 1 → Step 5:
   - Step 1: does the message contain *any* change-request verb? (long
     Chinese keyword list: 改 / 修改 / 调整 / 不太行 / 能不能 /
     让……更 / 再细腻 / 重新生成 …) — if no, fall through to MODE A.
   - Step 2: does it precisely identify which slice (part1 / choices /
     part3 / "重新生成")? — if no, Step 5 is the **only** allowed exit.
     Falling back to Step 4 (MODE A) is forbidden.
   - Step 5: emit `clarify_options` with the canonical fixed array
     and short single-sentence `reply`; everything else null/empty.

   Each Phase block ships with reverse-engineered 反例 / 正例 examples
   so the model has concrete cases to anchor on.

2. **`STORY_CHAT_SYSTEM`** universal MODE A description was tightened
   from "ambiguous suggestions" to "with NO change-request semantics",
   plus an explicit `⚠ Phase 决策树覆盖` line forcing the Phase tree to
   take precedence. MODE A is now reserved for pure information
   questions (`故事大概多长`, `为什么这样设计`).

3. **`/api/story/chat` server-side safety net.** Even with the
   tightened prompt, Doubao misbehaves ~5% of the time. After parsing
   the model's JSON, we run a pure-Python heuristic:
   - Phase B (`selected_choice_id != None`) AND
   - last user message contains a verb from `_EDIT_VERBS` AND
   - it doesn't contain any token from `_PART_HINTS`
     (`part1`, `前半`, `选项`, `分支`, `重新生成`, …) AND
   - the model returned neither `clarify_options` nor a `revised_story`
   → we **inject** the canonical 4-chip array + replace `reply` with
   "请问您想修改哪一部分呢?". Logs `[story_chat] safety-net
   clarification injected for ambiguous Phase-B edit request: <text>`
   so we can audit drift rate in pilot.

   The verb / part-hint lists are central — if pilot teachers find a
   new phrasing that slips through, grow the lists rather than
   rewriting the heuristic.

**Wire format.** `/api/story/chat` always returns 5 fields now —
`reply`, `revised_story`, `revised_continuations`, `clarify_options`,
`revision_scope`. Missing model output is normalised to `[]` / `{}` /
`null`, never `undefined`, so the frontend's type guards stay trivial.

### 23.2 `revision_scope` — show only the slice that changed

**Problem.** Even when the teacher pinned the request to "改故事前半段",
Doubao would happily re-write `designRationale` "to match the new
opening" — teachers found this jarring. Worse, the preview card
rendered all 4 sections regardless, making it impossible to tell what
the model actually touched.

**Fix.** Backend prompt now demands MODE B return a `revision_scope`
array, with these mappings hardwired:

| Button / free text                | scope                                          |
| --------------------------------- | ---------------------------------------------- |
| 改故事前半段 / part1 改写         | `["part1"]`                                     |
| 改三个互动选项文案 / choices 改写 | `["choices"]`                                   |
| 改当前分支的后半段 / part3 改写   | `["part3"]`                                     |
| 重新生成故事                      | `["part1","choices","part3","designRationale"]` |
| 同时改 part1 + choices            | `["part1","choices"]`                           |

**Critical**: `designRationale` is **only** in scope for the
"重新生成故事" path. Every other path must carry
`current_story.designRationale` verbatim. The Phase-B prompt repeats
this constraint twice.

Backend validation in `/api/story/chat`:

```python
SCOPE_ALLOWED = {"part1", "choices", "part3", "designRationale"}
revision_scope = [s for s in scope_raw
                  if isinstance(s, str) and s in SCOPE_ALLOWED]
# Dedup while preserving order.
```

Hallucinated values (e.g. `"title"`, `"rationale"`) silently drop —
they never make it to the UI.

Frontend (`stores/part3.ts` + `Part3StoryPanel.vue`):

- `DesignChatMessage` got `revisionScope?: string[]`.
- Helper `revisionHas(msg, key)` returns `true` when scope is missing
  or empty (legacy messages render all 4 sections — backwards
  compatible) OR the key is in scope.
- The preview card's 4 `<template v-if="revisionHas(...)">` blocks
  conditionally render section-by-section.

### 23.3 Part-5 — first slide is the video, the rest are blank canvases

**Pilot ask.** Teachers wanted to keep the Bilibili demo video AND add
their own blank canvas slides after it (lesson recap, follow-up notes
etc.) — Part 5 was previously single-page video-only.

**Architecture choice.** Rather than introduce a `slide.type` field
across the schema, the **first** Part-5 slide is *by convention* the
video slide. Subsequent slides are normal blank canvases edited via
`WorkspaceContent`, identical to Parts 1/2/4.

**`frontend/src/stores/slides.ts`**

- `navigateToPart(5)` auto-seeds a Part-5 slide if none exists (old
  projects + LKPs that didn't seed page-5 land here) AND clears
  `elements` / `background` / `bgColor` on the first Part-5 slide so
  any LKP-fallback-seeded text (e.g. "艺术实践·步骤提示" from
  `slide_framework[part_id=5]`) never reaches the sidebar thumbnail.
  This runtime normalisation skips the LKP JSON — the text is still
  available to AI prompts via the LKP, just no longer projected into
  the slide model.
- New computed `part5VideoSlideId` (first Part-5 slide id, or `null`)
  and helper `isPart5VideoSlide(slideId)`.

**`frontend/src/components/workspace/WorkspaceSidebar.vue`**

- `SLIDE_EDITOR_PARTS = new Set([1, 2, 4, 5])` (5 added).
- `canDelete(slide)` returns `false` for the video slide regardless
  of count, so its × button never renders.
- Video slide doesn't use `<SlideThumbnail>` — it gets a custom
  `.slide-video-cover` (soft-green field, centered ▶ icon, no text).
  This avoids leaking element text through the thumbnail forever.

**`frontend/src/views/CreateLesson.vue`** — Part 5 branch:

```vue
<template v-else-if="isPart5">
  <Part5Content v-if="slideStore.isPart5VideoSlide(slideStore.activeSlideId)" />
  <WorkspaceContent v-else />
  ...
</template>
```

Active slide is the video slide → render the existing `Part5Content`
video player; any other Part-5 slide → render the regular canvas
editor. Chatbot column unchanged.

### 23.4 Cloudflare R2 user-state "database"

**Why.** Pilot teachers cleared cache / refreshed / switched devices
and lost everything. Per-user persistence backed by R2 was the
agreed pilot-grade solution.

**Backend — `backend/main.py` § 10.**

- `boto3==1.35.74` added to `requirements.txt`, with a defensive
  import guard so the server still starts without the lib (endpoints
  return 503).
- Env vars (documented in `backend/.env.example`):
  - `R2_ENDPOINT_URL` (jurisdiction-neutral form
    `https://<account-id>.r2.cloudflarestorage.com`)
  - `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — R2 API token with
    "Object Read & Write" scoped to the bucket.
  - `R2_USER_STATE_BUCKET=artbloom-user-state`.
- Two endpoints:
  - `GET /api/state/{user_code}` → returns the JSON blob, or 204 on
    first login (NoSuchKey → empty), or 503 when env not set.
  - `PUT /api/state/{user_code}` → writes
    `user-state/{CODE}.json` and appends one line to
    `user-state/{CODE}.log.{YYYY-MM-DD}.jsonl` (read-modify-write per
    day; tens of KB / day / user).
- Invite-code regex: `^[A-Za-z0-9_-]{4,64}$`, upper-cased. Anything
  else → HTTP 400. Whitespace rejected (no phantom users from a
  trailing space).

**Frontend — new `frontend/src/stores/userState.ts`.**

- `activateUser(code)` on login or invite-code change: first
  synchronous `loadFromCache(code)` (paint instantly from
  `localStorage[artbloom-user-state-cache:<CODE>]`), then async
  `loadFromBackend(code)` (canonical R2 GET overwrites cache paint).
- `scheduleSave()` is debounced 1500 ms. `flushSave()` is the
  immediate variant for user-switch / unload.
- `collectPayload()` / `applyPayload()` snapshot every other store
  (`user`, `projects`, `chatbot`, `slides`, `part3`, `part5`, `part6`,
  `part7`) into one opaque dict keyed by Pinia id. Adding a new store
  later = one line in each helper.
- 503 from backend doesn't bubble — frontend `console.info`s and
  falls back to localStorage-only. Same path runs in local dev when
  R2 env isn't configured.

**Frontend — `frontend/src/App.vue` orchestration.**

- `watch(userStore.inviteCode, { immediate: true })` triggers
  `userStateStore.activateUser(code || null)` — covers login,
  refresh, code switch.
- ~15 `watchStore(getter, { deep: true })` calls hook into the major
  reactive refs (`slides`, `projects.projects`, `chatbot.histories`,
  `part3.pairs`, …) and bounce mutations through `scheduleSave()`.
- `window.addEventListener('beforeunload', flushOnUnload)` for
  best-effort sync save on tab close.

**Wire format.** PUT body is `{ payload: <opaque dict> }` so Pydantic
validation stays simple. Server-side stamps `updated_at` and
`schema_version` before writing.

### 23.5 AccessModal — invite code only on first device login

`SiteHeader.onAccess()` previously opened the modal **every** time the
"进入" pill was clicked. After fixing per-user persistence, this had
to align with the pilot spec "only the first login per device asks
for a code".

- `onAccess()` now checks `userStore.inviteCode.trim()`. Truthy →
  `router.push('/dashboard')` directly; falsy → open the modal.
- `onAccessSubmit(code)` now trims and rejects empty input (form
  `required` was already there; defending in depth blocks a phantom
  `user-state/.json`). Switched from the deprecated
  `setUsername(code || 'Guest')` to `setInviteCode(trimmed)` so the
  R2 object key is the actual code, not the literal string `"GUEST"`
  shared across users.
- To force the modal back (testing, device-switch, future logout):
  delete `localStorage['artbloom.user.inviteCode']` or call
  `userStore.signOut()`.

### 23.6 Misc UI

- "我的课件" 顶部统计卡片中文文案：`幻灯片总数` → `幻灯片总页数`
  (`frontend/src/i18n/zh.ts` `dashboard.stats.totalSlides`). EN
  unchanged (`'Total Slides'`).

### 23.7 Acceptance checks

1. `cd backend && python3 -c "import ast; ast.parse(open('main.py').read())"` → SYNTAX_OK.
2. `cd frontend && npm run build` → 0 errors. Bundle stays ~ 80 kB
   gzipped for `CreateLesson` after all 5 features.
3. Story chat Phase B: typing "让故事更有想象力" → assistant reply ≤ 1
   sentence + 4 green pill buttons. Clicking "改故事前半段" → preview
   card renders **only** "第一部分：故事前半段" with rewritten text;
   "设计理念" section absent.
4. Part 5: clicking "第五部分：创意示范" → centre = default video,
   sidebar shows a ▶-icon thumbnail (no text). Clicking `+` adds a
   blank canvas slide editable like Parts 1/2/4.
5. Refresh browser on `/workspace` → all stores rehydrate from R2 +
localStorage cache. No "[userState]" red errors in console when
R2 is configured.
6. "进入" pill clicked second time on same device → goes straight to
   dashboard, no modal.

---

## 2026-05-28 — Part 3 "与艺芽讨论修改" iteration

Three changes to the Design-Rationale tab's revision chat in
`Part3StoryPanel.vue`:

### 1. New `chatHint` copy (i18n only)

The example prompts under "与艺芽讨论修改" used to be generic ("把故事
修改得更贴近本课学习目标 / 让故事更有想象力"), which steered teachers
toward ambiguous requests like 「让故事更有趣」. The hint now maps 1:1
onto the two MODE-B targets available before a branch is picked
(part1 / choices), so teachers learn to write precise instructions:

> 可以说「把前半段故事修改得更贴近本课学习目标」，或「让三个互动选项
> 更有想象力」。

**Files:**
- `frontend/src/i18n/zh.ts` → `part3.storyPanel.chatHint`
- `frontend/src/i18n/en.ts` → `part3.storyPanel.chatHint` (matched
  EN copy: "make Part 1 better aligned with the learning goal" /
  "make the three choices more imaginative")

### 2. `designRationale` is no longer rewritten or shown in revisions

The "修改后的故事" preview card used to render the AI's regenerated
designRationale (often 240-260 chars) alongside the changed
part1/choices/part3, which (a) wasted tokens, (b) inflated chat
latency, and (c) made teachers nervous that the lesson rationale was
being silently rewritten. The contract is now:

- **Prompt:** `_STORY_CHAT_PHASE_B` and `STORY_CHAT_SYSTEM` in
  `backend/main.py` were rewritten to forbid `designRationale` from
  appearing in `revision_scope` *under any circumstances*, including
  the "重新生成故事" button. The model is now instructed to copy
  `current_story.designRationale` verbatim into
  `revised_story.designRationale` every turn.
- **Server safety net:** the `/api/story/chat` handler hard-strips
  `designRationale` from `revision_scope` after the JSON parse and
  also force-restores `revised_story.designRationale` from
  `req.current_story.designRationale`, so even a non-compliant model
  cannot smuggle in a rewrite.
- **Frontend:** removed the `<template v-if="revisionHas(msg,
  'designRationale')"> … </template>` block from
  `Part3StoryPanel.vue`. The "修改后的故事" card now only renders the
  3 user-targetable sections (Part 1 / Choices / Part 3) per the
  `revisionScope` array.
- **i18n:** the `chatRevisedDesign` key is kept in both locales but
  flagged `// legacy, no longer rendered` so historical chat data
  (resumed from saved projects) doesn't trigger missing-key warnings.

### 3. Instant client-side clarification for ambiguous edits

Pilot teachers reported the chat felt "very slow" when their message
was vague ("让故事更有想象力" etc.) — even though the canonical
response was just a fixed 4-chip clarification, Doubao still consumed
a full 5-8 s vision-LLM round-trip. We now short-circuit on the
client.

**Implementation** (`frontend/src/stores/part3.ts → sendDesignChat`):
two regexes mirror the backend's `_EDIT_VERBS` and `_PART_HINTS`
lists exactly. When the latest message matches `EDIT_INTENT_RE`
*and* misses `PART_TARGET_RE` *and* isn't itself one of the 4
canonical chip labels, we push:

1. The user's message verbatim.
2. A canned assistant message containing the same Chinese / English
   clarification question and the same 2- (Phase A) or 4-chip
   (Phase B) `clarifyOptions` array the backend would have returned.

No network request, no `designChatLoading` spinner — the chips
appear in <10 ms. Clicking a chip then sends the chip's verbatim
text to the backend, which goes straight into MODE B because the
chip labels contain part-target keywords.

The new `chatClarifyLocal` i18n key was added for completeness but
the store inlines the canned text directly (saves a `t()` lookup at
hot-path time; the i18n key is kept as documentation).

**Files touched:**
- `frontend/src/stores/part3.ts` — `EDIT_INTENT_RE`,
  `PART_TARGET_RE`, fast-path branch in `sendDesignChat`.
- `frontend/src/i18n/zh.ts` + `en.ts` — `chatClarifyLocal` (new),
  `chatRevisedDesign` (marked legacy).
- `frontend/src/components/workspace/part3/Part3StoryPanel.vue` —
  removed `designRationale` `<template>` from the revision card.
- `backend/main.py` — `_STORY_CHAT_PHASE_B`, `STORY_CHAT_SYSTEM`,
  server-side `SCOPE_RETURN` filter + force-restore of
  `revised_story.designRationale`.

**Verification.** `npx vue-tsc --noEmit` clean. `npx vite build`
clean (~577 ms). `python -c "import main"` from `backend/` succeeds.




## 24. Editable Part-6 prompts + Editable Part-3 story + cross-project leak fixes + cross-device autosave + Part-5 blank-project empty state + Part-6 prompt rewrites/labels (2026-05-29)

This is the largest single-day landing since the pilot shipped. It
addresses **eight pilot-feedback items** that all touch the same
"teacher needs to be able to fine-tune what the AI generated" theme,
plus four foundational stability bugs that surfaced as teachers
started building multi-project decks across devices.

### 24.1 — Part 6 prompt editing (right-side textarea, edit-in-place)

**What teachers asked for:** in addition to discussing with 艺芽,
they wanted to *directly type into* the "提示词预览" box and have
THAT text — not the model's default — be what gets sent to Doubao
Seedream i2i.

**Data flow added.** `Style` interface (`frontend/src/stores/part6.ts`)
gained a 3rd optional field:

```ts
export interface Style {
  label: string
  prompt: string             // EN, kept for back-compat
  promptZh?: string          // default ZH from backend
  promptZhEdited?: string    // ← NEW: teacher's textarea content
}
```

Resolution order in `convert()` now:
```
edited = (style.promptZhEdited ?? '').trim()
promptToSend = edited || style.promptZh || style.prompt
```

Doubao Seedream i2i accepts both ZH and EN, so sending the edited
ZH is correct. Backend `/api/part6/transfer` was **not changed** —
it just forwards `body.prompt` to the model.

**Store helpers.** Two new actions route every edit through Pinia so
the cross-device autosave watcher picks them up cleanly:
- `setPromptEdit(messageId, idx, text)` writes
  `msg.proposedStyles[idx].promptZhEdited`.
- `resetPromptEdit(messageId, idx)` clears it, snapping the textarea
  back to `promptZh`.

`confirmStyles()` was also tightened — it now **deep-copies** each
Style when committing to `styles.value`:
```ts
styles.value = msg.proposedStyles.map(s => ({ ...s }))
```
Pre-2026-05-29 it spread the same object references, which meant
post-confirm edits on `msg.proposedStyles[i].promptZhEdited` would
silently mutate the confirmed pigs. The deep-copy isolates them; to
sync a post-confirm edit, the panel exposes a "重新确认" pill
button that re-runs `confirmStyles(messageId)` for the same id.

**UI** (`Part6AssistancePanel.vue`): the read-only `<p>` paragraph
inside the 提示词预览 box became an autogrow `<textarea>` with the
same font/size/colour as before. Below it:
- 已编辑 badge appears when
  `promptZhEdited.trim() !== promptZh.trim()`.
- 重置为默认 link clears the edit.
- 应用修改 · 重新确认 button appears only when the message is the
  currently-confirmed one AND the message-level edit differs from
  the confirmed `styles[i].promptZhEdited` (computed by
  `needsReconfirm(msg)`).

**i18n.** Three new keys in `part6.bot`:
`previewEdited` / `previewReset` / `previewReconfirm` (both zh + en).

### 24.2 — Part 3 story editing (every section in 故事预览 is a textarea)

**What teachers asked for:** same edit-in-place affordance for the
story text. Part-1 paragraph, the three choice (label + desc)
chips, and the Part-3 continuation should all be directly editable
in 故事预览. After editing, the Sound-Design TTS must narrate the
edited text — not the AI's original.

**Architectural realisation.** TTS already reads from
`pair.storyData.part1` (for segment=part1) and
`pair.generatedContinuations[selectedChoiceId]` (for segment=part3)
— the **exact** same fields Story Preview displays. So if we make
Story Preview directly mutate those fields, the TTS picks up edits
for free. No separate sync, no shadow `*Edited` fields like Part 6
needed.

**Store helpers** (`frontend/src/stores/part3.ts`):
```ts
function setStoryPart1(text: string) {
  activePair.value.storyData.part1 = text
}
function setStoryChoice(id: number, field: 'label'|'desc', text: string) {
  activePair.value.storyData.choices.find(c => c.id === id)[field] = text
}
function setContinuation(choiceId: number, text: string) {
  activePair.value.generatedContinuations = {
    ...activePair.value.generatedContinuations,
    [choiceId]: text,
  }
}
```

Routing through helpers (rather than `v-model="storyData.part1"`
directly) ensures Pinia reactivity cleanly notifies the
`CreateLesson.vue` autosave watcher, which already deep-watches
`part3Store.pairs`.

**UI** (`Part3StoryPanel.vue`): four read-only surfaces became
editable:
1. Part-1 paragraph `<p>` → autogrow `<textarea class="sp-edit-textarea">`
2. Choice button `<button>` → `<div role="button">` with two inline
   `<input>` fields (label + desc). Branch-select click still fires
   on the row; clicks on the inputs are stopped (`@click.stop`) so
   they edit text. HTML doesn't allow form inputs inside `<button>`
   — this refactor was unavoidable.
3. Part-3 continuation `<p>` → another autogrow `<textarea>`,
   wired to `generatedContinuations[selectedChoiceId]`.
4. (designRationale stays read-only — it's not narrated and not part
   of the story's narrative content; pilot teachers told us they
   don't edit it.)

**Autogrow helper.** A tiny `autogrow(el)` function sets
`el.style.height = el.scrollHeight + 'px'` on every `input` event
and on every reactive change to the underlying field (so AI-applied
revisions and branch switches also re-fit). Cheaper than
`field-sizing: content` while supporting all 2026-era browsers.

**Visual language.** The textareas inherit `<p class="sp-text">`'s
font (13px / line-height 1.7 / colour #374151) and are borderless
by default. On hover a soft #e5e7eb border appears with a subtle
white-tint background; on focus the border turns #16a34a with a
small green box-shadow — same language as Part 6's prompt-preview
textarea. The choice inputs follow the same pattern but more
compact.

**i18n.** Four new keys in `part3.storyPanel`:
`editPlaceholderPart1` / `editPlaceholderPart3` /
`editPlaceholderChoiceLabel` / `editPlaceholderChoiceDesc`.

**AI / manual edit interplay.** Both routes mutate the same
`storyData` object:
- Manual edit → `setStoryPart1` → `storyData.part1 = newText`.
- AI revision → "应用此版本" → `applyRevisedStory()` does
  `storyData = JSON.parse(JSON.stringify(revisedStory))`.

So clicking "Apply" after editing overwrites the manual edit (which
is what the teacher just asked for by clicking the button). When the
chat sends `current_story` to the backend, it includes the manual
edits — so the AI sees what the teacher just wrote and can iterate
on top of it. Zero conflict.

### 24.3 — Cross-project leak fix (Part 6 sketch / styles / chat were sticky)

**Bug.** Teacher uploaded a sketch in《好长好长》, confirmed 3
styles, navigated back to MyLessons, opened《吸引人的标题》—
Part 6 still showed the《好长好长》sketch + styles + chat history.
Same leak observed in Part 3 (story state) and Part 7 (student
works) and Part 5 (custom video URL).

**Root cause.** Every project-switch entry point
(`MyLessons.resumeProject`, `Dashboard` startTeaching drawer,
`CreateLesson` onMounted, `Community` back-navigation,
`loadFromAPI` hydration) had its own scattered:
```ts
if (s.part6Snapshot) usePart6Store().loadSnapshot(s.part6Snapshot)
```
When the incoming project had no `part6Snapshot`, the `if` guard
skipped the call — leaving the old project's store intact.

**Fix.** Three new `reset()` actions:
- `usePart3Store().reset()` — clears `pairs` + `activePairId`.
- `usePart6Store().reset()` — clears sketch / styles / messages /
  confirmedMessageId / usedStyleIndices / view / latestResult /
  chatLoading / chatError / stylesError / conversionError. Rewinds
  `_msgIdSeq` to 1. `teacherPreviewMode` is intentionally NOT reset
  (it's a session-level UI preference, like locale).
- `usePart7Store().reset()` — clears pairs + activePairId.

Then **centralised the hydrate-or-reset logic in
`projects.ts → setActiveProject(id)`** so every caller gets the
correct behaviour for free:
```ts
if (s.part3Snapshot) part3.loadSnapshot(s.part3Snapshot)
else                 part3.reset()
if (s.part6Snapshot) part6.loadSnapshot(s.part6Snapshot)
else                 part6.reset()
if (s.part7Snapshot) part7.loadSnapshot(s.part7Snapshot)
else                 part7.reset()
if (s.part5CustomUrl) part5.setPastedUrl(s.part5CustomUrl)
else                  part5.clearCustom()
```
`createProject()` was also routed through `setActiveProject(id)`
(rather than assigning `activeProjectId.value = id` directly) so
the new "+新建课件" flow gets the same reset.

`clearLocal()` (sign-out) now also calls all four reset/clear
methods so the next user starting from a clean device doesn't see
the previous user's leftovers.

### 24.4 — Cross-device autosave (Part 6 styles weren't persisting)

**Bug.** Teacher confirmed 3 styles in Part 6, closed the tab
without ever switching parts or pressing Back. On another device,
the same account opened the same project — styles were missing.

**Root cause.** The pre-2026-05-29 autosave in `CreateLesson.vue`
was a single-source watch:
```ts
watch(() => slideStore.activePart, () => { saveCurrentProject(...) })
```
It only fired when `activePart` changed (Part 1 → Part 2 sidebar
click) or when the explicit Back button ran `goBack()`. Edits made
*inside* Part 6 (or Part 3 / Part 7 / Part 5) that didn't trigger
either event were never persisted.

**Fix** (`frontend/src/views/CreateLesson.vue`): replaced with a
16-source deep watch + 1.5 s debounce:
```ts
watch(
  [
    () => slideStore.activePart,
    () => slideStore.slides,
    () => part6Store.sketchDataUrl,
    () => part6Store.messages,
    () => part6Store.confirmedMessageId,
    () => part6Store.styles,
    () => part6Store.usedStyleIndices,
    () => part6Store.latestResult,
    () => part6Store.view,
    () => part6Store.teacherPreviewMode,
    () => part3Store.pairs,
    () => part3Store.activePairId,
    () => part7Store.pairs,
    () => part7Store.activePairId,
    () => part5Store.customUrl,
    () => part5Store.customSourceType,
  ],
  flushDebouncedSave,
  { deep: true },
)
```

`flushDebouncedSave` re-arms a 1500 ms `setTimeout` on every burst
of changes and calls `saveCurrentProject()` once when the burst
settles. Typical effect: confirming 3 styles fires three rapid
mutations in <50 ms; only one PUT goes out 1.5 s later.

**Hydration race guard.** `setActiveProject(id)` synchronously
mutates several stores when loading a project. Without protection,
those mutations would immediately trip the watcher and re-PUT the
just-loaded snapshot back to the server. So `projects.ts` now
exposes a `_isHydrating: ref<boolean>` flag that's set true at the
start of `setActiveProject` and cleared 200 ms later via
`setTimeout`. The watcher checks `if (projectsStore._isHydrating) return`
at the top of `flushDebouncedSave`.

Vue's default `watch` doesn't fire on creation, so the very first
hydration on `CreateLesson` mount doesn't need the flag — only
later `setActiveProject` calls (e.g. switching projects from
MyLessons → workspace) do. The 200 ms window is generous: the
actual mutations are flushed within the same microtask.

### 24.5 — Part 5 blank-project empty state (no more 好长好长 default)

**Bug.** Teacher clicks "新建课件" from MyLessons → opens new
empty project → Part 5 shows the《好长好长》Bilibili demo video.

**Root cause** (`Part5Content.vue`):
```ts
const defaultEmbedUrl = computed(() => {
  const lessonId = projectsStore.activeLessonId
  const bvid = (lessonId && LESSON_VIDEO_MAP[lessonId]) || DEFAULT_BVID
  //                                                       ^^^^^^^^^^^^
  // 'BV1VjVc6tEhK' = 好长好长. Fallback fires for blank projects.
  return buildBilibiliEmbed(bvid)
})
```

**Fix.**
```ts
const defaultEmbedUrl = computed(() => {
  const lessonId = projectsStore.activeLessonId
  if (!lessonId) return null                  // blank project
  const bvid = LESSON_VIDEO_MAP[lessonId]
  if (!bvid) return null                      // unknown lesson
  return buildBilibiliEmbed(bvid)
})
```

Template gains a third branch: when `defaultEmbedUrl === null &&
!customRender`, render a dashed-border `.p5-empty-state` with the
new `part5.upload.emptyHint` i18n string (and a generic video-camera
SVG icon). The "恢复默认视频" button is also hidden in this state —
no default to restore to.

`DEFAULT_BVID` constant + the import were deleted. The three pilot
lessons (g2v2-u4-l4 / g2v2-u4-l5 / g2v2-u5-l1) all map cleanly in
`LESSON_VIDEO_MAP` and keep their Bilibili clips.

### 24.6 — Part 6 prompt rewrites (round 3) + style names + descriptions

Three separate copy updates in the same Part 6 surface:

**24.6a — Image-gen prompt content** (per user-supplied docx).
Replaced all 9 `image_gen_prompt_template_zh` + `_en` strings
across 6 JSON files (3 lessons × backend + frontend). All new
prompts are between 227 and 308 Chinese characters (within
Doubao's 200-300 char sweet spot — long enough to carry every
visual rule, short enough that the model's attention doesn't dilute
in the prompt tail). Key strategies:

- L4 (《好长好长》): kept user's docx text verbatim — 241/241/272
  chars, already optimal.
- L5 (《吸引人的标题》): compressed from 301/364/422 → 227/254/271
  by collapsing the "5 example characters + 'don't add these
  characters' double declarations" into a single opening clause
  "识别画面中原有的汉字（不要替换或额外添加文字）".
- U5 (《听听画画》): compressed from 402/487/483 → 264/290/308 by
  trimming each emotion category's colour list from 4 → 3 names and
  deduplicating "形状服务情绪" / "笔触质感" mentions.

All numeric parameters (3-4x, 3-5mm / 0.5-1mm, 1/3 of canvas, 80%
saturation, i2i strength 0.78 / 0.75 / 0.75 / 0.78 / 0.75 / 0.78
/ 0.8 / 0.78 / 0.85) were preserved character-for-character. The
review document is checked in at the repo root:
`REVIEW_compressed_part6_prompts.md`.

**24.6b — Chip labels.** Curriculum team finalised the user-facing
chip labels:

| Lesson | Style 1 | Style 2 | Style 3 |
|---|---|---|---|
| g2v2-u4-l4 | 更长更夸张 | 背景更丰富 | 更整齐更规律 |
| g2v2-u4-l5 | 字形更随义 | 色彩更有情绪 | 更多画更有趣 |
| g2v2-u5-l1 | 节奏感更强 | 情绪更浓烈 | 形状更抽象 |

Updated `executor_d_styles.styles[i].style_name_zh` in all 6 JSON
files.

**24.6c — One-line descriptions.** The AI's recommendation message
contains "• {style_name}：{style_description}" bullets pulled from
`style_description_zh`. Each description was rewritten to reflect
the actual prompt content rather than the older paraphrases. E.g.

- L4 Style 1: "把孩子画里最突出的「长」元素夸张拉伸成蜿蜒曲线，
  让主体流动突破画面边界"
- L5 Style 3: "把字的部分笔画替换为与主题相关的装饰图形，让字
  既能识别又有插画感"
- U5 Style 3: "把具象形状大胆推向几何与曲线的抽象造型，借鉴
  康定斯基的音乐抽象画语言"

All three patches (24.6a/b/c) were applied via three Python scripts
in `/tmp/` (`patch_part6_v3.py`, `patch_part6_names.py`) that read
each JSON, write the new fields, and round-trip with
`ensure_ascii=False, indent=2` so diffs are clean. No `npm run
sync-lessons` is needed because the scripts touch both
`backend/data/lessons/` and `frontend/src/data/lessons/`
simultaneously.

### 24.7 — Part 3 design-chat UI tweak

Trivial but worth noting for changelog purposes:
- `chatHint` updated from "可以说「把故事修改得更贴近本课学习
  目标」，或「让故事更有想象力」" → "可以说「把前半段故事修改
  得更贴近本课学习目标」，或「让三个互动选项更有想象力」".
  Examples now map 1:1 onto the two MODE-B targets (Part 1 + the
  three choices), training teachers to write more precise prompts.
- 修改后的故事 card no longer renders the `designRationale`
  section (backend was already filtering it out of
  `revision_scope`; this is the matching frontend change).

### 24.8 — Files touched (this whole rollout)

**Backend** (zero functional changes; pure data updates):
- `backend/data/lessons/{g2v2-u4-l4,g2v2-u4-l5,g2v2-u5-l1}.json` —
  9 styles × prompt rewrites + 9 name/description rewrites.

**Frontend stores:**
- `frontend/src/stores/projects.ts` — `_isHydrating` ref, centralised
  hydrate-or-reset in `setActiveProject`, route `createProject` +
  `loadFromAPI` through it, `clearLocal` resets all stores.
- `frontend/src/stores/part3.ts` — `reset()`, `setStoryPart1`,
  `setStoryChoice`, `setContinuation`.
- `frontend/src/stores/part5.ts` — (no functional change; already
  had `clearCustom`).
- `frontend/src/stores/part6.ts` — `Style.promptZhEdited` field,
  `convert()` prompt-resolution priority, deep-copy in
  `confirmStyles`, `setPromptEdit` / `resetPromptEdit` / `reset()`.
- `frontend/src/stores/part7.ts` — `reset()`.

**Frontend views / components:**
- `frontend/src/views/CreateLesson.vue` — 16-source deep watch +
  1.5 s debounce + hydration-flag check.
- `frontend/src/views/MyLessons.vue` — `confirmCreate` now uses
  `setActiveProject` for the new project; no other changes.
- `frontend/src/components/workspace/part3/Part3StoryPanel.vue` —
  4 editable surfaces + autogrow + new CSS.
- `frontend/src/components/workspace/part5/Part5Content.vue` —
  `defaultEmbedUrl` null-when-unknown + empty-state branch +
  conditional "恢复默认视频" button.
- `frontend/src/components/workspace/part6/Part6AssistancePanel.vue` —
  textarea preview + "已编辑" badge + "重置" link + "重新确认" pill +
  store helpers `setPromptEdit` / `resetPromptEdit` /
  `reconfirmFromMessage` / `needsReconfirm`.

**Frontend data:**
- `frontend/src/data/lessons/{g2v2-u4-l4,g2v2-u4-l5,g2v2-u5-l1}.json` —
  mirror of backend updates (kept in sync via the scripts).

**i18n** (zh + en):
- `part6.bot.previewEdited` / `previewReset` / `previewReconfirm`
- `part5.upload.emptyHint`
- `part3.storyPanel.editPlaceholderPart1` / `editPlaceholderPart3`
  / `editPlaceholderChoiceLabel` / `editPlaceholderChoiceDesc`
- `part3.storyPanel.chatHint` (revised example wording)

**Helper scripts kept under `/tmp/` (not checked in):**
- `patch_part6_v3.py` — 9 prompt content rewrites with verification
  print-out.
- `patch_part6_names.py` — 9 name + description updates.
- `verify_part6_patch.py` — 4 sanity assertions (JSON parity
  backend↔frontend, banned phrases removed, i2i strengths correct,
  prompt-length sanity).

**Review doc kept at repo root:**
- `REVIEW_compressed_part6_prompts.md` — character-by-character
  diff for the 6 compressed prompts (L5 + U5), with rationale for
  every deletion.

### 24.9 — Verification

- `vue-tsc -b && vite build` clean, 551-606 ms across all stages.
- All three `python3 /tmp/patch_part6_*.py` runs printed
  before→after diffs for every touched style.
- `verify_part6_patch.py` (4/4) passes: JSON parity, no banned
  phrases, i2i strengths match expected set, prompt lengths in
  recommended range.
- Manual smoke-test (`npm run dev`):
  1. Open lesson A → upload Part 6 sketch + confirm styles. Wait
     2 s. Close tab. Open device B with same invite code. Open
     same project. ✅ sketch + styles + chat all present.
  2. Open lesson B from MyLessons. ✅ Part 6 / 3 / 7 empty —
     no leak from lesson A.
  3. New blank project from MyLessons → Part 5. ✅ shows
     "本课件暂未设置创意示范视频…" empty state, no Bilibili
     iframe.
  4. Part 3 → type into Part-1 textarea. Switch to Sound Design
     tab → click Play. ✅ TTS narrates the edited text.
  5. Part 6 → click chip → edit textarea → save → click 重新确认
     → click 开始转换. ✅ i2i call carries the edited Chinese
     prompt (verified in network tab).


---

## §25 — 2026-05-29 — Pre-baked slide designs, teaching-mode parity, image downsampling

This session added two production lesson decks to the LKP, taught the
fullscreen teaching mode to render the same per-Part components the
teacher uses while editing, fixed two long-running UX bugs (Part 3
story-textarea collapse on tab swap; Part 3 story generation timing
out on oversized artwork uploads), and introduced a generic image
positioning hook (`objectFit` / `objectPosition`) on slide elements.
Everything ships behind backwards-compatible defaults — legacy data
is unaffected.

### 25.1 — Pre-baked slide_framework for G2V2-U4-L4 《好长好长……》 and G2V2-U4-L5 《吸引人的标题》

Both lessons now ship a full `slide_framework` with `default_elements`
arrays — not just a "title + content_points" placeholder. When a
teacher saves either lesson from the Community page,
`hydrateProjectFromLesson()` materialises **fully designed slides**
into the project's snapshot: every cover, chapter divider, three-
column compare, magic-reveal, and step-card layout from the
curriculum reference deck appears verbatim on the canvas.

**Authoring contract** (re-affirmed for these two decks):

- Background → `default_background: /textbook-assets/<LESSON>/design/background.png`
  on every slide.
- Hand-drawn illustrations live next to it in the same `design/`
  folder (e.g. `p1-s1-cover.png`, `p2-s4-elephant.png`).
- Card / band backgrounds use tiny solid-colour PNG swatches kept in
  the same folder (e.g. `p2-s2-pink.png` is ~8 KB) and stretched via
  the `width`/`height` on the image element. This lets the element
  participate in the standard z-order without introducing a new
  "rectangle" element type.
- Pages for Parts 3 / 5 / 6 / 7 stay as placeholder entries (no
  `default_elements`) — those Parts render via their own
  app-specific components (Part3Content / Part5Content / Part6Content
  / Part7Content), not via the SlideThumbnail.

**Coordinate system**: all positions are in the canvas's 960 × 540
"design space". `SlideElement.vue` already turns these into `%` of
the actual container, so the layout scales identically on every
screen (MyLessons preview, editor canvas, and the new fullscreen
teaching mode that this session also wired up).

**Authoring tool**: large decks were generated via small Python
scripts kept under `/tmp/` (see e.g. `/tmp/build_u4l5_slides.py`).
The scripts:

1. Re-use a tiny `text(...)` / `image(...)` helper for parity with
   the U4-L4 deck's coordinate conventions.
2. Set `objectFit: "cover"` / `objectPosition: "center bottom"` on
   any bottom-anchored full-bleed illustration (see §25.3).
3. Read the existing JSON, overwrite only the `slide_framework`
   array, and write the result back. Other fields (artwork list,
   executor prompts, etc.) are preserved verbatim.
4. End with `frontend/scripts/sync-lessons.js`, which copies the
   three `backend/data/lessons/*.json` into `frontend/src/data/
   lessons/` for the bundled fallback path.

### 25.2 — Teaching mode now renders per-Part interactive content

`TeachingMode.vue` previously used the generic `SlideThumbnail` for
every Part — which meant Part 3 / 5 / 6 / 7 slides showed an empty
canvas plus the placeholder text from `slide_framework[].section` /
`content_points`. Teachers in the pilot rightly pointed out that
this defeats the point of "开始上课": Part 3 has a generated
animation, Part 5 has the embedded demo video, Part 6 has the
chosen style cards / before-after compare, Part 7 has the student
feedback panel — those are the things they want students to see.

**Fix**: in `tm-stage` we now dispatch by `currentSlide.partId`:

| partId | Renderer |
|---|---|
| 1 / 2 / 4 (and Part-5 non-video slides) | `SlideThumbnail` (designed slides authored on the regular canvas) |
| 3 | `Part3Content` — image / generated animation / version picker |
| 5 *(only the auto-seeded "video slide" — `slideStore.isPart5VideoSlide(...)` is true)* | `Part5Content` — iframe / `<video>` player |
| 6 | `Part6Content` — step1+step2 cards or result compare |
| 7 | `Part7Content` — student-work upload + AI feedback |

**activeSlideId sync**: the Part 3 / 7 stores key their per-pair
state off `slideStore.activeSlideId`. A new `watch(currentSlide, …)`
in `TeachingMode` keeps that ref in lockstep with the slide the
teacher just navigated to, so the right pair is shown after every
prev/next.

**Click-to-advance scoping**: the click handler is bound on the
inner `.tm-stage` wrapper, not the overlay root. Each Part 3 / 5 /
6 / 7 frame wraps its component in a `<div class="tm-part-frame"
@click.stop>` so teachers can click animation thumbnails, the video
player, upload buttons, AI generate buttons, etc. without
accidentally jumping to the next slide. The "background" area
around the frame still advances on click as before.

**Frame sizing**: `.tm-part-frame` is `width: min(92vw, calc((100vh
- 64px) * 1.6))` × `height: min(calc(100vh - 96px), 92vh)`. The
inner component handles its own scroll/padding (each already has
`flex: 1; display: flex; flex-direction: column`). Part 1 / 2 / 4
slides keep the strict 16:9 `.tm-slide-frame` they had before.

### 25.3 — New `objectFit` / `objectPosition` hook for slide images

Pilot feedback on U4-L4 was that bottom-anchored full-bleed
illustrations (cover, chapter dividers, scene strips) showed white
letterboxing because `object-fit: contain` centres the image inside
its bounding box. The fix is a single optional override on the
slide element:

- `objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'`
- `objectPosition?: string` (e.g. `"center bottom"`)

Default behaviour unchanged: `object-fit: contain`, centred. All
existing snapshots / authored decks render identically. LKP authors
opt in by setting `objectFit: "cover"` and a sensible
`objectPosition` on the design image element. Used in U4-L4 for
the 6 design illustrations that should be bottom-anchored, and in
U4-L5 for the chapter-divider full-bleed scenes + the P4-S5
mushroom bottom band. Hand-uploaded image elements (Add Image
button) leave both undefined and behave as before.

The matching schema fields were added to `frontend/src/types/lesson.ts`
(`SlideElementSeed`) and `frontend/src/utils/lessonSeed.ts` propagates
them on hydration.

### 25.4 — Part 3 Story Preview "tab return" text-collapse bug

Bug repro: open Part 3, generate a story, switch to "音效设计",
click Play (or just open the tab once), switch back to "故事预览"
→ the part1 + part3 textareas are now ~2 rows tall with the rest
of the story clipped behind a scrollless box.

Root cause: the three tabs are guarded by `v-else-if`, so the
textareas are unmounted whenever the teacher leaves "故事预览".
On return, Vue mounts fresh `<textarea>` elements at their default
browser height. The existing `autogrow()` only fires on storyData
/ continuation / branch changes — none of which happen during a
tab switch — so the elements never get resized.

Fix: a `watch(activeTab, …)` in `Part3StoryPanel.vue` re-runs
`autogrow()` on both refs in `nextTick` whenever the user returns
to the `'story'` tab. The teacher's text content is reactively
preserved by the store, so the textareas immediately expand to
fit the full part1 / part3 strings.

### 25.5 — Part 3 oversized-artwork story-generation timeout (《2000交响曲》)

Bug repro: 《听听画画》(g2v2-u5-l1) → Part 3 → pick 《2000交响曲》
→ 「生成故事」prints `[generateStory] JSON.parse failed. Raw
response:` with an empty raw string; teachers see "生成结果为空,
可能是后端连接异常". The other artwork in the same lesson
(《构成第8号》) works first try.

Root cause: `art01-2000jiaoxiang.jpg` is **3.4 MB** (the other
artwork is 355 KB). Inlined as base64 the payload is ~4.5 MB which
hits Doubao Vision's effective input-size ceiling — the model
closes the SSE before emitting any `delta`, so `fullText === ""`
and `JSON.parse("")` throws.

Fix (in `frontend/src/stores/part3.ts`):

- New `_downsampleIfLarge(dataUrl)` helper. Approximate base64
  byte size → if under `_LLM_SIZE_OK_BYTES` (1.5 MB) return the
  data URL untouched (zero-cost no-op for small images). Otherwise
  decode into an `Image`, redraw onto a `<canvas>` capped at
  `_LLM_MAX_EDGE` (1280 px) long edge, re-encode as JPEG quality
  0.85, and return that new data URL.
- Hook three call paths:
  1. `fetchImageAsDataUrl(url)` — when the curated artwork is
     first fetched from `/textbook-assets`.
  2. `_ensureBase64()` data:URL branch — when teacher-uploaded
     artworks are first cached.
  3. `_ensureBase64()` already-cached branch — re-downsamples in
     place if a legacy snapshot (saved before this fix) holds an
     oversized base64. Falls back to the original on canvas
     failure so a single bad image can't take Part 3 offline.

Net effect: 《2000交响曲》's payload to Doubao drops from ~4.5 MB
to ~300 KB; story generation completes normally. Visual fidelity
is unchanged for the vision model (it consumes a downsampled
tensor anyway). Future high-res uploads — including teachers'
camera-direct images during class — are automatically tamed.

> **Asset hygiene tip**: curriculum researchers should still aim
> for ≤ 1.5 MB / ≤ 1600 px on the long edge when adding new
> textbook artwork. The client-side downsampler is a safety net,
> not a substitute. A pre-baked smaller file saves the canvas
> round-trip and shrinks first-paint payloads on the dashboard /
> Part 3 thumbnail.

### 25.6 — Files touched

**Backend** (data only):
- `backend/data/lessons/g2v2-u4-l4.json` — full 14-slide
  `slide_framework` with `default_elements`; 6 design images
  marked `objectFit: "cover"` + `objectPosition: "center bottom"`.
- `backend/data/lessons/g2v2-u4-l5.json` — full 19-slide
  `slide_framework` (15 designed + 4 placeholder).

**Frontend stores / types:**
- `frontend/src/stores/slides.ts` — `SlideElement.objectFit` +
  `objectPosition` optional fields with JSDoc.
- `frontend/src/types/lesson.ts` — matching `SlideElementSeed`
  fields so LKP author-time and runtime stay aligned.
- `frontend/src/utils/lessonSeed.ts` — propagate the two new
  fields when materialising elements.
- `frontend/src/stores/part3.ts` — `_downsampleIfLarge()`,
  `_LLM_SIZE_OK_BYTES`, `_LLM_MAX_EDGE`; rewired
  `fetchImageAsDataUrl()` and `_ensureBase64()`.

**Frontend components:**
- `frontend/src/components/workspace/canvas/SlideElement.vue` —
  `imgStyle` returns `objectFit` + `objectPosition` so the inline
  `<img style=…>` picks them up.
- `frontend/src/components/workspace/TeachingMode.vue` — per-Part
  dispatch (Part3Content / Part5Content / Part6Content /
  Part7Content), `activeSlideId` watcher, `.tm-part-frame`
  styling, click-stop on the inner frames.
- `frontend/src/components/workspace/part3/Part3StoryPanel.vue` —
  new `watch(activeTab, …)` calling `autogrow()` on tab return.

**Frontend data (synced via `frontend/scripts/sync-lessons.js`):**
- `frontend/src/data/lessons/g2v2-u4-l4.json`
- `frontend/src/data/lessons/g2v2-u4-l5.json`

**Authoring scripts kept under `/tmp/` (not checked in):**
- `/tmp/build_u4l5_slides.py` — generator for the 19-entry U4-L5
  framework with per-slide helper functions (`cover_slide`,
  `chapter_divider`, `magic_reveal_slide`, etc.). Re-runnable: it
  only overwrites `slide_framework`, leaving all other LKP fields
  alone.

### 25.7 — Verification

1. **U4-L4** — Community → Save → Open → step through all 14
   slides in the editor; designed slides render with the correct
   text / image positions and bottom-anchored full-bleed
   illustrations. Click 开始上课 → fullscreen → Part 3 shows the
   generated story / animation picker (not a blank canvas +
   placeholder text); Part 5 shows the Bilibili iframe; Part 6
   shows step-1 upload; Part 7 shows the student-work uploader.
   Click-to-advance still works on the dark margin but not on
   interactive UI.
2. **U4-L5** — same path; 15 designed slides + 4 placeholders for
   parts 3/5/6/7. Chapter dividers (01 / 02 / 03), three-column
   "封面大对比", "魔法揭秘 1/2/3", and "设计小步骤" all match the
   teacher-provided PowerPoint reference 1:1 (modulo canvas-rounded
   text positioning).
3. **Part 3 textarea autogrow** — open Part 3 with a long story,
   click 音效设计 → Play → 故事预览; both part1 and part3 textareas
   re-expand to the full story height with no scrollbar inside.
4. **Part 3 downsample** — open U5-L1, pick 《2000交响曲》, click
   生成故事; SSE completes normally, no `JSON.parse failed` in
   console. Network tab: `/api/story/stream` request body
   `image_base64` length ≈ 350 KB instead of the previous ~4.5 MB.
   《构成第8号》still works as before (downsample skipped because
   under threshold).
5. `vue-tsc -b && vite build` — clean.

### 25.8 — Open follow-ups

- The Part 6 / 7 components carry editor chrome (the Part 6 "step
  1 upload" zone, Part 7 "drag-to-upload" zone). In teaching mode
  the teacher *can* still interact with them — that's intentional
  so they can demo conversions / upload student photos live. If
  pilot feedback says students see distracting "click to upload"
  prompts in classroom view, we can introduce a
  `teachingMode: boolean` prop and gate the upload affordances
  behind it.
- The U4-L4 / U4-L5 hand-coded layouts are written against a fixed
  960 × 540 design space. Long Chinese strings may overflow the
  fixed-size text boxes on slides with dense card grids
  (especially the 4 magic-reveal pages). If the curriculum team
  edits the body copy substantially, the boxes need a re-check.
  Consider auto-shrink-to-fit for text elements in a future pass.
- The asset-folder hygiene rule ("design images ≤ 1.5 MB / ≤ 1600
  px long edge") should be enforced by a pre-commit lint when we
  next touch `scripts/sync-r2-assets.js`. For now it's documented
  here and in the `_downsampleIfLarge` docstring.

## §26 — 2026-05-29 — U5-L1 pre-baked deck + new `audio` slide element type

This session added the third production deck (《听听画画》 / g2v2-u5-l1)
to the LKP family, introduced a brand-new `'audio'` slide element
type for embedding curated music tracks inline on a canvas, and
verified that the teaching-mode parity work from §25 covers the
new lesson unmodified.

### 26.1 — Pre-baked `slide_framework` for G2V2-U5-L1 《听听画画》

The U5-L1 lesson now ships a full 14-entry `slide_framework`: 10
designed slides + 4 placeholders for Parts 3/5/6/7 (which render
through their respective interactive components, not via
SlideThumbnail). Same authoring contract as §25.1:

- `default_background: /textbook-assets/G2V2-U5-L1/design/background.png`
  on every designed slide.
- Hand-drawn illustrations live next to it under `design/` (e.g.
  `p2-s1-piano.png`, `p4-s2-listening.png`).
- White / accent card backgrounds are tiny solid-colour PNG
  swatches kept in the same folder (`p2-s3-white.png`,
  `p2-s4-white.png`, `p2-s6-white.png`) and stretched via
  `width`/`height` on the image element so cards participate in
  the standard z-order without a new "rectangle" element type.
- Pages for Parts 3 / 5 / 6 / 7 stay as placeholder entries (no
  `default_elements`) — rendered by Part3Content / Part5Content /
  Part6Content / Part7Content.

The 10 designed pages map onto the 10 reference layout JPGs the
curriculum team provided in `~/Desktop/预制课件排版参考/
G2V2-U5-L1《听听画画》课件排版参考/`:

| Page | Part | Section |
|---|---|---|
| 1 | 1 | 封面 (cover with `p1-s1-cover.png` bottom band) |
| 2 | 2 | 导入 · 声音入画 (`p2-s1-piano.png` + 听想引导) |
| 3 | 2 | 导入 · 拍手游戏 (`p2-s2-round.png` + 3 step cards) |
| 4 | 2 | 导入 · 形状变音乐 (圆/三角/自由形状 white-card grid) |
| 5 | 2 | 导入 · 线条变音乐 (粗/细/起伏 white-card grid) |
| 6 | 2 | 导入 · 大师示范欣赏 (`p2-s5-drawing.png` + 2 cards) |
| 7 | 2 | 导入 · 三位小画家 (3 student drawings) |
| 9 | 4 | 章节扉页 02 音乐入画来 (full-bleed `p4-s1-music.png`) |
| 10 | 4 | **聆听音乐** — `p4-s2-listening.png` + **2 internal `<audio>` players** |
| 11 | 4 | 艺术实践 · 小画家范例 (3 student examples) |

Built via `/tmp/build_u5l1_slides.py` modelled on
`/tmp/build_u4l5_slides.py`; re-runnable (it only overwrites
`slide_framework`, leaving artwork list / executor prompts / audio
resources / Part 7 system prompt etc. intact). Ends with
`frontend/scripts/sync-lessons.js` to mirror the JSON into
`frontend/src/data/lessons/` for the bundled fallback path.

### 26.2 — New `'audio'` slide element type

Pilot need: G2V2-U5-L1 Part 4 Slide 2 (《聆听音乐》) needs **two
clickable music players** embedded on the canvas — one per curated
track from `audio_resources[]` (《火车开啦》、《小小的船》). The
existing `slide.audioBg` field is a single auto-play
background-audio data URL and doesn't fit this use case (teachers
need explicit play/pause per track, and they want both tracks
visible side-by-side on the slide).

Schema additions (backwards-compatible):

- `frontend/src/stores/slides.ts` — `ElementType` extended from
  `'text' | 'image' | 'video'` to also include `'audio'`. Reuses
  the existing `src?: string` field for the mp3 URL; no new fields
  on `SlideElement`.
- `frontend/src/types/lesson.ts` — `SlideElementSeed.type` widened
  to `'text' | 'image' | 'audio'`. The LKP author writes
  `{ type: "audio", src: "/textbook-assets/.../music.mp3", x, y,
  width, height }` and the existing `lessonSeed.ts` materialiser
  propagates `type` + `src` unchanged.
- No migration needed for legacy snapshots — existing
  `text` / `image` / `video` elements are untouched.

Render branches (mirrors the existing `video` branch in both
files):

- `frontend/src/components/workspace/canvas/SlideElement.vue` —
  new `v-else-if="element.type === 'audio'"` block renders a
  centred native `<audio controls preload="metadata">` inside the
  bounding box. `@mousedown.stop` + `@click.stop` keep clicks on
  the player from triggering element-drag or, in fullscreen,
  click-to-advance.
- `frontend/src/components/workspace/SlideThumbnail.vue` —
  identical render branch under class `.st-audio` / `.st-audio-player`
  so teaching-mode sees the same player.

The audio element survives `getSnapshot()` / `loadSnapshot()` and
the undo/redo history since `Slide.elements` is JSON-cloned wholesale
and the new `type` value passes through untouched.

The `slide.audioBg` (auto-play background) feature is **kept as-is**
— the audio toolbar button in `WorkspaceContent.vue` still
toggles it. Teachers can therefore have BOTH:

1. Pre-embedded `audio` elements they explicitly trigger
   (curriculum-curated tracks; this is what U5-L1 P4-S2 uses), and
2. An optional auto-play `audioBg` they upload via the toolbar
   (their own classroom ambient track).

### 26.3 — U5-L1 P4-S2 specifics

The «聆听音乐» canvas now contains, in canvas coordinates:

- Title "聆听音乐：听一听，再画一画" (top, blue).
- Left: `p4-s2-listening.png` (430×400 illustration at 20,110).
- Right top: pink accent bar + "老师准备了 2 首音乐" heading +
  guidance ("…如果你还想听别的曲子，也可以让老师再上传一首").
  The literal number "**2 首**" replaces the original placeholder
  text "3 首" the curriculum team called out.
- Right middle: two stacked rows, each with a Chinese track label
  (《火车开啦》 / 《小小的船》) above a 440×46 `<audio controls>`
  element pre-pointed at the corresponding mp3 under
  `/textbook-assets/G2V2-U5-L1/music/`.
- Right bottom: a small footnote reminding teachers that the
  per-slide audio toolbar button still works for extra uploads.

The audio element heights (46 px in canvas-space) match the native
WebKit audio-player control height so the box hugs the player
without trailing whitespace.

### 26.4 — Teaching-mode parity (no new code)

§25.2's `TeachingMode.vue` dispatch table already does the right
thing for U5-L1 unchanged:

| partId | Renderer |
|---|---|
| 1 / 2 / 4 | `SlideThumbnail` (designed slides, including the audio elements) |
| 3 | `Part3Content` (artwork story + animation picker) |
| 5 | `Part5Content` for the seeded video slide |
| 6 | `Part6Content` (style cards) |
| 7 | `Part7Content` (student feedback) |

The new audio element renders identically in fullscreen because
`SlideThumbnail.vue` is the same component the canvas and
teaching-mode both mount. The inner `<div class="st-audio">`
re-stops `mousedown` / `click` so pressing play in fullscreen
doesn't bubble up to `.tm-stage`'s `@click="next"` handler.

### 26.5 — Files touched

**Backend** (data only):
- `backend/data/lessons/g2v2-u5-l1.json` — `slide_framework`
  replaced with 14 entries (10 designed + 4 placeholders).

**Frontend stores / types:**
- `frontend/src/stores/slides.ts` — `ElementType` adds `'audio'`.
- `frontend/src/types/lesson.ts` — `SlideElementSeed.type` adds
  `'audio'`.
- `frontend/src/utils/lessonSeed.ts` — unchanged; the generic
  `type: srcEl.type` + `src: srcEl.src` propagation already
  handles the new branch.

**Frontend components:**
- `frontend/src/components/workspace/canvas/SlideElement.vue` —
  new audio render block + `.audio-content` / `.audio-player`
  styles.
- `frontend/src/components/workspace/SlideThumbnail.vue` — same
  render block + `.st-audio` / `.st-audio-player` styles; image
  branch also now propagates `objectFit` / `objectPosition` so
  designed thumbnails match the editor canvas.

**Frontend data (synced via `frontend/scripts/sync-lessons.js`):**
- `frontend/src/data/lessons/g2v2-u5-l1.json`

**Authoring scripts kept under `/tmp/` (not checked in):**
- `/tmp/build_u5l1_slides.py` — generator for the 14-entry U5-L1
  framework with helper functions (`cover_slide`,
  `slide_p2_s1…s6`, `slide_p4_s1…s3`, `audio_element`).
  Re-runnable: overwrites only `slide_framework`.

### 26.6 — Verification

1. **U5-L1 deck** — Community → Save 《听听画画》 → Open. 10
   designed slides render with the correct illustrations from
   `/textbook-assets/G2V2-U5-L1/design/` on the shared background.
   Sidebar shows 14 entries in Part order; Parts 3/5/6/7
   placeholders are blank canvases (Parts render their own
   content).
2. **Audio playback (editor)** — Click into Part 4 Slide 2: the
   page caption reads "老师准备了 2 首音乐", both audio players
   show 0:00 and the standard browser controls. Click play on
   《火车开啦》 → music plays; clicking the audio control doesn't
   accidentally drag the element. Adding a third audio via the
   toolbar (audio icon at bottom of the canvas) still works and
   triggers the existing `audioBg` autoplay in fullscreen.
3. **Audio playback (teaching mode)** — 开始上课 → arrow to P4-S2:
   both players visible at the same position. Pressing play
   doesn't advance the slide. Pressing arrow / clicking the dark
   margin advances normally.
4. **No regressions** — U4-L4 / U4-L5 decks unchanged. Image
   elements with `objectFit: "cover"` keep working in editor +
   thumbnail + teaching mode (the SlideThumbnail tweak now
   propagates them to the thumbnail render path too — they were
   already coming through in the editor canvas via
   `SlideElement.vue`'s `imgStyle`).
5. `vue-tsc -b && vite build` — clean.

### 26.7 — Open follow-ups

- The 10 designed slide layouts were written against the
  reference JPGs from a high-level reading of each composition;
  exact text-box widths and per-character spacing may still need
  fine adjustment once the curriculum team eyeballs the rendered
  pages side-by-side with the PowerPoint references. Position
  fixes are cheap — re-run `/tmp/build_u5l1_slides.py` after
  edits.
- The `audio` element currently inherits `SlideElement.vue`'s
  resize handles but the inner `<audio>` always fills width and
  caps height at 100% — so dragging the corner makes a very tall
  / short box that still shows a normal-height player at the top.
  If pilot teachers find this confusing, consider locking
  audio-element resize to width-only (similar to how text
  elements lock font scaling). Out of scope for this pass.
- The `slide.audioBg` autoplay model is still single-track; if a
  future lesson needs ≥2 ambient tracks we'd need to switch
  `audioBg` to `audioBg?: string[]` or, more likely, deprecate it
  in favour of the new `audio` element type with a custom autoplay
  flag.
