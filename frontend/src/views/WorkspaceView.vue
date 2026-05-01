<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import WorkspaceHeader from '@/components/workspace/WorkspaceHeader.vue'
import WorkspaceContent from '@/components/workspace/WorkspaceContent.vue'
import WorkspaceSidebar from '@/components/workspace/WorkspaceSidebar.vue'
import WorkspaceChatbot from '@/components/workspace/WorkspaceChatbot.vue'
import Part3Content from '@/components/workspace/part3/Part3Content.vue'
import Part3StoryPanel from '@/components/workspace/part3/Part3StoryPanel.vue'
import Part3AnimationPanel from '@/components/workspace/part3/Part3AnimationPanel.vue'
import Part5Content from '@/components/workspace/part5/Part5Content.vue'
import Part6Content from '@/components/workspace/part6/Part6Content.vue'
import Part6AssistancePanel from '@/components/workspace/part6/Part6AssistancePanel.vue'
import Part7Placeholder from '@/components/workspace/part7/Part7Placeholder.vue'
import { useSlideStore } from '@/stores/slides'

const slideStore = useSlideStore()
const isPart3 = computed(() => slideStore.activePart === 3)
const isPart5 = computed(() => slideStore.activePart === 5)
const isPart6 = computed(() => slideStore.activePart === 6)
const isPart7 = computed(() => slideStore.activePart === 7)

// Part 3 mode state
const part3Mode = ref<'story' | 'animation'>('story')

// ── Resizable divider ─────────────────────────────────────────────────

const SIDEBAR_WIDTH = 260
const MIN_CONTENT   = 320
const MIN_CHAT      = 240

const chatWidth = ref(0)

onMounted(() => {
  const available = window.innerWidth - SIDEBAR_WIDTH
  chatWidth.value = Math.round(available * (2 / 5))
})

let startX     = 0
let startWidth = 0

function startResize(e: MouseEvent) {
  startX     = e.clientX
  startWidth = chatWidth.value
  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup',   stopResize)
  e.preventDefault()
}

function doResize(e: MouseEvent) {
  const delta     = startX - e.clientX
  const newChat   = startWidth + delta
  const available = window.innerWidth - SIDEBAR_WIDTH
  if (newChat >= MIN_CHAT && available - newChat >= MIN_CONTENT) {
    chatWidth.value = newChat
  }
}

function stopResize() {
  document.removeEventListener('mousemove', doResize)
  document.removeEventListener('mouseup',   stopResize)
}
</script>

<template>
  <div class="workspace">
    <WorkspaceHeader :can-start-teaching="false" />
    <div class="workspace-body">
      <WorkspaceSidebar />

      <!-- Part 3: special layout -->
      <template v-if="isPart3">
        <Part3Content v-model:mode="part3Mode" />
        <div class="resizer" @mousedown="startResize" />
        <div class="chat-panel" :style="{ width: chatWidth + 'px' }">
          <Part3StoryPanel     v-if="part3Mode === 'story'" />
          <Part3AnimationPanel v-else />
        </div>
      </template>

      <!-- Part 5: predefined slide + video upload -->
      <template v-else-if="isPart5">
        <Part5Content />
        <div class="resizer" @mousedown="startResize" />
        <div class="chat-panel" :style="{ width: chatWidth + 'px' }">
          <WorkspaceChatbot />
        </div>
      </template>

      <!-- Part 6: special layout -->
      <template v-else-if="isPart6">
        <Part6Content />
        <div class="resizer" @mousedown="startResize" />
        <div class="chat-panel" :style="{ width: chatWidth + 'px' }">
          <Part6AssistancePanel />
        </div>
      </template>

      <!-- Part 7: placeholder -->
      <template v-else-if="isPart7">
        <Part7Placeholder />
      </template>

      <!-- All other parts: normal layout -->
      <template v-else>
        <WorkspaceContent />
        <div class="resizer" @mousedown="startResize" />
        <div class="chat-panel" :style="{ width: chatWidth + 'px' }">
          <WorkspaceChatbot />
        </div>
      </template>

    </div>
  </div>
</template>

<style scoped>
.workspace {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workspace-body {
  flex: 1;
  display: flex;
  overflow: clip;
  min-height: 0;
}

.resizer {
  width: 4px;
  flex-shrink: 0;
  background: #e5e7eb;
  cursor: col-resize;
  transition: background 0.15s;
}

.resizer:hover,
.resizer:active {
  background: #B2F4BC;
}

.chat-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>
