import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Slide } from './slides'
import { useChatbotStore } from './chatbot'
import { usePart5Store } from './part5'
import { usePart3Store } from './part3'
import { usePart6Store } from './part6'
import { usePart7Store } from './part7'
import type { ChatHistories } from './chatbot'
import { apiPost, apiPut, apiDelete, apiGet, getToken } from '@/api/client'
import { useToastStore } from './toast'

const STORAGE_KEY = 'artbloom-projects'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

// Strip legacy absolute localhost URLs from stored slide element src/background fields.
// Older snapshots baked in http://localhost:8001/textbook-assets/... before assets
// were moved to public/. Replace with root-relative paths so Cloudflare Pages serves them.
function migrateProjects(projects: Project[]): Project[] {
  const OLD = 'http://localhost:8001/textbook-assets/'
  const NEW = '/textbook-assets/'
  const fix = (s: string) => s.startsWith(OLD) ? NEW + s.slice(OLD.length) : s
  return projects.map(p => ({
    ...p,
    snapshot: {
      ...p.snapshot,
      // 2026-05-28: `globalBackground` is no longer part of the
      // SlideSnapshot type — the master-slide / global-theme feature
      // was retired. Legacy snapshots may still carry the field
      // under `...p.snapshot` spread above; it is harmless on read
      // (slide store ignores unknown keys) and no longer migrated.
      slides: p.snapshot.slides.map(slide => ({
        ...slide,
        background: slide.background ? fix(slide.background) : slide.background,
        elements: slide.elements.map(el => ({
          ...el,
          src: el.src ? fix(el.src) : el.src,
        })),
      })),
    },
  }))
}

export interface SlideSnapshot {
  slides: Slide[]
  activePart: number
  maxUnlockedPart: number
  // 2026-05-28: `globalBackground` and `globalBgColor` removed
  // together with the "master slide" feature. Legacy snapshots that
  // still carry these keys are silently ignored on hydrate — see
  // `useSlideStore().loadSnapshot()` for the tolerant signature.
  activeSlideId: string | null
  /** Chatbot histories keyed by partId string (e.g. "1", "3"). Stored here
   *  so they travel with the project to any device when synced to the DB. */
  chatbotHistory?: ChatHistories
  /** Part 5 pasted video URL (YouTube, Bilibili, or direct mp4). */
  part5CustomUrl?: string
  /** Full Part 3 state (artwork, story, animation, continuations, chat). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  part3Snapshot?: any
  /** Full Part 6 state (sketch, styles, results, chat). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  part6Snapshot?: any
  /** Full Part 7 state (student works, feedback). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  part7Snapshot?: any
}

/**
 * Curriculum-anchored metadata captured by the lesson-selection modal
 * (`Dashboard.vue` → `LessonSelectionModal.vue`) when a project is
 * created. Optional so legacy projects (created before the modal landed)
 * keep working — the MyLessons "Unit / Lesson" column simply renders an
 * em-dash when this is missing.
 *
 * Stored as a snapshot of the labels rather than just IDs so renaming or
 * restructuring `curriculum.ts` later won't retroactively rewrite a
 * teacher's saved decks.
 */
export interface ProjectMeta {
  volumeId: string  // e.g. 'g2v2'
  unitId: string    // e.g. 'g2v2-u3'
  lessonId: string  // e.g. 'g2v2-u3-l1'
  grade: number
  volume: number
  unitNumber: number
  lessonNumber: number
  unitTitleEn: string
  unitTitleZh: string
  lessonTitleEn: string
  lessonTitleZh: string
}

export interface Project {
  id: string
  name: string
  createdAt: string
  status?: 'draft' | 'completed' | 'taught' | 'saved'
  snapshot: SlideSnapshot
  part5VideoDataUrl?: string
  part5VideoName?: string
  /** Curriculum origin — present when created from the lesson modal. */
  meta?: ProjectMeta
}

// Shape returned by the API for a project
export interface ApiProject {
  id: string
  name: string
  status: string
  meta: ProjectMeta | null
  snapshot: SlideSnapshot
  part5_video_name: string | null
  created_at: string
  updated_at: string
}

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<Project[]>(migrateProjects(load(`${STORAGE_KEY}-list`, [])))
  const activeProjectId = ref<string | null>(load(`${STORAGE_KEY}-active`, null))

