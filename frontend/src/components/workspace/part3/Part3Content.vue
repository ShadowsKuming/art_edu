<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePart3Store } from '@/stores/part3'
import { useSlideStore } from '@/stores/slides'
import { useToastStore } from '@/stores/toast'
import { useI18n } from 'vue-i18n'

defineProps<{ mode: 'story' | 'animation' }>()
const emit = defineEmits<{ 'update:mode': [mode: 'story' | 'animation'] }>()

const store = usePart3Store()
const slideStore = useSlideStore()
const toastStore = useToastStore()
const { t, locale } = useI18n()


const selectedVersionIdx = ref<number | null>(null)

// Sync active pair with active slide
watch(
  () => slideStore.activeSlideId,
  (id) => {
    if (id && slideStore.slides.find(s => s.id === id)?.partId === 3) {
      store.ensurePair(id)
      selectedVersionIdx.value = null
    }
  },
  { immediate: true },
)

const hasPair  = computed(() => !!store.activePairId)
const hasStory = computed(() => !!store.storyData)
const hasAnim  = computed(() => store.animationVersions.length > 0)

const activeVideoUrl = computed(() => {
  if (selectedVersionIdx.value === null) return null
  const v = store.animationVersions[selectedVersionIdx.value]
  return v?.status === 'done' ? v.videoUrl : null
})

function selectVersion(i: number) {
  if (store.animationVersions[i]?.status === 'done') {
    selectedVersionIdx.value = i
  }
}

async function onStoryClick() {
  // 2026-06-08 — Global single-generation gate. If another artwork
  // is currently generating (story or animation, anywhere in any
  // pair), don't start a new one — show a toast and bail. Switching
  // to "story" view (without firing generation) IS allowed: the
  // teacher should still be able to *read* the existing story while
  // a different artwork is mid-generation.
  if (store.isAnyGenerating && !hasStory.value) {
    toastStore.show(
      locale.value === 'zh'
        ? '请先等待完成当前生成内容'
        : 'Please wait for the current generation to finish',
      'info',
    )
    return
  }
  emit('update:mode', 'story')
  if (!hasStory.value) await store.generateStory(locale.value)
}

async function onAnimationClick() {

  // 2026-06-08 — Soft gate: animation generation only makes sense
  // once we have a story to ground it in. Previously the button was
  // hard-`disabled` whenever `!hasStory`, but a disabled button gives
  // the teacher zero feedback (she clicks, nothing happens, no idea
  // why). Pilot feedback from BLOOM-2026-B explicitly called this
  // out as "顺序混乱" because she could *also* tab into the animation
  // panel before generating a story, get a random animation, then
  // wonder why it didn't match her story later. We now:
  //   • leave the button clickable when no story exists,
  //   • on click, surface a toast explaining the order,
  //   • do NOT switch mode (would put the teacher on a useless,
  //     greyed-out animation panel),
  //   • do NOT consume an animation attempt.
  // Viewing existing animations (hasAnim === true) is always allowed
  // even if storyData was somehow cleared — the older animations are
  // still legitimate artefacts of an earlier story.
  if (!hasAnim.value && !hasStory.value) {
    toastStore.show(
      locale.value === 'zh'
        ? '请先生成故事，再来设计动画 ☺'
        : 'Please generate the story first, then design the animation ☺',
      'info',
    )
    return
  }
  // 2026-06-08 — Global single-generation gate, same shape as
  // `onStoryClick`. Allow the teacher to switch INTO animation view
  // when an animation already exists (so she can keep watching it),
  // but block any *new* generation while the lock is held by some
  // other artwork or pair.
  if (store.isAnyGenerating && !hasAnim.value) {
    toastStore.show(
      locale.value === 'zh'
        ? '请先等待完成当前生成内容'
        : 'Please wait for the current generation to finish',
      'info',
    )
    return
  }
  emit('update:mode', 'animation')
  if (!hasAnim.value) await store.generateAnimation()
}

