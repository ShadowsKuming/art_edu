/**
 * Tiny single-slot toast store.
 *
 * Designed for transient "thing happened" confirmations (e.g. "Saved to
 * My Lessons"). We deliberately keep this to a single in-flight message
 * — a queued/stacked toast system is over-engineering for the pilot,
 * and calling `show()` while another toast is visible simply replaces
 * the message and resets the timer.
 *
 * Consumed by `<ToastHost />` mounted once in `App.vue`. Any view or
 * component can fire a toast via:
 *
 *     useToastStore().show('Saved to My Lessons')
 *
 * The `tone` is purely visual — the host applies a CSS class so the
 * card can lean green ("success", default), blue ("info"), or amber
 * ("warning"). Add new tones here if/when product asks.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastTone = 'success' | 'info' | 'warning'

interface ToastPayload {
    /** Monotonically-incrementing id so transition keys are unique. */
    id: number
    text: string
    tone: ToastTone
}

export const useToastStore = defineStore('toast', () => {
    const current = ref<ToastPayload | null>(null)
    let counter = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    /**
     * Show `text` for `durationMs` (default 3 s). Calling again before
     * the timer fires replaces the current message — useful for rapid-
     * fire actions where only the latest outcome matters.
     */
    function show(text: string, tone: ToastTone = 'success', durationMs = 3000) {
        if (timer) clearTimeout(timer)
        current.value = { id: ++counter, text, tone }
        timer = setTimeout(() => {
            current.value = null
            timer = null
        }, durationMs)
    }

    function dismiss() {
        if (timer) clearTimeout(timer)
        timer = null
        current.value = null
    }

    return { current, show, dismiss }
})