  /**
   * 2026-05-29 — Hydration guard.
   *
   * `setActiveProject(id)` flips this `true` for ~200 ms while it
   * calls `loadSnapshot(...)` / `reset()` on every per-part store.
   * The cross-device autosave watcher in `CreateLesson.vue` checks
   * this flag and bails — otherwise the synchronous mutations from
   * the hydrate path would immediately fire the watcher and PUT the
   * just-loaded snapshot straight back to the server, which is
   * harmless but wasteful and risks racing with a freshly-saved
   * remote update.
   *
   * Reading code only ever needs `if (projectsStore._isHydrating) return`
   * at the top of the autosave callback — see CreateLesson.vue.
   */
  const _isHydrating = ref(false)

  const activeProject = computed(() =>
    projects.value.find(p => p.id === activeProjectId.value) ?? null
  )

  /**
   * Convenience accessor — the active project's LKP id, if it was
   * created from a Community/curriculum lesson. Every store that
   * calls a backend AI endpoint reads this and passes it through as
   * `lesson_id` so the backend's LessonContextManager can inject
   * Part-specific prompts.
   *
   * Returns `null` for legacy / freeform projects.
   */
  const activeLessonId = computed<string | null>(
    () => activeProject.value?.meta?.lessonId ?? null,
  )


  /**
   * Create a project. The `meta` argument is optional so the legacy
   * MyLessons "+ New Lesson" prompt (which only collects a name) keeps
   * working unchanged. The Dashboard "Create Lesson" flow always
   * provides it.
   */
  async function createProject(name: string, meta?: ProjectMeta): Promise<string> {
    const id = `proj-${Date.now()}`
    const newProject: Project = {
      id,
      name,
      createdAt: new Date().toISOString(),
      snapshot: {
        slides: [],
        activePart: 1,
        maxUnlockedPart: 1,
        // 2026-05-28: no globalBackground / globalBgColor — feature retired.
        activeSlideId: null,
      },
      meta,
    }
    projects.value.push(newProject)
    // 2026-05-29 — Route the activation through `setActiveProject(id)`
    // instead of assigning `activeProjectId.value` directly. That
    // function also resets every per-part store, which is critical
    // for the "新建课件" flow: without this, a blank new project
    // would inherit the previous project's Part-6 sketch / chat /
    // Part-3 stories / Part-7 feedback. See setActiveProject's
    // docstring for the full rationale on cross-project leaks.
    setActiveProject(id)

    // Fire-and-forget API sync so navigation isn't blocked by Render cold start.
    // The project already exists in the local store, so the workspace can open
    // immediately; the DB write happens in the background.
    if (getToken()) {
      apiPost('/api/projects', {
        id: newProject.id,
        name: newProject.name,
        status: newProject.status ?? 'draft',
        meta: newProject.meta ?? null,
        snapshot: newProject.snapshot,
        part5_video_name: newProject.part5VideoName ?? null,
      }).catch((err) => {
        console.error('[projects] createProject API failed', err)
        useToastStore().show('Could not save to server — working offline', 'warning')
      })
    }

    return id
  }

  async function saveCurrentProject(
    slideSnap: SlideSnapshot,
    part5VideoDataUrl?: string,
    part5VideoName?: string,
  ): Promise<void> {
    const project = projects.value.find(p => p.id === activeProjectId.value)
    if (!project) return
    // Bundle chatbot history for this project into the snapshot so it
    // travels to the DB and is available on any device after login.
    const chatbotStore = useChatbotStore()
    const prefix = `${project.id}:`
    const chatbotHistory: ChatHistories = {}
    const allHistories: ChatHistories = chatbotStore.histories as unknown as ChatHistories
    for (const key of Object.keys(allHistories)) {
      if (key.startsWith(prefix)) {
        chatbotHistory[key.slice(prefix.length)] = allHistories[key]
      }
    }
    const part5CustomUrl = usePart5Store().customUrl || undefined
    const part3Snapshot = usePart3Store().getSnapshot()
    const part6Snapshot = usePart6Store().getSnapshot()
    const part7Snapshot = usePart7Store().getSnapshot()
    const snapWithChat = {
      ...slideSnap,
      chatbotHistory,
      part5CustomUrl,
      part3Snapshot,
      part6Snapshot,
      part7Snapshot,
    }

    project.snapshot = snapWithChat
    project.part5VideoDataUrl = part5VideoDataUrl
    project.part5VideoName = part5VideoName

    // Note: part5VideoDataUrl is intentionally NOT synced (videos can be 100MB+)
    if (getToken() && activeProjectId.value) {
      apiPut(`/api/projects/${activeProjectId.value}`, {
        name: project.name,
        status: project.status ?? 'draft',
        snapshot: snapWithChat,
        part5_video_name: part5VideoName ?? null,
      }).catch((err) => {
        console.error('[projects] saveCurrentProject API failed', err)
        useToastStore().show('Could not sync to server', 'warning')
      })
    }
  }