// 2026-06-08 — Tooltip / disabled-aware helpers reused by both
// "生成故事" and "生成动画" buttons. A button is "busy-locked" when
// the global generation lock is held by something OTHER than this
// artwork's currently-running task (otherwise its OWN per-pair
// loading flag handles the disabled state).
const isOwnedByThisArtwork = computed(
  () => store.generatingOwnerPairId === store.activePairId,
)
const busyByOther = computed(
  () => store.isAnyGenerating && !isOwnedByThisArtwork.value,
)
const busyTooltip = computed(() =>
  locale.value === 'zh'
    ? '请先等待完成当前生成内容'
    : 'Please wait for the current generation to finish',
)



// 2026-05-28: `saveAndNext()` retired together with the footer
// "保存" / "下一部分" buttons. Teachers now jump between Parts via
// the sidebar; the chosen animation can be persisted directly from
// `store.saveChosenVideo()` wherever future code needs it. The
// `slideStore.navigateToNextPart()` callee was also retired — see
// the matching deletion in `stores/slides.ts`.
</script>

<template>
  <section class="p3-content">

    <!-- Empty state: no pair yet -->
    <div v-if="!hasPair" class="p3-empty-state">
      <svg viewBox="0 0 48 48" fill="none" class="p3-empty-icon">
        <rect x="4" y="10" width="40" height="28" rx="4" stroke="#d1d5db" stroke-width="2"/>
        <circle cx="17" cy="21" r="4" stroke="#d1d5db" stroke-width="2"/>
        <path d="M4 34l10-10 8 8 6-6 16 12" stroke="#d1d5db" stroke-width="2" stroke-linejoin="round"/>
      </svg>
      <p class="p3-empty-label" v-html="t('part3.emptyState')" />
    </div>

    <template v-else>
      <div class="p3-canvas-area">

        <!-- Image display -->
        <div class="p3-image-wrap">
          <div v-if="!store.imageDataUrl" class="p3-upload-placeholder">
            <svg viewBox="0 0 48 48" fill="none" class="p3-upload-icon">
              <rect x="4" y="10" width="40" height="28" rx="4" stroke="#9ca3af" stroke-width="2"/>
              <circle cx="17" cy="21" r="4" stroke="#9ca3af" stroke-width="2"/>
              <path d="M4 34l10-10 8 8 6-6 16 12" stroke="#9ca3af" stroke-width="2" stroke-linejoin="round"/>
            </svg>
            <p class="p3-upload-label">{{ t('part3.uploadOrPick') }}</p>
          </div>

          <template v-else>
            <video
              v-if="activeVideoUrl"
              :src="activeVideoUrl"
              class="p3-image"
              controls
              autoplay
              loop
            />
            <img v-else :src="store.imageDataUrl" class="p3-image" />
          </template>
        </div>

        <!-- Attempt counter -->
        <p v-if="mode === 'animation' && store.imageDataUrl" class="p3-attempt-counter">
          {{ t('part3.remainingAttempts', { n: store.remainingAttempts }) }}
        </p>

        <!-- Mode buttons -->
        <div class="p3-action-row">
          <button
            class="p3-mode-btn"
            :class="{
              'p3-mode-btn--active': mode === 'story',
              'p3-mode-btn--locked': busyByOther && !hasStory,
            }"
            :disabled="
              !store.imageDataUrl
              || store.storyLoading
              || (busyByOther && !hasStory)
            "
            :title="busyByOther && !hasStory ? busyTooltip : ''"
            @click="onStoryClick"
          >

            <svg viewBox="0 0 20 20" fill="none" class="p3-btn-icon">
              <path d="M4 5h12M4 8h8M4 11h10M4 14h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span v-if="store.storyLoading">{{ t('part3.generating') }}</span>
            <span v-else-if="hasStory">{{ t('part3.story') }}</span>
            <span v-else>{{ t('part3.generateStory') }}</span>
          </button>

          <!-- 2026-06-08 — Removed `!hasStory` from the disabled
               clause so the button stays clickable (handler shows a
               toast). The `p3-mode-btn--locked` modifier dims the
               button visually so the gating is still discoverable
               without surprising the teacher. -->
          <button
            class="p3-mode-btn"
            :class="{
              'p3-mode-btn--active': mode === 'animation',
              'p3-mode-btn--locked':
                (!hasAnim && !hasStory && !!store.imageDataUrl)
                || (busyByOther && !hasAnim),
            }"
            :disabled="
              !store.imageDataUrl
              || (!hasAnim && (store.remainingAttempts <= 0 || store.animationLoading))
              || (busyByOther && !hasAnim)
            "
            :title="
              busyByOther && !hasAnim
                ? busyTooltip
                : (!hasAnim && !hasStory
                    ? (locale === 'zh' ? '请先生成故事，再来设计动画' : 'Generate story first')
                    : '')
            "
            @click="onAnimationClick"
          >

            <svg viewBox="0 0 20 20" fill="none" class="p3-btn-icon">
              <rect x="2" y="5" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
              <path d="M14 8l4-2v8l-4-2V8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
            <span v-if="store.animationLoading">{{ t('part3.generating') }}</span>
            <span v-else-if="hasAnim">{{ t('part3.animation') }}</span>
            <span v-else>{{ t('part3.generateAnimation') }}</span>
            <!-- Subtle 🔒 hint visible only in the locked state so the
                 teacher sees there's a precondition before clicking.
                 SVG lock icon keeps the row visually balanced with
                 the existing video-frame icon. -->
            <svg v-if="!hasAnim && !hasStory && !!store.imageDataUrl"
                 viewBox="0 0 16 16" fill="none" class="p3-btn-lock">
              <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </button>

        </div>

        <!-- Errors -->
        <p v-if="mode === 'story' && store.storyError" class="p3-error">{{ store.storyError }}</p>
        <p v-if="mode === 'animation' && store.animationError" class="p3-error">{{ store.animationError }}</p>

        <!-- Animation version picker -->
        <div v-if="mode === 'animation' && store.animationVersions.length" class="p3-anim-versions">
          <div
            v-for="(v, i) in store.animationVersions"
            :key="v.taskId"
            class="p3-anim-thumb"
            :class="{
              'p3-anim-thumb--pending':  v.status === 'pending',
              'p3-anim-thumb--failed':   v.status === 'failed',
              'p3-anim-thumb--selected': selectedVersionIdx === i,
            }"
            @click="selectVersion(i)"
          >
            <img v-if="store.imageDataUrl" :src="store.imageDataUrl" class="p3-anim-thumb-img" />
            <div class="p3-anim-thumb-overlay" />
            <div v-if="v.status === 'pending'" class="p3-anim-spinner" />
            <div v-if="v.status === 'done'" class="p3-anim-play-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.45)"/>
                <path d="M10 8.5l6 3.5-6 3.5V8.5z" fill="#fff"/>
              </svg>
            </div>
            <span class="p3-anim-label">
              {{ v.status === 'pending' ? t('part3.processing') : v.status === 'failed' ? t('part3.failed') : t('part3.animationN', { n: i + 1 }) }}
            </span>
          </div>
        </div>

      </div>

      <!-- 2026-05-28: footer "保存" / "下一部分" buttons removed.
           The "select an animation version" hint is the only
           footer affordance left, and the whole row collapses when
           there is no hint to show. -->
      <div v-if="mode === 'animation' && !activeVideoUrl" class="p3-footer">
        <span class="p3-footer-hint">{{ t('part3.selectVersionHint') }}</span>
      </div>
    </template>
  </section>
