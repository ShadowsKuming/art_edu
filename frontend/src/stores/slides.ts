import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const CANVAS_W = 960
export const CANVAS_H = 540

export type ElementType = 'text' | 'image' | 'video' | 'audio'

export interface SlideElement {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  // text
  content: string
  /**
   * Optional bilingual text variants. When at least one of these is
   * populated, `content` is treated as a *projection* of the active
   * locale's variant: `useSlideStore.setLocale('zh')` will rewrite
   * `content` from `contentZh` (and vice-versa for `en`).
   *
   * Elements created by hand (Add Text button) leave both undefined
   * and behave exactly as before — `content` is the only source.
   *
   * Elements seeded from an LKP `default_elements[]` row carrying
   * `content_en` / `content_zh` get both populated at hydration time,
   * so a locale toggle in the workspace header swaps both sides
   * non-destructively. Teacher edits write to whichever side matches
   * the current locale; the other survives untouched until the
   * teacher opens it in that locale.
   */
  contentEn?: string
  contentZh?: string
  fontSize: number
  fontWeight: string
  fontFamily: string
  textAlign: 'left' | 'center' | 'right' | 'justify'
  color: string
  // image
  src?: string
  flipH?: boolean
  flipV?: boolean
  rotation?: number
  cropT?: number
  cropR?: number
  cropB?: number
  cropL?: number
  /**
   * Optional CSS `object-fit` override for image elements. Defaults to
   * `contain` (preserves aspect ratio, letterboxes inside the box).
   * Set to `cover` for full-bleed design images that should fill the
   * bounding box without whitespace.
   */
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  /**
   * Optional CSS `object-position` override (e.g. `"center bottom"`).
   * Only meaningful with `object-fit: cover` / `contain`.
   */
  objectPosition?: string
}



export interface Slide {
  id: string
  partId: number
  elements: SlideElement[]
  background?: string    // image data URL
  bgColor?: string       // solid color
  // 2026-05-28: `isLocalBackground` retired together with the
  // "master slide / global theme" feature. The field is kept on the
  // type as `?: boolean` purely so legacy snapshots (localStorage,
  // Render DB) deserialise without TypeScript narrowing complaints.
  // Nothing reads it any more; new slides do not write it.
  isLocalBackground?: boolean
  audioBg?: string       // audio data URL played when this slide is active in teaching mode
}

let elCounter = 0

export type Locale = 'en' | 'zh'