  function deleteProject(id: string) {
    projects.value = projects.value.filter(p => p.id !== id)
    if (activeProjectId.value === id) activeProjectId.value = null
    // 2026-05 — chatbot histories are bucketed per
    // `${projectId}:${partId}`. When the teacher trashes a deck we
    // also wipe every chatbot bucket prefixed with that project's
    // id so they don't linger in localStorage forever.
    useChatbotStore().clearProject(id)

    // Fire-and-forget API sync when authenticated
    if (getToken()) {
      apiDelete(`/api/projects/${id}`).catch(console.error)
    }
  }

  /**
   * Set the active project AND fully rehydrate every per-part store
   * from that project's snapshot.
   *
   * 2026-05-29 — Before this consolidation, every entry point that
   * opened a project (`MyLessons.resumeProject`, `Dashboard` start-
   * teaching drawer, `CreateLesson` onMounted, `Community` "back to
   * preview origin", `loadFromAPI` hydration) had its own scattered
   * `if (s.partXSnapshot) usePartXStore().loadSnapshot(...)` lines.
   *
   * The `if` guard caused the cross-project leak teachers reported:
   * when the incoming project had NO `part6Snapshot`, the previous
   * project's Part-6 sketch / chat / style triple stayed in the
   * store and showed up under the new project. Same for Part 3 /
   * Part 7 / Part 5's custom video URL.
   *
   * Centralising the hydrate-or-reset here means every caller gets
   * the same correct behaviour for free, and the scattered guards
   * have all been removed.
   *
   * `useSlideStore().loadSnapshot()` is intentionally NOT called
   * here — the slide store is loaded by each route handler with
   * project-specific context (e.g. `MyLessons.resumeProject` may
   * also need to wire `part5VideoDataUrl` into Part-5's legacy
   * `setVideo()` API). Keeping slides outside this function avoids
   * accidentally re-hydrating the canvas while the route is still
   * setting up.
   */
  function setActiveProject(id: string) {
    // 2026-05-29 — Raise the hydration flag for the duration of the
    // loadSnapshot / reset burst so the autosave watcher (in
    // CreateLesson.vue) doesn't bounce the freshly-loaded data back
    // to the server. 200 ms is generous: the actual mutations are
    // synchronous and Vue flushes its reactive effects on the next
    // microtask; we leave the flag up a beat longer just in case a
    // child component (e.g. Part6AssistancePanel's initChat) does
    // some onMounted bookkeeping that mutates the store too.
    _isHydrating.value = true

    activeProjectId.value = id
    const proj = projects.value.find(p => p.id === id)
    if (!proj) {
      _isHydrating.value = false
      return
    }

    // Hydrate-or-reset every per-part store so the previous
    // project's state cannot leak into this one. See block comment
    // above for the full rationale.
    const snap = proj.snapshot
    const part3 = usePart3Store()
    const part5 = usePart5Store()
    const part6 = usePart6Store()
    const part7 = usePart7Store()

    if (snap.part3Snapshot) part3.loadSnapshot(snap.part3Snapshot)
    else part3.reset()

    if (snap.part6Snapshot) part6.loadSnapshot(snap.part6Snapshot)
    else part6.reset()

    if (snap.part7Snapshot) part7.loadSnapshot(snap.part7Snapshot)
    else part7.reset()

    // Part 5 doesn't have a full snapshot — only `part5CustomUrl`
    // travels in the snapshot. Apply it if present, else clear any
    // residual custom source from the previous project.
    if (snap.part5CustomUrl) part5.setPastedUrl(snap.part5CustomUrl)
    else part5.clearCustom()

    setTimeout(() => { _isHydrating.value = false }, 200)
  }