</template>

<style scoped>
.p3-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #F3F4F4;
  background-image: radial-gradient(circle, rgba(0,0,0,0.25) 1px, transparent 1px);
  background-size: 24px 24px;
  box-shadow: inset 0px 0px 3px 2px rgb(0 0 0 / 10%), inset 0px 0px 1px 0px rgba(0,0,0,0.60);
}

.p3-empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #9ca3af;
}
.p3-empty-icon { width: 48px; height: 48px; }
.p3-empty-label { font-size: 14px; margin: 0; }

.p3-canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 40px 32px 16px;
  gap: 16px;
  overflow-y: auto;
}

.p3-image-wrap {
  width: 100%;
  max-width: 760px;
  aspect-ratio: 16 / 9;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}

.p3-upload-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 2px dashed #d1d5db;
  border-radius: 14px;
  box-sizing: border-box;
}
.p3-upload-icon { width: 48px; height: 48px; }
.p3-upload-label { font-size: 14px; color: #9ca3af; margin: 0; }

/* 2026-05: switched from `object-fit: cover` to `contain` so the
   teacher sees the FULL textbook artwork (or upload) inside the
   white frame, even if its aspect ratio differs from the frame's.
   `cover` was cropping the top/bottom of tall paintings (e.g. the
   桃花源 horizontal scrolls) which made teachers think part of the
   picture was missing. Letterbox bars on either side are acceptable
   — and visually less misleading than a silent crop. */
.p3-image { width: 100%; height: 100%; object-fit: contain; display: block; }

.p3-attempt-counter {
  font-size: 13px; color: #6b7280; margin: 0;
  align-self: flex-end; max-width: 760px; width: 100%; text-align: right;
}

.p3-action-row { display: flex; gap: 10px; }

.p3-mode-btn {
  display: flex; align-items: center; gap: 7px;
  height: 38px; padding: 0 18px; border-radius: 999px;
  border: 1.5px solid #d1d5db; background: #fff;
  font-size: 14px; font-family: inherit; font-weight: 500;
  color: #374151; cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
}
.p3-mode-btn:hover:not(:disabled) { border-color: #7FEC8F; }
.p3-mode-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.p3-mode-btn--active { background: #7FEC8F; border-color: #7FEC8F; color: #000; }

/* 2026-06-08 — Soft-locked variant for the 「生成动画」button when
   the story for this artwork hasn't been generated yet. Visually
   dimmer than a regular enabled button but a touch brighter than
   a disabled one, with `cursor: help` so the teacher senses there's
   an explanation if she clicks (which she'll then see in the toast). */
.p3-mode-btn--locked {
  opacity: 0.55;
  cursor: help;
  border-style: dashed;
  border-color: #d1d5db;
  background: #fafafa;
  color: #6b7280;
}
.p3-mode-btn--locked:hover:not(:disabled) {
  border-color: #fbbf24;
  background: #fffbeb;
  opacity: 0.75;
}
.p3-btn-lock {
  width: 13px; height: 13px; margin-left: 2px;
  color: #9ca3af;
}

.p3-btn-icon { width: 16px; height: 16px; }


.p3-error {
  margin: 0; font-size: 12px; color: #dc2626;
  background: #fef2f2; border: 1px solid #fecaca;
  border-radius: 8px; padding: 6px 12px; max-width: 760px;
}

.p3-anim-versions { display: flex; gap: 12px; max-width: 760px; }

.p3-anim-thumb {
  width: 160px; aspect-ratio: 16 / 9; border-radius: 8px;
  overflow: hidden; border: 2px solid #e5e7eb;
  cursor: pointer; position: relative; flex-shrink: 0;
  box-shadow: 0 1px 6px rgba(0,0,0,0.1);
}
.p3-anim-thumb:hover { border-color: #B2F4BC; }
.p3-anim-thumb--pending  { border-color: #fbbf24; cursor: default; }
.p3-anim-thumb--failed   { border-color: #f87171; opacity: 0.7; cursor: default; }
.p3-anim-thumb--selected { border-color: #7FEC8F; box-shadow: 0 0 0 2px #7FEC8F; }
.p3-anim-thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.p3-anim-thumb-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.08); }
.p3-anim-spinner {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.3);
}
.p3-anim-spinner::after {
  content: ''; width: 20px; height: 20px;
  border: 2.5px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
.p3-anim-play-icon { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.p3-anim-play-icon svg { width: 32px; height: 32px; }
.p3-anim-label {
  position: absolute; bottom: 4px; left: 0; right: 0;
  text-align: center; font-size: 11px; font-weight: 600;
  color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.6);
}

@keyframes spin { to { transform: rotate(360deg); } }

.p3-footer {
  padding: 16px 32px;
  display: flex; justify-content: flex-end; align-items: center; gap: 10px;
  flex-shrink: 0;
}
.p3-footer-hint { font-size: 13px; color: #9ca3af; flex: 1; }

/* 2026-05-28: `.p3-save-plain-btn` / `.p3-save-btn` retired together
   with the per-part footer buttons. Dated comment kept so a future
   reviewer searching for the class names lands here. */
</style>
