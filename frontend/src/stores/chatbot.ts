import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

/**
 * Workspace "Creative Assistant" history store.
 *
 * 2026-05 — refactored from a single flat `messages` array into a
 * map of conversation buckets keyed by `${projectId}:${partId}`.
 *
 * Why:
 *   • Parts 1 / 2 / 4 / 5 each have their own welcome + intent chips
 *     authored under `chatbot.byPart.<n>.*`. The previous flat array
 *     leaked one part's user messages into the next part's pane
 *     whenever the teacher had already replied — the "only welcome"
 *     reset gate in `WorkspaceChatbot.vue` would refuse to swap in a
 *     fresh greeting because the array was no longer "just welcome".
 *   • The store was process-singleton, so navigating from project A
 *     back to /dashboard and into project B would surface A's chat
 *     transcript inside B. With buckets keyed by projectId this
 *     can't happen.
 *
 * Lifetime:
 *   • Buckets are persisted to `localStorage` under
 *     `artbloom-chatbot-histories` so a browser reload on the
 *     workspace keeps the user's in-progress conversation visible.
 *   • Project deletion (`projects.ts`) calls `clearProject(id)` so
 *     stale histories can't linger after a teacher trashes a deck.
 *   • Out-of-bucket convenience: callers that don't yet know their
 *     `(projectId, partId)` context can still poke the store, but
 *     they have to provide a key — there's no global `messages`
 *     anymore.
 *
 * Persistence is intentionally simple JSON — no deep-cloning or
 * schema-versioning yet. If the `ChatMessage` shape changes in a
 * non-additive way later, add a `_v` field and a migration here.
 */

const STORAGE_KEY = 'artbloom-chatbot-histories'

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  suggestions?: string[]
}

export type ChatHistories = Record<string, ChatMessage[]>

function loadInitial(): ChatHistories {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as ChatHistories
    }
    return {}
  } catch {
    return {}
  }
}

export const useChatbotStore = defineStore('chatbot', () => {
  const histories = ref<ChatHistories>(loadInitial())

  /**
   * Read-only accessor. Returns an empty array if the bucket doesn't
   * exist yet — callers should NOT mutate the returned array
   * directly; use `setMessages` / `push` so localStorage stays in
   * sync with reactive state.
   */
  function getMessages(key: string): ChatMessage[] {
    return histories.value[key] ?? []
  }

  function setMessages(key: string, msgs: ChatMessage[]) {
    histories.value[key] = msgs
  }

  /**
   * Append one message to the bucket. Creates the bucket if it
   * doesn't already exist.
   */
  function push(key: string, msg: ChatMessage) {
    if (!histories.value[key]) histories.value[key] = []
    histories.value[key].push(msg)
  }

  /**
   * Drop every bucket whose key starts with `${projectId}:`.
   * Called by `useProjectsStore().deleteProject(id)` so deleting a
   * deck doesn't leave orphan conversations in localStorage.
   */
  function clearProject(projectId: string) {
    const prefix = `${projectId}:`
    let changed = false
    for (const k of Object.keys(histories.value)) {
      if (k.startsWith(prefix)) {
        delete histories.value[k]
        changed = true
      }
    }
    // Trigger a fresh JSON serialization even if Vue's deep watcher
    // hasn't fired yet — `delete histories.value[k]` mutates in
    // place so the deep watch should catch it, but this is a cheap
    // belt-and-braces.
    if (changed) histories.value = { ...histories.value }
  }

  // ── Persistence ──────────────────────────────────────────────
  // Deep-watch so any in-place push / setMessages call also writes.
  // Wrapped in try/catch because localStorage can throw under
  // quota-exhausted or private-browsing conditions; we never want
  // a chatbot write to crash the workspace.
  watch(
    histories,
    (val) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
      } catch {
        /* ignore — best-effort persistence */
      }
    },
    { deep: true },
  )

  return {
    histories,
    getMessages,
    setMessages,
    push,
    clearProject,
  }
})