export const useSlideStore = defineStore('slides', () => {
  const slides = ref<Slide[]>([])
  const activeSlideId = ref<string | null>(null)
  const selectedElementId = ref<string | null>(null)
  const activePart = ref<number>(1)
  const maxUnlockedPart = ref<number>(1)

  /**
   * Active locale for bilingual text projection. Synced from
   * `i18n.global.locale.value` by a watcher in `App.vue`. We hold
   * our own copy (rather than reading i18n in every method) so the
   * store stays decoupled from the i18n plugin and snapshots can be
   * deserialised in tests without bootstrapping vue-i18n.
   */
  const locale = ref<Locale>('en')

  // 2026-05-28: the "master slide / global theme" feature was
  // retired site-wide. Each slide now owns its own `background` /
  // `bgColor` and no longer follows a project-level default.
  //
  // The previous behaviour was: changing background on the first
  // Part-1 slide implicitly populated `globalBackground` /
  // `globalBgColor`, which was then propagated by `_propagateGlobal()`
  // to every other slide whose `isLocalBackground` flag was false.
  // Teachers found this confusing — uploading an opening cover image
  // would silently take over Part 2-7 canvases.
  //
  // The refs and propagation logic have been removed. Legacy
  // snapshots that still carry `snapshot.globalBackground` are
  // silently ignored on load (no crash, no rehydrate). Slides that
  // had previously inherited the global value retain it on their own
  // `slide.background` field — `_propagateGlobal()` had eagerly
  // materialised it, so existing projects look unchanged after the
  // rollout. See `loadSnapshot()` for the ignore site.

  const activeSlide = computed(() =>
    slides.value.find(s => s.id === activeSlideId.value) ?? null
  )

  const selectedElement = computed(() =>
    activeSlide.value?.elements.find(e => e.id === selectedElementId.value) ?? null
  )

  function slidesForPart(partId: number) {
    return slides.value.filter(s => s.partId === partId)
  }

  function addSlide(partId: number): string {
    checkpoint()
    const id = `slide-${Date.now()}`
    // 2026-05-28: new slides start with no background at all.
    // Previously this seeded `background = globalBackground.value`
    // so the slide would inherit the project-level theme; that
    // behaviour was removed together with the master-slide feature.
    slides.value.push({
      id, partId, elements: [],
    })
    activeSlideId.value = id
    selectedElementId.value = null
    return id
  }

  function selectSlide(id: string) {
    activeSlideId.value = id
    selectedElementId.value = null
  }

  function addElement(slideId: string, type: ElementType) {
    checkpoint()
    const slide = slides.value.find(s => s.id === slideId)
    if (!slide) return
    const id = `el-${++elCounter}`
    slide.elements.push({
      id, type,
      x: CANVAS_W / 2 - 150,
      y: CANVAS_H / 2 - 40,
      width: 300,
      height: 80,
      content: 'Double-click to edit',
      fontSize: 24,
      fontWeight: 'Normal',
      fontFamily: 'Albert Sans',
      textAlign: 'left',
      color: '#111827',
    })
    selectedElementId.value = id
  }

  function addVideoElement(slideId: string, src: string, width: number, height: number) {
    checkpoint()
    const slide = slides.value.find(s => s.id === slideId)
    if (!slide) return
    const id = `el-${++elCounter}`
    slide.elements.push({
      id, type: 'video', src,
      x: Math.round((CANVAS_W - width) / 2),
      y: Math.round((CANVAS_H - height) / 2),
      width, height,
      content: '', fontSize: 24, fontWeight: 'Normal',
      fontFamily: 'Albert Sans', textAlign: 'left', color: '#111827',
    })
    selectedElementId.value = id
  }

  function setSlideAudio(slideId: string, dataUrl: string | undefined) {
    checkpoint()
    const slide = slides.value.find(s => s.id === slideId)
    if (!slide) return
    slide.audioBg = dataUrl
  }

  function addImageElement(slideId: string, src: string, width: number, height: number) {
    checkpoint()
    const slide = slides.value.find(s => s.id === slideId)
    if (!slide) return
    const id = `el-${++elCounter}`
    slide.elements.push({
      id, type: 'image', src,
      x: Math.round((CANVAS_W - width) / 2),
      y: Math.round((CANVAS_H - height) / 2),
      width, height,
      content: '', fontSize: 24, fontWeight: 'Normal',
      fontFamily: 'Albert Sans', textAlign: 'left', color: '#111827',
    })
    selectedElementId.value = id
  }

  /**
   * Update an element. When `patch.content` is present and the
   * element has any bilingual variant set (so it came from an LKP
   * seed), the new text is *also* mirrored into the variant matching
   * the active locale — preserving the other language's edits.
   *
   * Hand-created text elements (no `contentEn`/`contentZh`) keep
   * the simple single-string semantics: `content` is the only field
   * we write.
   */
  function updateElement(slideId: string, id: string, patch: Partial<SlideElement>) {
    const slide = slides.value.find(s => s.id === slideId)
    if (!slide) return
    const el = slide.elements.find(e => e.id === id)
    if (!el) return
    Object.assign(el, patch)

    if (Object.prototype.hasOwnProperty.call(patch, 'content')) {
      const isBilingual = el.contentEn !== undefined || el.contentZh !== undefined
      if (isBilingual) {
        if (locale.value === 'zh') el.contentZh = patch.content ?? ''
        else el.contentEn = patch.content ?? ''
      }
    }
  }

  /**
   * Switch the active locale and re-project every bilingual element's
   * `content` from its `contentEn` / `contentZh` variant. Idempotent
   * and safe to call from a watcher on every locale change.
   *
   * Elements with no bilingual variants are left untouched so hand-
   * created text doesn't get wiped on a locale toggle.
   */
  function setLocale(next: Locale) {
    locale.value = next
    for (const slide of slides.value) {
      for (const el of slide.elements) {
        if (el.type !== 'text') continue
        const en = el.contentEn
        const zh = el.contentZh
        if (en === undefined && zh === undefined) continue
        // Prefer the requested language, fall back to the other one
        // when only a single side was authored (e.g. mid-translation).
        if (next === 'zh') el.content = zh ?? en ?? ''
        else el.content = en ?? zh ?? ''
      }
    }
  }


  function removeElement(slideId: string, id: string) {
    checkpoint()
    const slide = slides.value.find(s => s.id === slideId)
    if (!slide) return
    slide.elements = slide.elements.filter(e => e.id !== id)
    if (selectedElementId.value === id) selectedElementId.value = null
  }

  function selectElement(id: string | null) {
    selectedElementId.value = id
  }

  // 2026-05-28: `_propagateGlobal()` and `resetSlideToGlobal()` were
  // deleted with the master-slide feature. Setting a background on
  // any slide — including the first Part-1 slide — now affects ONLY
  // that slide. No fan-out, no project-level state.

  function setSlideBackground(slideId: string, bg: string) {
    checkpoint()
    const slide = slides.value.find(s => s.id === slideId)
    if (!slide) return
    slide.background = bg
    slide.bgColor = undefined
  }

  function setSlideBgColor(slideId: string, color: string) {
    checkpoint()
    const slide = slides.value.find(s => s.id === slideId)
    if (!slide) return
    slide.bgColor = color
    slide.background = undefined
  }

  // 2026-05-28: `navigateToNextPart()` retired together with the
  // per-part "下一部分" / "保存" buttons. The workspace no longer
  // gates progression — teachers can jump to any Part from the
  // sidebar at any time. `navigateToPart()` below does the same
  // job without the bump-the-fence-and-go-forward semantics.

  function navigateToPart(partId: number) {
    if (partId >= 1 && partId <= 7) {
      // 2026-05-28: `maxUnlockedPart` no longer gates navigation.
      // The field stays in the snapshot for backwards compat but
      // every Part is reachable unconditionally.
      activePart.value = partId
      // 2026-05 — Part 5 ("创意示范") now hosts BOTH the legacy video
      // upload UI AND user-added blank canvas slides. The first
      // Part-5 slide is always the "video slide" (rendered as
      // `Part5Content` in `CreateLesson.vue`); subsequent slides are
      // regular blank canvases edited via `WorkspaceContent`.
      //
      // Old projects (and LKPs that didn't seed a Part-5 slide) can
      // land here with zero Part-5 slides. Seed one on first entry
      // so the sidebar always has the video-slide thumbnail to show,
      // and so the canvas doesn't fall into "no active slide" empty
      // state on Part 5.
      if (partId === 5) {
        const part5First = slides.value.find(s => s.partId === 5)
        if (!part5First) {
          addSlide(5)
        } else {
          // 2026-05-28 — Normalise the existing Part-5 first slide
          // into a clean "video slide" stub. The LKP's generic
          // fallback seeder used to dump "艺术实践·步骤提示" +
          // "提示步骤：..." into this slide's elements (from the
          // `slide_framework` page-7 entry), which leaked through
          // the sidebar thumbnail since the centre canvas is
          // entirely owned by `Part5Content`. The sidebar now
          // renders a custom play-icon for the video slide, but we
          // still wipe the underlying elements / background here so
          // any future consumer (Community Preview, screenshot
          // export, etc.) sees a truly empty video slide. The text
          // is preserved in the LKP JSON itself for AI grounding.
          if (
            part5First.elements.length > 0
            || part5First.background
            || part5First.bgColor
          ) {
            checkpoint()
            part5First.elements = []
            part5First.background = undefined
            part5First.bgColor = undefined
            // 2026-05-28: `isLocalBackground` is a legacy field from
            // the retired master-slide feature; nothing reads it any
            // more. Left unset on purpose.
          }
        }
      }
      // Auto-select the first slide of the destination part so the
      // canvas always reflects the part the user just jumped to,
      // rather than lingering on a slide that belongs to the
      // previous part. If the part is empty (e.g. Part 3 before any
      // artwork has been picked), clear the active slide instead so
      // downstream components fall back to their empty state.
      const first = slides.value.find(s => s.partId === partId)
      activeSlideId.value = first?.id ?? null
      selectedElementId.value = null
    }
  }

  /**
   * 2026-05 — The id of Part 5's "video slide" (always the first
   * slide whose `partId === 5`). Returns `null` when no Part-5 slide
   * exists yet — should be rare in practice because
   * `navigateToPart(5)` auto-seeds one.
   */
  const part5VideoSlideId = computed(() =>
    slides.value.find(s => s.partId === 5)?.id ?? null,
  )

  /**
   * 2026-05 — True when the supplied id refers to the Part-5 video
   * slide. The workspace uses this to switch between `Part5Content`
   * (video player UI) and `WorkspaceContent` (blank canvas editor).
   * The sidebar uses it to suppress the delete button on the video
   * slide and to render a "▶ 视频" badge on its thumbnail.
   */
  function isPart5VideoSlide(slideId: string | null): boolean {
    return !!slideId && slideId === part5VideoSlideId.value
  }

  function getSnapshot() {
    // 2026-05-28: `globalBackground` / `globalBgColor` no longer
    // serialised — feature retired. Legacy snapshots keep the keys
    // but they're ignored on load (see `loadSnapshot` below).
    return {
      slides: JSON.parse(JSON.stringify(slides.value)) as Slide[],
      activePart: activePart.value,
      maxUnlockedPart: maxUnlockedPart.value,
      activeSlideId: activeSlideId.value,
    }
  }

  function loadSnapshot(snap: ReturnType<typeof getSnapshot> & {
    // Legacy fields tolerated for backwards-compatibility with
    // pre-2026-05-28 snapshots saved in localStorage / Render DB.
    globalBackground?: string
    globalBgColor?: string
  }) {
    slides.value = snap.slides
    activePart.value = snap.activePart
    maxUnlockedPart.value = snap.maxUnlockedPart
    // `snap.globalBackground` / `globalBgColor` deliberately ignored.
    // Their previous side-effect (propagation to every slide) had
    // already materialised the value into each individual
    // `slide.background`, so dropping them here is a no-op visually.
    activeSlideId.value = snap.activeSlideId ?? snap.slides[0]?.id ?? null
    selectedElementId.value = null
  }

  // ── Undo / Redo ────────────────────────────────────────────────────────────

  type Snapshot = ReturnType<typeof getSnapshot>
  const past = ref<Snapshot[]>([])
  const future = ref<Snapshot[]>([])
  const MAX_HISTORY = 50

  function checkpoint() {
    past.value.push(getSnapshot())
    if (past.value.length > MAX_HISTORY) past.value.shift()
    future.value = []
  }

  function undo() {
    if (!past.value.length) return
    future.value.push(getSnapshot())
    loadSnapshot(past.value.pop()!)
  }

  function redo() {
    if (!future.value.length) return
    past.value.push(getSnapshot())
    loadSnapshot(future.value.pop()!)
  }

  function removeSlide(slideId: string) {
    checkpoint()
    const idx = slides.value.findIndex(s => s.id === slideId)
    if (idx === -1) return
    const partId = slides.value[idx].partId
    const partSlides = slides.value.filter(s => s.partId === partId)
    if (partSlides.length <= 1) return  // keep at least one
    slides.value.splice(idx, 1)
    if (activeSlideId.value === slideId) {
      const remaining = slides.value.filter(s => s.partId === partId)
      activeSlideId.value = remaining[Math.min(idx, remaining.length - 1)]?.id ?? null
      selectedElementId.value = null
    }
  }

  function reset() {
    slides.value = []
    activeSlideId.value = null
    selectedElementId.value = null
    activePart.value = 1
    maxUnlockedPart.value = 1
    // (no globalBackground/globalBgColor to clear — feature retired)
  }

  return {
    slides, activeSlideId, selectedElementId, activePart, maxUnlockedPart,
    // 2026-05-28: `globalBackground`, `globalBgColor`, `resetSlideToGlobal`
    // no longer exported — master-slide feature retired.
    locale, setLocale,
    activeSlide, selectedElement,
    slidesForPart, addSlide, selectSlide,
    addElement, addImageElement, addVideoElement, setSlideAudio, updateElement, removeElement, selectElement,
    setSlideBackground, setSlideBgColor,
    // 2026-05-28: `navigateToNextPart` removed — see retirement note above.
    navigateToPart,
    part5VideoSlideId, isPart5VideoSlide,
    removeSlide, getSnapshot, loadSnapshot, reset,
    checkpoint, undo, redo,
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
  }

})
