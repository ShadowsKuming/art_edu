import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Part 5 — Creative Demonstration video state.
 *
 * 2026-05 update: the pilot originally embedded a curriculum-team
 * Bilibili clip and removed the upload affordance. Teacher feedback
 * (Q2 in the May 27 review) asked us to put uploads back so a teacher
 * can replace the default clip with either:
 *   • a local file (becomes a `blob:` object URL — kept in `customBlobUrl`
 *     so we can revoke it when cleared / replaced), or
 *   • a pasted URL (Bilibili `BVxxxx` short link, `https://…/video/BVxxxx`,
 *     a `bilibili.com/player.html?bvid=…` iframe URL, or any other
 *     embeddable mp4 / m3u8 / iframe link).
 *
 * The Part5Content component decides which source to render by checking
 * `customSourceType`:
 *   - 'upload' → render <video> with `customBlobUrl`
 *   - 'url'    → render either <iframe> (bilibili) or <video> (mp4)
 *   - null     → fall back to the default per-lesson Bilibili iframe.
 *
 * State is intentionally in-memory only (matches the pilot's
 * single-tenant model). Persisting blobs to localStorage is not
 * practical (size, lifetime, security), and pasted URLs are short
 * enough to re-enter if the teacher reloads the project.
 */
export const usePart5Store = defineStore('part5', () => {
  // ── Custom video source (new in 2026-05) ──────────────────────────
  /** 'upload' (local file → blob URL) | 'url' (pasted link) | null. */
  const customSourceType = ref<'upload' | 'url' | null>(null)
  /** Blob URL for the locally-uploaded file. Revoked on clear/replace. */
  const customBlobUrl = ref<string | null>(null)
  /** Original filename — surfaced in the chip below the canvas. */
  const customFileName = ref<string>('')
  /** Mime type — used to decide between `<video>` and `<iframe>`. */
  const customMime = ref<string>('')
  /** Pasted URL exactly as the teacher entered it. */
  const customUrl = ref<string>('')

  // ── Legacy (pre-2026-05) — kept so old saved projects still parse ─
  const videoDataUrl = ref<string | null>(null)
  const videoName = ref<string>('')

  function setLocalFile(file: File) {
    // Revoke any prior blob to avoid leaks.
    if (customBlobUrl.value) URL.revokeObjectURL(customBlobUrl.value)
    customBlobUrl.value = URL.createObjectURL(file)
    customFileName.value = file.name
    customMime.value = file.type || 'video/mp4'
    customSourceType.value = 'upload'
    customUrl.value = ''
  }

  function setPastedUrl(url: string) {
    const trimmed = url.trim()
    if (!trimmed) return
    // Revoke any prior blob to free memory.
    if (customBlobUrl.value) {
      URL.revokeObjectURL(customBlobUrl.value)
      customBlobUrl.value = null
    }
    customUrl.value = trimmed
    customFileName.value = ''
    customMime.value = ''
    customSourceType.value = 'url'
  }

  /** Drop the custom source so the default lesson clip plays again. */
  function clearCustom() {
    if (customBlobUrl.value) URL.revokeObjectURL(customBlobUrl.value)
    customBlobUrl.value = null
    customFileName.value = ''
    customMime.value = ''
    customUrl.value = ''
    customSourceType.value = null
  }

  // Legacy API — superseded by setLocalFile / setPastedUrl. Kept so
  // anything in the codebase that still calls `usePart5Store().setVideo`
  // (e.g. saved-project rehydration) doesn't break.
  function setVideo(dataUrl: string, name: string) {
    videoDataUrl.value = dataUrl
    videoName.value = name
  }
  function clearVideo() {
    videoDataUrl.value = null
    videoName.value = ''
  }

  return {
    customSourceType,
    customBlobUrl,
    customFileName,
    customMime,
    customUrl,
    videoDataUrl,
    videoName,
    setLocalFile,
    setPastedUrl,
    clearCustom,
    setVideo,
    clearVideo,
  }
})
