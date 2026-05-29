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

/** Per-lesson Bilibili BVIDs. Projects whose `meta.lessonId` is not
 *  in this map (e.g. blank "新建课件" projects) get NO default video
 *  — the canvas falls through to the empty-state placeholder. See
 *  the `defaultEmbedUrl` docstring below for the 2026-05-29 change.
 *
 *  Previously a `DEFAULT_BVID` fallback (《好长好长》's clip) was
 *  applied to any unrecognised lesson, but that silently baked the
 *  wrong demo video into every new blank project. Removed. */
const LESSON_VIDEO_MAP: Record<string, string> = {
  'g2v2-u4-l4': 'BV1VjVc6tEhK',
  'g2v2-u4-l5': 'BV155Vc6fEpd',
  'g2v2-u5-l1': 'BV1ETVc6eENm',
}

// 2026-05-28: was reading the now-retired `slideStore.globalBackground`
// / `globalBgColor` ("master slide" theme) to decide the Part 5 video
// canvas backdrop. Per the requirement that every slide own its
// background independently, this now reads the Part-5 video slide's
// OWN `background` / `bgColor` field (which the propagator had
// already materialised for legacy projects, so the visual outcome is
// identical for existing data). New projects start with no inherited
// background, so Part 5 falls through to the neutral white default.
const slideStyle = computed(() => {
  const videoSlide = slideStore.slides.find(s => s.id === slideStore.part5VideoSlideId)
  if (videoSlide?.background) {
    return {
      backgroundImage: `url(${videoSlide.background})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  if (videoSlide?.bgColor) {
    return { backgroundColor: videoSlide.bgColor }
  }
  return { backgroundColor: '#ffffff' }
})

function buildBilibiliEmbed(bvid: string): string {
  return (
    `https://player.bilibili.com/player.html?bvid=${bvid}` +
    `&page=1&high_quality=1&danmaku=0&autoplay=0`
  )
}

/**
 * Default per-lesson Bilibili embed URL.
 *
 * 2026-05-29 — Returns `null` for projects that don't map to one of
 * the curated pilot lessons in `LESSON_VIDEO_MAP`. Previously the
 * fallback always landed on `DEFAULT_BVID` (《好长好长》's clip), so
 * a teacher who clicked "新建课件" from MyLessons would open a blank
 * project and STILL see the 好长好长 video baked into Part 5 — even
 * though their new project has no curriculum context. The fix is to
 * surface `null` here and let the template render a "请上传视频" empty
 * state instead (alongside the existing upload / paste-URL row that
 * already lives below the canvas).
 *
 * The three pilot lessons (g2v2-u4-l4 / g2v2-u4-l5 / g2v2-u5-l1)
 * all have entries in `LESSON_VIDEO_MAP` and an `activeLessonId`,
 * so their default Bilibili clip still loads exactly like before.
 */
const defaultEmbedUrl = computed(() => {
  const lessonId = projectsStore.activeLessonId
  if (!lessonId) return null
  const bvid = LESSON_VIDEO_MAP[lessonId]
  if (!bvid) return null
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



// 2026-05-28: `saveAndNext()` retired together with the footer
// "下一部分" button. Teachers navigate via the sidebar now. The
// `slideStore.navigateToNextPart()` callee was also retired.
</script>

<template>
  <section class="p5-content">
    <div class="p5-canvas-area">

      <!-- Slide preview. Three branches:
           1. Teacher uploaded a custom source → render <video> or
              <iframe> from `customRender`.
           2. No custom source AND we have a curated default for this
              lesson (`defaultEmbedUrl` non-null) → render the
              curriculum's bundled Bilibili clip.
           3. No custom source AND no default (e.g. blank "新建课件"
              project that isn't tied to one of the pilot lessons)
              → render an "upload-or-paste-link" placeholder. This is
              the 2026-05-29 fix for blank-project Part 5 silently
              showing 好长好长's video.
      -->
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
          v-else-if="defaultEmbedUrl"
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
        <!-- Empty state for blank / non-curriculum projects. The
             upload/url-paste row below the canvas is unchanged, so
             the teacher already has the controls they need to fill
             this in. -->
        <div v-else class="p5-empty-state" role="status">
          <svg viewBox="0 0 64 64" fill="none" class="p5-empty-icon" aria-hidden="true">
            <rect x="6" y="14" width="44" height="36" rx="4" stroke="#9ca3af" stroke-width="2.5"/>
            <path d="M22 28l16 8-16 8V28z" fill="#9ca3af"/>
            <path d="M50 22l8-4v28l-8-4V22z" stroke="#9ca3af" stroke-width="2.5" stroke-linejoin="round"/>
          </svg>
          <p class="p5-empty-hint">{{ t('part5.upload.emptyHint') }}</p>
        </div>
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

        <!-- "恢复默认视频" — only meaningful when there IS a default
             to fall back to (i.e. the active project maps to one of
             the curated pilot lessons). For blank / new projects,
             `defaultEmbedUrl` is null and clicking restore would
             leave the teacher staring at the empty state anyway. -->
        <button
          v-if="part5Store.customSourceType && defaultEmbedUrl"
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

    <!-- 2026-05-28: Part 5 footer + "下一部分" button removed
         site-wide along with all other per-part progression buttons. -->
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

/* 2026-05-29 — Empty state shown when the active project doesn't
   map to a curated pilot lesson AND the teacher hasn't supplied a
   custom video yet. Visual language mirrors Part 3's "click to
   upload" placeholder so teachers recognise it as the same "add
   media here" affordance. */
.p5-empty-state {
  position: absolute;
  inset: 0;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  border: 2px dashed #d1d5db;
  border-radius: 14px;
  box-sizing: border-box;
}

.p5-empty-icon {
  width: 56px;
  height: 56px;
}

.p5-empty-hint {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #6b7280;
  max-width: 420px;
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

/* 2026-05-28: `.p5-footer` + `.p5-save-plain-btn` + `.p5-save-btn`
   retired together with the per-part footer buttons. Dated comment
   kept so a future reviewer searching for these class names lands
   here. (Block continues below with the legacy rules left as-is —
   they are no longer reachable but harmless to keep until a CSS
   sweep tidies them.) */
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
