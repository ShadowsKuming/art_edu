<script setup lang="ts">
/**
 * Part 5 — Making Example.
 *
 * Pilot update 2026-05: instead of asking the teacher to upload their
 * own demo clip, the slide now embeds a curated Bilibili tutorial via
 * iframe. The custom-upload affordance was removed for the pilot
 * because every classroom in the trial uses the same teacher-facing
 * demonstration; the existing `usePart5Store` is left untouched so
 * any project that already has a user-uploaded video saved keeps
 * working when re-opened, but no new uploads can be created from
 * this surface.
 *
 * Source videos (per lesson):
 *   g2v2-u4-l4 《好长好长……》   → https://www.bilibili.com/video/BV1VjVc6tEhK
 *   g2v2-u4-l5 《吸引人的标题》 → https://www.bilibili.com/video/BV155Vc6fEpd
 *   g2v2-u5-l1 《听听画画》     → https://www.bilibili.com/video/BV1ETVc6eENm
 * Bilibili embed reference:
 *   https://player.bilibili.com/player.html?bvid=...&page=1
 *
 * The mapping below is intentionally hard-coded in this component
 * (rather than added to each LKP JSON) because the demo videos are a
 * pilot-only asset — they don't belong in the curriculum schema and
 * the curriculum team prefers to swap them via a code edit. When a
 * new lesson is onboarded, add its BVID here.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSlideStore } from '@/stores/slides'
import { useProjectsStore } from '@/stores/projects'

const slideStore = useSlideStore()
const projectsStore = useProjectsStore()
const { t } = useI18n()

/** Per-lesson demo-video Bilibili BVIDs. Falls back to the U4-L4
 *  ("好长好长……") clip when the active lesson has no mapping yet —
 *  that's the canonical demo and works as a generic placeholder for
 *  legacy projects without `meta.lessonId`. */
const LESSON_VIDEO_MAP: Record<string, string> = {
  'g2v2-u4-l4': 'BV1VjVc6tEhK', // 《好长好长……》
  'g2v2-u4-l5': 'BV155Vc6fEpd', // 《吸引人的标题》
  'g2v2-u5-l1': 'BV1ETVc6eENm', // 《听听画画》
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

/**
 * Bilibili embed URL — recomputed when the active lesson changes
 * (e.g. teacher switches projects via the dashboard). Query params:
 *   • `page=1`         — first segment (only one in this video)
 *   • `high_quality=1` — request the highest available stream
 *   • `danmaku=0`      — hide the floating-comment overlay in class
 *   • `autoplay=0`     — never autoplay, teachers press play manually
 */
const videoEmbedUrl = computed(() => {
  const lessonId = projectsStore.activeLessonId
  const bvid = (lessonId && LESSON_VIDEO_MAP[lessonId]) || DEFAULT_BVID
  return (
    `https://player.bilibili.com/player.html?bvid=${bvid}` +
    `&page=1&high_quality=1&danmaku=0&autoplay=0`
  )
})


function saveAndNext() {
  slideStore.navigateToNextPart()
}
</script>

<template>
  <section class="p5-content">
    <div class="p5-canvas-area">

      <!-- 2026-05: removed the "创意示范" slide title bar and made the
           Bilibili iframe fill the entire slide preview. Per design
           feedback, the title felt redundant (the sidebar Part-5 label
           already says "创意示范") and was eating ~60 px of valuable
           video height. The iframe now sits directly in the white
           preview box. The slide's global-theme background (set via
           Part 1) is still honoured, but it's only visible as a 1-2 px
           seam where the video doesn't reach the rounded corner. -->
      <div class="p5-slide-preview" :style="slideStyle">
        <iframe
          class="p5-video-frame"
          :src="videoEmbedUrl"
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

    </div>

    <div class="p5-footer">
      <button class="p5-save-plain-btn" @click="() => {}">{{ t('content.save') }}</button>
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
  padding: 40px 32px 16px;
  gap: 16px;
  overflow-y: auto;
}

/* 2026-05: dropped the inner padding so the Bilibili iframe stretches
   to the slide preview's edges. The previous 32px padding + slide
   title + nested .p5-video-area wrapper left the video at ~ 700×340
   inside a 760×428 frame — feedback was that the video should fill
   the whole white box. Now `.p5-slide-preview` is a bare container
   and `.p5-video-frame` is `position: absolute; inset: 0`. */
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