  /**
   * Fetch projects from the API and replace the local list.
   * Called after a successful login to hydrate the user's project list.
   * Falls back gracefully if the API call fails.
   */
  async function loadFromAPI(): Promise<void> {
    if (!getToken()) return
    try {
      const apiProjects = await apiGet<ApiProject[]>('/api/projects')
      const mapped: Project[] = apiProjects.map(p => ({
        id: p.id,
        name: p.name,
        createdAt: p.created_at,
        status: (p.status as Project['status']) ?? 'draft',
        snapshot: p.snapshot,
        part5VideoName: p.part5_video_name ?? undefined,
        meta: p.meta ?? undefined,
      }))
      projects.value = migrateProjects(mapped)

      // Restore chatbot histories from DB snapshots. Part-5 custom
      // URL hydration moved into `setActiveProject()` below — see
      // its docstring for the rationale; we no longer need the
      // `part5Store` reference here.
      const chatbotStore = useChatbotStore()
      for (const p of projects.value) {
        const history = p.snapshot.chatbotHistory
        if (history) {
          for (const [partId, msgs] of Object.entries(history)) {
            chatbotStore.setMessages(`${p.id}:${partId}`, msgs)
          }
        }
      }
      // Restore part-specific state for the active project. We just
      // call `setActiveProject(id)` for the side effect — it does
      // the full hydrate-or-reset for every per-part store and is
      // the single source of truth for this logic now.
      if (activeProjectId.value) {
        setActiveProject(activeProjectId.value)
      }
    } catch (err) {
      console.error('[projects] loadFromAPI failed, keeping local data', err)
    }
  }

  // Wipe in-memory and localStorage state — called on sign-out so the
  // next user who logs in on this device starts with a clean slate.
  //
  // 2026-05-29 — Also resets every per-part store so the next user
  // doesn't see the previous user's Part-6 sketch / chat / Part-3
  // stories / Part-7 feedback. (The slide store and chatbot store
  // were already cleared elsewhere on sign-out via
  // `userStore.clearAll()` and `useChatbotStore().clearProject()`.)
  function clearLocal() {
    projects.value = []
    activeProjectId.value = null
    localStorage.removeItem(`${STORAGE_KEY}-list`)
    localStorage.removeItem(`${STORAGE_KEY}-active`)
    usePart3Store().reset()
    usePart5Store().clearCustom()
    usePart6Store().reset()
    usePart7Store().reset()
  }

  // ──────────────────────────────────────────────────────────────────
  // localStorage persistence — defensive against the 5-10 MB quota
  //
  // 2026-06-08 incident — pilot teacher `BLOOM-2026-B` saw the console
  // fill with `QuotaExceededError: Failed to execute 'setItem' on
  // 'Storage': Setting the value of 'artbloom-projects-list' exceeded
  // the quota.` followed by the watcher silently dying and the
  // autosave loop never running again. Root cause: as soon as the
  // teacher generated a couple of Part-6 style transfers (each is a
  // ~2-4 MB base64 PNG embedded in the snapshot) the JSON of the
  // full projects array overflowed Safari's 5 MB / Chrome's 10 MB
  // per-origin quota. Because the original line did the setItem
  // inline in the watcher callback, the throw aborted the watcher
  // and every subsequent edit silently failed to persist anywhere.
  //
  // Strategy (cascade three escalating attempts before giving up):
  //   1. Try the naïve full-fidelity write. 95% of teachers fit in
  //      quota; this is the cheapest path.
  //   2. On QuotaExceededError, write a SLIMMED copy that drops the
  //      heaviest fields (Part-6 generated-image data URLs, embedded
  //      Part-7 student-work base64, Part-3 video data URLs) from
  //      each project's snapshot. The Postgres copy on the server
  //      still has the full fidelity — localStorage is just a fast
  //      "what projects exist" cache; users on the same device will
  //      see their work materialise from `loadFromAPI()` after login.
  //   3. If even the slim write fails (e.g. a single huge sketch
  //      can't be slimmed further), swallow the error so the watcher
  //      survives, show ONE warning toast (rate-limited via the flag
  //      below so we don't spam the teacher on every keystroke),
  //      and rely entirely on the API copy as the source of truth.
  //
  // Note: we don't reach for IndexedDB here because the existing
  // server-side persistence already does the job of "lots of bytes
  // on disk"; the localStorage cache only needs to survive a tab
  // refresh while the user is offline / before login.
  let quotaToastShown = false

