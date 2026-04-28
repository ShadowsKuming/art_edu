<script setup lang="ts">
import { ref } from 'vue'
import { usePart3Store } from '@/stores/part3'

type Tab = 'story' | 'design' | 'sound'

const activeTab     = ref<Tab>('story')
const selectedChoice = ref(0)
const store          = usePart3Store()
</script>

<template>
  <div class="sp-panel">

    <!-- Header -->
    <div class="sp-header">
      <div class="sp-tabs">
        <button
          v-for="t in (['story', 'design', 'sound'] as Tab[])"
          :key="t"
          class="sp-tab"
          :class="{ 'sp-tab--active': activeTab === t }"
          @click="activeTab = t"
        >
          {{ t === 'story' ? 'Story Preview' : t === 'design' ? 'Design Rationale' : 'Sound Design' }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.storyLoading" class="sp-loading">
      <div class="sp-spinner" />
      <p>Generating story from your artwork…</p>
    </div>

    <!-- Error -->
    <div v-else-if="store.storyError" class="sp-error">
      <p>{{ store.storyError }}</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="!store.storyData" class="sp-empty">
      <p>Upload an artwork image and click <strong>Generate Story</strong> to begin.</p>
    </div>

    <!-- Story Preview tab -->
    <div v-else-if="activeTab === 'story'" class="sp-body">
      <h3 class="sp-section-title">Part 1: First Half of the Story</h3>
      <p class="sp-text">{{ store.storyData.part1 }}</p>

      <h3 class="sp-section-title">Part 2: Interactive Choices</h3>
      <p class="sp-subtext">Please choose how you would like the story to continue:</p>
      <div class="sp-choices">
        <button
          v-for="c in store.storyData.choices"
          :key="c.id"
          class="sp-choice"
          :class="{ 'sp-choice--selected': selectedChoice === c.id }"
          @click="selectedChoice = c.id"
        >
          <span class="sp-choice-dot" />
          <span><strong>{{ c.label }}</strong> – {{ c.desc }}</span>
        </button>
      </div>

      <h3 class="sp-section-title">Part 3: Second Half</h3>
      <p class="sp-text">{{ store.storyData.part3 }}</p>
    </div>

    <!-- Design Rationale tab -->
    <div v-else-if="activeTab === 'design'" class="sp-body">
      <h3 class="sp-section-title">Design Rationale</h3>
      <p class="sp-text">{{ store.storyData.designRationale }}</p>
    </div>

    <!-- Sound Design tab -->
    <div v-else class="sp-body">
      <h3 class="sp-section-title">Sound Design</h3>
      <p class="sp-text" style="white-space: pre-line;">{{ store.storyData.soundDesign }}</p>
    </div>

  </div>
</template>

<style scoped>
.sp-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f0fdf4;
  overflow: hidden;
}

.sp-header {
  flex-shrink: 0;
  border-bottom: 1px solid #d1fae5;
}

.sp-tabs {
  display: flex;
  padding: 16px 16px 0;
  gap: 4px;
}

.sp-tab {
  padding: 8px 14px;
  border-radius: 8px 8px 0 0;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
}

.sp-tab:hover { color: #111827; }
.sp-tab--active { background: #7FEC8F; color: #000; font-weight: 600; }

.sp-loading,
.sp-error,
.sp-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 32px 24px;
  text-align: center;
}

.sp-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(127, 236, 143, 0.3);
  border-top-color: #7FEC8F;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.sp-loading p, .sp-empty p { font-size: 13px; color: #6b7280; margin: 0; }
.sp-error p { font-size: 13px; color: #dc2626; margin: 0; }

.sp-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sp-section-title { margin: 0; font-size: 14px; font-weight: 700; color: #111827; }
.sp-subtext       { margin: 0; font-size: 13px; color: #6b7280; }
.sp-text          { margin: 0; font-size: 13px; color: #374151; line-height: 1.7; }

.sp-choices { display: flex; flex-direction: column; gap: 8px; }

.sp-choice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1.5px solid transparent;
  background: #fff;
  font-size: 13px;
  font-family: inherit;
  color: #374151;
  text-align: left;
  cursor: pointer;
  line-height: 1.5;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.sp-choice:hover { border-color: #B2F4BC; }
.sp-choice--selected { background: #B2F4BC; border-color: #7FEC8F; color: #111827; }

.sp-choice-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7FEC8F;
  flex-shrink: 0;
  margin-top: 4px;
}

.sp-choice--selected .sp-choice-dot { background: #16a34a; }
</style>
