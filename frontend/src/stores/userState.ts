import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useProjectsStore } from './projects'
import { useChatbotStore } from './chatbot'
import { useUserStore } from './user'
import { usePart3Store } from './part3'
import { usePart5Store } from './part5'
import { usePart6Store } from './part6'
import { usePart7Store } from './part7'
import { useSlideStore } from './slides'

/**
 * Per-user state persistence (Cloudflare R2 user "database").
 *
 * 2026-05 — Pilot teachers reported hitting the browser refresh in
 * the workspace nuked everything. Root cause: every Pinia store
 * lived only in browser memory plus (best case) localStorage with
 * no user scoping. Switch device, clear cache, refresh → all gone.
 *
 * This store orchestrates a server-backed, per-invite-code state
 * blob mediated by `/api/state/{code}` (see `backend/main.py`
 * section 10). The flow on each login:
 *
 *   1. `loadFromCache(code)` — synchronously hydrate child stores
 *      from `localStorage[artbloom-user-state-cache:{code}]` so the
 *      teacher sees their work *instantly* without waiting for the
 *      network round-trip.
 *   2. `loadFromBackend(code)` — fetch the canonical blob from R2,
 *      hydrate child stores again (overwriting whatever the cache
 *      paint left). Backend always wins on conflict.
 *   3. Subsequent mutations to any child store → `scheduleSave()`,
 *      which debounce-PUTs the merged state to R2 *and* mirrors it
 *      to localStorage for the next same-device refresh.
 *
 * The schema below is intentionally an opaque dictionary keyed by
 * Pinia store id, so adding a new store later is a one-line change
 * to `collectPayload()` / `applyPayload()` rather than a
 * server-side migration.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? ''
const CACHE_PREFIX = 'artbloom-user-state-cache:'
const SAVE_DEBOUNCE_MS = 1500
const SCHEMA_VERSION = 1

interface StatePayload {
    schema_version: number
    updated_at?: string
    // Per-store buckets. Each `any` matches the shape the child store
    // exposes via its `dump*` helper (see helpers at bottom of file).
    user?: any
    projects?: any
    chatbot?: any
    slides?: any
    part3?: any
    part5?: any
    part6?: any
    part7?: any
}

export const useUserStateStore = defineStore('userState', () => {
    const currentCode = ref<string | null>(null)
    const hydrating = ref(false)
    const saving = ref(false)
    const lastError = ref<string | null>(null)
    const lastSavedAt = ref<string | null>(null)

    let saveTimer: ReturnType<typeof setTimeout> | null = null

    /** Snapshot every child store into one JSON-safe object. */
    function collectPayload(): StatePayload {
        const userStore = useUserStore()
        const projectsStore = useProjectsStore()
        const chatbotStore = useChatbotStore()
        const slideStore = useSlideStore()
        const part3 = usePart3Store()
        const part5 = usePart5Store()
        const part6 = usePart6Store()
        const part7 = usePart7Store()

        // For each store we read just the JSON-serialisable refs/state.
        // `JSON.parse(JSON.stringify(...))` drops Vue proxies + handles
        // nested reactivity in one shot.
        const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

        return {
            schema_version: SCHEMA_VERSION,
            user: clone({
                inviteCode: userStore.inviteCode,
                displayName: userStore.displayName,
                bio: userStore.bio,
                avatarIndex: userStore.avatarIndex,
            }),
            projects: clone({
                projects: projectsStore.projects,
                activeProjectId: projectsStore.activeProjectId,
            }),
            chatbot: clone({ histories: chatbotStore.histories }),
            slides: clone(slideStore.getSnapshot()),
            part3: clone({
                pairs: part3.pairs,
                activePairId: part3.activePairId,
            }),
            part5: clone({
                videoDataUrl: (part5 as any).videoDataUrl ?? null,
                videoName: (part5 as any).videoName ?? null,
            }),
            part6: clone((part6 as any).$state ?? {}),
            part7: clone((part7 as any).$state ?? {}),
        }
    }

    /** Apply a payload back into the child stores. */
    function applyPayload(payload: StatePayload | null) {
        if (!payload) return
        const userStore = useUserStore()
        const projectsStore = useProjectsStore()
        const chatbotStore = useChatbotStore()
        const slideStore = useSlideStore()
        const part3 = usePart3Store()
        const part5 = usePart5Store()
        const part6 = usePart6Store()
        const part7 = usePart7Store()

        if (payload.user) {
            const u = payload.user
            if (u.inviteCode) userStore.setInviteCode(u.inviteCode)
            if (typeof u.displayName === 'string') userStore.setDisplayName(u.displayName)
            if (typeof u.bio === 'string') userStore.setBio(u.bio)
            if (typeof u.avatarIndex === 'number') userStore.setAvatarIndex(u.avatarIndex)
        }
        if (payload.projects) {
            // Pinia stores expose `$patch` for batched mutation. Falls
            // back to direct assignment if the helper isn't present.
            if (Array.isArray(payload.projects.projects)) {
                ; (projectsStore as any).projects = payload.projects.projects
            }
            if (typeof payload.projects.activeProjectId !== 'undefined') {
                ; (projectsStore as any).activeProjectId = payload.projects.activeProjectId
            }
        }
        if (payload.chatbot && payload.chatbot.histories) {
            ; (chatbotStore as any).histories = payload.chatbot.histories
        }
        if (payload.slides) {
            try {
                slideStore.loadSnapshot(payload.slides)
            } catch (e) {
                console.warn('[userState] slides loadSnapshot failed:', e)
            }
        }
        if (payload.part3) {
            if (Array.isArray(payload.part3.pairs)) {
                ; (part3 as any).pairs = payload.part3.pairs
            }
            if (typeof payload.part3.activePairId !== 'undefined') {
                ; (part3 as any).activePairId = payload.part3.activePairId
            }
        }
        if (payload.part5) {
            const p5 = payload.part5
            if (p5.videoDataUrl) {
                ; (part5 as any).setVideo?.(p5.videoDataUrl, p5.videoName ?? '')
            } else {
                ; (part5 as any).clearVideo?.()
            }
        }
        if (payload.part6 && typeof (part6 as any).$patch === 'function') {
            try { (part6 as any).$patch(payload.part6) } catch { /* swallow */ }
        }
        if (payload.part7 && typeof (part7 as any).$patch === 'function') {
            try { (part7 as any).$patch(payload.part7) } catch { /* swallow */ }
        }
    }

    function cacheKey(code: string): string {
        return CACHE_PREFIX + code.toUpperCase()
    }

    /** Synchronously hydrate from localStorage cache. */
    function loadFromCache(code: string): boolean {
        try {
            const raw = localStorage.getItem(cacheKey(code))
            if (!raw) return false
            applyPayload(JSON.parse(raw))
            return true
        } catch (e) {
            console.warn('[userState] cache load failed:', e)
            return false
        }
    }

    /** Asynchronously fetch canonical state from backend → apply. */
    async function loadFromBackend(code: string): Promise<void> {
        if (!code) return
        hydrating.value = true
        lastError.value = null
        try {
            const res = await fetch(
                `${API_BASE}/api/state/${encodeURIComponent(code.toUpperCase())}`,
                { headers: { 'Cache-Control': 'no-store' } },
            )
            if (res.status === 204) {
                // No state yet for this user — nothing to hydrate. The cache
                // load (if any) already ran; otherwise stores stay at their
                // initial state.
                return
            }
            if (res.status === 503) {
                console.info('[userState] backend persistence disabled (503)')
                return
            }
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`)
            }
            const payload = (await res.json()) as StatePayload
            applyPayload(payload)
            // Mirror to localStorage cache for next refresh.
            try {
                localStorage.setItem(cacheKey(code), JSON.stringify(payload))
            } catch { /* quota — ignore */ }
        } catch (e: any) {
            lastError.value = e?.message ?? String(e)
            console.warn('[userState] backend load failed:', e)
        } finally {
            hydrating.value = false
        }
    }

    /** Persist current state to backend (debounced) + cache mirror. */
    function scheduleSave(): void {
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = setTimeout(() => { void flushSave() }, SAVE_DEBOUNCE_MS)
    }

    async function flushSave(): Promise<void> {
        if (saveTimer) {
            clearTimeout(saveTimer)
            saveTimer = null
        }
        const code = currentCode.value
        if (!code) return
        const payload = collectPayload()
        // Cache write first — even if backend fails the local snapshot
        // survives same-device refresh.
        try {
            localStorage.setItem(cacheKey(code), JSON.stringify(payload))
        } catch (e) {
            console.warn('[userState] cache write failed (likely quota):', e)
        }
        saving.value = true
        lastError.value = null
        try {
            const res = await fetch(
                `${API_BASE}/api/state/${encodeURIComponent(code.toUpperCase())}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ payload }),
                },
            )
            if (res.status === 503) {
                console.info('[userState] backend save skipped (503 not configured)')
                return
            }
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`)
            }
            const data = await res.json().catch(() => ({}))
            lastSavedAt.value = data.updated_at ?? new Date().toISOString()
        } catch (e: any) {
            lastError.value = e?.message ?? String(e)
            console.warn('[userState] backend save failed:', e)
        } finally {
            saving.value = false
        }
    }

    /** Called when the active invite code changes. */
    async function activateUser(code: string | null): Promise<void> {
        if (saveTimer && currentCode.value) {
            // Flush any pending save for the *previous* user before
            // switching context.
            await flushSave()
        }
        currentCode.value = code ? code.toUpperCase() : null
        if (!code) return
        loadFromCache(code)
        await loadFromBackend(code)
    }

    return {
        currentCode,
        hydrating,
        saving,
        lastError,
        lastSavedAt,
        activateUser,
        loadFromCache,
        loadFromBackend,
        scheduleSave,
        flushSave,
    }
})
