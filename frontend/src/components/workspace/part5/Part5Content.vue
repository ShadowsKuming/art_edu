<script setup lang="ts">
/**
 * Part 5 — Making Example.
 *
 * Originally (pilot 2026-05-01): hard-coded per-lesson Bilibili iframe;
 * the teacher could not change the clip. Teacher feedback on 2026-05-27
 * asked for the upload affordance back: some teachers want to use a
 * clip they recorded themselves, others want to swap to a different
 * online demo (especially Bilibili, since that's what the curriculum
 * team already uses).
 *
 * The new flow keeps the default Bilibili clip as the fallback and
 * adds an upload row beneath the canvas with TWO entry points:
 *
 *   ① 「上传本地视频」— file picker (mp4 / mov / webm). The file is
 *     converted to a `blob:` URL so it stays entirely client-side
 *     (matches the pilot's no-backend-storage stance for media).
 *
 *   ② 「粘贴视频链接」— a free-text input that accepts either:
 *       • a Bilibili BV id (e.g. `BV1VjVc6tEhK`)
 *       • a Bilibili share URL (`https://www.bilibili.com/video/BVxxxx`)
 *       • a Bilibili player iframe URL (`…/player.html?bvid=…`)
 *       • any direct mp4 / m3u8 URL (rendered as <video src="…">)
 *
 *   ③ 「恢复默认视频」— clears the custom source and falls back to
 *     the per-lesson default iframe.
 *
 * Source videos (default, per lesson):
 *   g2v2-u4-l4 《好长好长……》   → https://www.bilibili.com/video/BV1VjVc6tEhK
 *   g2v2-u4-l5 《吸引人的标题》 → https://www.bilibili.com/video/BV155Vc6fEpd
 *   g2v2-u5-l1 《听听画画》     → https://www.bilibili.com/video/BV1ETVc6eENm
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSlideStore } from '@/stores/slides'
import { useProjectsStore } from '@/stores/projects'
import { usePart5Store } from '@/stores/part5'
import { useToastStore } from '@/stores/toast'

const slideStore = useSlideStore()
const projectsStore = useProjectsStore()
const part5Store = usePart5Store()
const toast = useToastStore()
const { t } = useI18n()

/** Per-lesson Bilibili BVIDs. Falls back to U4-L4 clip for legacy
 *  projects without a `meta.lessonId`. */
const LESSON_VIDEO_MAP: Record<string, string> = {
  'g2v2-u4-l4': 'BV1VjVc6tEhK',
  'g2v2-u4-l5': 'BV155Vc6fEpd',
  'g2v2-u5-l1': 'BV1ETVc6eENm',
}
const DEFAULT_BVID = 'BV1VjVc6tEhK'