  function isQuotaError(err: unknown): boolean {
    if (!(err instanceof Error)) return false
    // Spec name + WebKit's older numeric code (22) + Firefox's
    // distinct name. We accept any of the three so this works
    // across the iPadOS Safari / Chrome / Firefox matrix our
    // pilot teachers use.
    return (
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      (err as { code?: number }).code === 22
    )
  }

  /**
   * Recursively rebuild `value` with any string field longer than
   * `dropThreshold` and starting with `data:` replaced by `null`.
   * This targets the three known offenders (Part-6 generated PNGs,
   * Part-7 student-work uploads, Part-3 video frames) without
   * needing to enumerate every snapshot key — anything else of
   * comparable size is almost certainly also a data URL we don't
   * want in localStorage.
   *
   * 64 KB is a deliberately conservative threshold: typical legit
   * string fields in the snapshot (story text, chatbot history)
   * top out around 10-20 KB.
   */
  function stripHeavyDataUrls(value: unknown, dropThreshold = 65_536): unknown {
    if (typeof value === 'string') {
      if (value.length > dropThreshold && value.startsWith('data:')) return null
      return value
    }
    if (Array.isArray(value)) return value.map(v => stripHeavyDataUrls(v, dropThreshold))
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = stripHeavyDataUrls(v, dropThreshold)
      }
      return out
    }
    return value
  }

  function persistProjects(val: Project[]) {
    try {
      // Attempt 1 — full fidelity
      localStorage.setItem(`${STORAGE_KEY}-list`, JSON.stringify(val))
      return
    } catch (err) {
      if (!isQuotaError(err)) {
        // Some other failure (e.g. SecurityError in a sandboxed
        // iframe) — log once and move on. The watcher must survive.
        console.warn('[projects] localStorage write failed (non-quota)', err)
        return
      }
    }
    try {
      // Attempt 2 — slim copy with heavy data URLs removed
      const slim = stripHeavyDataUrls(val)
      localStorage.setItem(`${STORAGE_KEY}-list`, JSON.stringify(slim))
      if (!quotaToastShown) {
        quotaToastShown = true
        console.info(
          '[projects] localStorage over quota — persisted slim cache; ' +
          'API copy remains the source of truth',
        )
      }
      return
    } catch (err) {
      // Attempt 3 — give up gracefully. The next loadFromAPI() will
      // rehydrate everything from the server.
      if (!quotaToastShown) {
        quotaToastShown = true
        console.warn(
          '[projects] localStorage write skipped — over quota even after slimming. ' +
          'Cached state will rebuild from the API on next login.',
          err,
        )
        // Only show the toast if we're actually authed; otherwise
        // there's no server copy to lean on and the user would see
        // a misleading message.
        if (getToken()) {
          useToastStore().show(
            '本地缓存已满；课件已同步到云端，下次登录后会自动恢复。',
            'warning',
          )
        }
      }
    }
  }

  watch(projects, val => persistProjects(val), { deep: true })
  watch(activeProjectId, val => {
    // Tiny string — never overflows quota on its own, but wrap in a
    // try/catch anyway so it can't take down its sibling watcher.
    try {
      localStorage.setItem(`${STORAGE_KEY}-active`, JSON.stringify(val))
    } catch (err) {
      console.warn('[projects] failed to persist activeProjectId', err)
    }
  })


  return {
    projects, activeProjectId, activeProject, activeLessonId,
    _isHydrating,
    createProject, saveCurrentProject, deleteProject, setActiveProject, loadFromAPI, clearLocal,
  }
})