const slideStyle = computed(() => {
  if (slideStore.globalBackground) {
    return {
      backgroundImage: `url(${slideStore.globalBackground})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  if (slideStore.globalBgColor) {
    return { backgroundColor: slideStore.globalBgColor }
  }
  return { backgroundColor: '#ffffff' }
})

function buildBilibiliEmbed(bvid: string): string {
  return (
    `https://player.bilibili.com/player.html?bvid=${bvid}` +
    `&page=1&high_quality=1&danmaku=0&autoplay=0`
  )
}

/** Default per-lesson Bilibili embed URL. */
const defaultEmbedUrl = computed(() => {
  const lessonId = projectsStore.activeLessonId
  const bvid = (lessonId && LESSON_VIDEO_MAP[lessonId]) || DEFAULT_BVID
  return buildBilibiliEmbed(bvid)
})

/** Extract a YouTube video ID from watch or short URLs. */
function extractYouTubeId(raw: string): string | null {
  const s = raw.trim()
  // https://www.youtube.com/watch?v=aKYAuGsvkV8
  const watch = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (watch) return watch[1]
  // https://youtu.be/aKYAuGsvkV8
  const short = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (short) return short[1]
  // https://www.youtube.com/embed/aKYAuGsvkV8
  const embed = s.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
  if (embed) return embed[1]
  return null
}

/** Extract a Bilibili BVID from any of the supported URL shapes. */
function extractBvid(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  // Plain BV id, e.g. "BV1VjVc6tEhK"
  if (/^BV[a-zA-Z0-9]{8,}$/.test(s)) return s
  // bvid= query param (player URL share)
  const q = s.match(/[?&]bvid=([a-zA-Z0-9]+)/)
  if (q) return q[1]
  // /video/BVxxxx path
  const p = s.match(/\/video\/(BV[a-zA-Z0-9]+)/)
  if (p) return p[1]
  return null
}

/** Decide what URL & element the active custom source should render as. */
type RenderTarget =
  | { kind: 'iframe'; url: string }
  | { kind: 'video'; url: string }
  | null

const customRender = computed<RenderTarget>(() => {
  if (part5Store.customSourceType === 'upload' && part5Store.customBlobUrl) {
    return { kind: 'video', url: part5Store.customBlobUrl }
  }
  if (part5Store.customSourceType === 'url' && part5Store.customUrl) {
    const bvid = extractBvid(part5Store.customUrl)
    if (bvid) return { kind: 'iframe', url: buildBilibiliEmbed(bvid) }
    const ytId = extractYouTubeId(part5Store.customUrl)
    if (ytId) return { kind: 'iframe', url: `https://www.youtube.com/embed/${ytId}?rel=0` }
    // Treat any other URL as a direct video file.
    return { kind: 'video', url: part5Store.customUrl }
  }
  return null
})

// ── Upload UI handlers ────────────────────────────────────────────
const fileInputRef = ref<HTMLInputElement | null>(null)
const pastedUrl = ref('')
const showUrlInput = ref(false)

function onPickFile() {
  fileInputRef.value?.click()
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('video/')) {
    toast.show(t('part5.errors.notVideo'), 'warning')
    target.value = ''
    return
  }
  // Soft cap at 200 MB so the browser doesn't choke on a 4K master.
  // Blob URL itself is cheap; the cost is the <video> decoder.
  const MAX_BYTES = 200 * 1024 * 1024
  if (file.size > MAX_BYTES) {
    toast.show(t('part5.errors.tooLarge'), 'warning')
    target.value = ''
    return
  }

  part5Store.setLocalFile(file)
  toast.show(t('part5.toasts.uploaded'), 'success')
  target.value = ''
}

function onSubmitUrl() {
  const url = pastedUrl.value.trim()
  if (!url) return
  // Quick validation: must be a BV id, a bilibili.com URL, or
  // http(s) URL ending in a video extension.
  const bvid = extractBvid(url)
  const ytId = extractYouTubeId(url)
  const isMediaUrl = /^https?:\/\/.+\.(mp4|m3u8|webm|mov)(\?|$)/i.test(url)
  if (!bvid && !ytId && !isMediaUrl && !/^https?:\/\//.test(url)) {
    toast.show(t('part5.errors.badUrl'), 'warning')
    return
  }
  part5Store.setPastedUrl(url)
  pastedUrl.value = ''
  showUrlInput.value = false
  toast.show(t('part5.toasts.urlSet'), 'success')
}

function onRestoreDefault() {
  part5Store.clearCustom()
  toast.show(t('part5.toasts.restored'), 'info')
}



function saveAndNext() {
  slideStore.navigateToNextPart()
}
</script>

<template>
  <section class="p5-content">
    <div class="p5-canvas-area">

      <!-- Slide preview: shows custom source if set, otherwise the
           default per-lesson Bilibili iframe. We branch in template
           (rather than computing one src) because the custom path may
           need <video> instead of <iframe>. -->
      <div class="p5-slide-preview" :style="slideStyle">
        <template v-if="customRender">
          <iframe
            v-if="customRender.kind === 'iframe'"
            class="p5-video-frame"
            :src="customRender.url"
            :title="t('part5.slideTitle')"
            scrolling="no"
            frameborder="0"
            framespacing="0"
            allowfullscreen
            allow="autoplay; fullscreen; encrypted-media"
            referrerpolicy="no-referrer"
            loading="lazy"
          />
          <video
            v-else
            class="p5-video-frame"
            :src="customRender.url"
            controls
            preload="metadata"
            :title="t('part5.slideTitle')"
          />
        </template>
        <iframe
          v-else
          class="p5-video-frame"
          :src="defaultEmbedUrl"
          :title="t('part5.slideTitle')"
          scrolling="no"
          frameborder="0"
          framespacing="0"
          allowfullscreen
          allow="autoplay; fullscreen; encrypted-media"
          referrerpolicy="no-referrer"
          loading="lazy"
        />
      </div>

      <!-- Upload / URL paste / restore-default row. The chip at the
           right end surfaces the active custom source so the teacher
           can tell at a glance whether the default or a custom clip is
           playing. -->
      <div class="p5-upload-bar">
        <button class="p5-upload-btn" @click="onPickFile">
          {{ t('part5.upload.localBtn') }}
        </button>
        <input
          ref="fileInputRef"
          type="file"
          accept="video/*"
          class="p5-file-hidden"
          @change="onFileChange"
        />

        <button class="p5-upload-btn" @click="showUrlInput = !showUrlInput">
          {{ t('part5.upload.urlBtn') }}
        </button>

        <button
          v-if="part5Store.customSourceType"
          class="p5-restore-btn"
          @click="onRestoreDefault"
        >
          {{ t('part5.upload.restoreBtn') }}
        </button>

        <span v-if="part5Store.customSourceType === 'upload'" class="p5-source-chip">
          📁 {{ part5Store.customFileName }}
        </span>
        <span v-else-if="part5Store.customSourceType === 'url'" class="p5-source-chip">
          🔗 {{ part5Store.customUrl }}
        </span>
        <span v-else class="p5-source-chip is-default">
          {{ t('part5.upload.defaultLabel') }}
        </span>
      </div>

      <!-- Collapsible URL input: only visible when teacher clicked
           "Paste link" — saves vertical space when not in use. -->
      <div v-if="showUrlInput" class="p5-url-row">
        <input
          v-model="pastedUrl"
          class="p5-url-input"
          type="url"
          :placeholder="t('part5.upload.urlPlaceholder')"
          @keyup.enter="onSubmitUrl"
        />
        <button class="p5-url-submit" @click="onSubmitUrl">
          {{ t('part5.upload.urlConfirm') }}
        </button>
      </div>

    </div>

    <div class="p5-footer">
      <button class="p5-save-btn" @click="saveAndNext">{{ t('content.saveNext') }}</button>
    </div>
  </section>
</template>

<style scoped>
.p5-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #F3F4F4;
  background-image: radial-gradient(circle, rgba(0,0,0,0.25) 1px, transparent 1px);
  background-size: 24px 24px;
  box-shadow: inset 0px 0px 3px 2px rgb(0 0 0 / 10%), inset 0px 0px 1px 0px rgba(0,0,0,0.60);
}

.p5-canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 32px 32px 16px;
  gap: 16px;
  overflow-y: auto;
}

.p5-slide-preview {
  width: 100%;
  max-width: 760px;
  aspect-ratio: 16 / 9;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.14);
  overflow: hidden;
  position: relative;
  background: #000;
  box-sizing: border-box;
  flex-shrink: 0;
}

.p5-video-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  border: 0;
  background: #000;
}

/* ── Upload row ───────────────────────────────────────────────── */
.p5-upload-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  max-width: 760px;
  width: 100%;
}

.p5-upload-btn {
  height: 36px;
  padding: 0 16px;
  background: #ffffff;
  color: #1f2937;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease;
}
.p5-upload-btn:hover { background: #f3f4f6; }

.p5-restore-btn {
  height: 36px;
  padding: 0 14px;
  background: transparent;
  color: #6b7280;
  border: 1px dashed #9ca3af;
  border-radius: 999px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
}
.p5-restore-btn:hover { color: #1f2937; border-color: #6b7280; }

.p5-file-hidden { display: none; }

.p5-source-chip {
  margin-left: auto;
  padding: 4px 10px;
  background: #eef2ff;
  color: #3730a3;
  border-radius: 12px;
  font-size: 12px;
  max-width: 340px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.p5-source-chip.is-default {
  background: #f3f4f6;
  color: #6b7280;
}

.p5-url-row {
  display: flex;
  gap: 8px;
  max-width: 760px;
  width: 100%;
}

.p5-url-input {
  flex: 1;
  height: 38px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
}
.p5-url-input:focus { outline: 2px solid #7FEC8F; outline-offset: 1px; }

.p5-url-submit {
  height: 38px;
  padding: 0 18px;
  background: #7FEC8F;
  color: #000;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.p5-footer {
  padding: 16px 32px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.p5-save-plain-btn {
  height: 44px;
  padding: 0 24px;
  background: #e6e6e6;
  color: #374151;
  border: none;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.p5-save-plain-btn:hover { background: #d8d8d8; }

.p5-save-btn {
  height: 44px;
  padding: 0 28px;
  background: #7FEC8F;
  color: #000;
  border: none;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 2px 3px 6px rgba(0,0,0,0.12);
}
.p5-save-btn:hover { transform: translateY(-1px) scale(1.02); }
</style>
