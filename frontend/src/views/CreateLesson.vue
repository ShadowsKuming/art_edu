<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
import Part7Content from '@/components/workspace/part7/Part7Content.vue'
import TeachingMode from '@/components/workspace/TeachingMode.vue'

import { useSlideStore } from '@/stores/slides'
import { useProjectsStore } from '@/stores/projects'
import { usePart5Store } from '@/stores/part5'
import { usePart3Store } from '@/stores/part3'
import { usePart6Store } from '@/stores/part6'
import { usePart7Store } from '@/stores/part7'
import { apiGet, getToken } from '@/api/client'
import type { ApiProject } from '@/stores/projects'

const route = useRoute()
const router = useRouter()
const slideStore = useSlideStore()
const projectsStore = useProjectsStore()
const part5Store = usePart5Store()
const part3Store = usePart3Store()
const part6Store = usePart6Store()
const part7Store = usePart7Store()
const isPart3 = computed(() => slideStore.activePart === 3)
const isPart5 = computed(() => slideStore.activePart === 5)
const isPart6 = computed(() => slideStore.activePart === 6)
const isPart7 = computed(() => slideStore.activePart === 7)

const canStartTeaching = computed(() => slideStore.slides.length > 0)
const teachingActive = ref(false)

// Auto-save the snapshot to the API whenever the teacher moves to a new part.
// This means every "Next Part" click persists slide data to the DB — not just
// the explicit "Back" button press. The watch fires on change only (not on mount).
watch(
  () => slideStore.activePart,
  () => {
    projectsStore.saveCurrentProject(
      slideStore.getSnapshot(),
      part5Store.videoDataUrl ?? undefined,
      part5Store.videoName || undefined,
    )
  },
)

// Part 3 mode state
const part3Mode = ref<'story' | 'animation'>('story')

// ── Resizable divider ─────────────────────────────────────────────────

const SIDEBAR_WIDTH = 260
const MIN_CONTENT   = 320
const MIN_CHAT      = 240

const chatWidth = ref(0)

onMounted(async () => {
  const available = window.innerWidth - SIDEBAR_WIDTH
  chatWidth.value = Math.round(available * (2 / 5))

  const projectId = route.params.projectId as string

  if (slideStore.slides.length === 0 && projectId) {
    // Check local store first — covers both:
    //   • Fresh navigation (new project just created — definitely in local store)
    //   • Browser refresh from same device (project in localStorage)
    // Only fall back to API when the project isn't local (different device, cleared storage).
    const local = projectsStore.projects.find(p => p.id === projectId)

    if (local) {
      projectsStore.setActiveProject(projectId)
      slideStore.loadSnapshot(local.snapshot)
      if (local.part5VideoName) part5Store.setVideo('', local.part5VideoName)
      if (local.snapshot.part5CustomUrl) part5Store.setPastedUrl(local.snapshot.part5CustomUrl)
      if (local.snapshot.part3Snapshot) part3Store.loadSnapshot(local.snapshot.part3Snapshot)
      if (local.snapshot.part6Snapshot) part6Store.loadSnapshot(local.snapshot.part6Snapshot)
      if (local.snapshot.part7Snapshot) part7Store.loadSnapshot(local.snapshot.part7Snapshot)
    } else if (getToken()) {
      // Not in local store — fetch from API (different device / cleared localStorage)
      try {
        const p = await apiGet<ApiProject>(`/api/projects/${projectId}`)
        projectsStore.setActiveProject(projectId)
        slideStore.loadSnapshot(p.snapshot)
        if (p.part5_video_name) part5Store.setVideo('', p.part5_video_name)
        if (p.snapshot.part5CustomUrl) part5Store.setPastedUrl(p.snapshot.part5CustomUrl)
        if (p.snapshot.part3Snapshot) part3Store.loadSnapshot(p.snapshot.part3Snapshot)
        if (p.snapshot.part6Snapshot) part6Store.loadSnapshot(p.snapshot.part6Snapshot)
        if (p.snapshot.part7Snapshot) part7Store.loadSnapshot(p.snapshot.part7Snapshot)
      } catch {
        router.push('/lessons')
      }
    } else {
      router.push('/lessons')
    }
  } else if (projectId && !projectsStore.activeProjectId) {
    projectsStore.setActiveProject(projectId)
  }
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
    <WorkspaceHeader
      :can-start-teaching="canStartTeaching"
      @start-teaching="teachingActive = true"
    />
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

      <!--
        Part 5 — "创意示范"
        ─────────────────────
        2026-05 — Part 5 now has two slide kinds:
          • The FIRST Part-5 slide is the "video slide" — renders
            the existing `Part5Content` video player UI, lets the
            teacher upload / paste-link / restore the demo video.
            Auto-seeded by `slideStore.navigateToPart(5)` if missing.
            Sidebar shows a "▶ 视频" badge on its thumbnail and
            hides the delete button.
          • Subsequent slides (added by the teacher via the sidebar
            "+" button) are normal blank canvases — same editor as
            Parts 1 / 2 / 4 via `WorkspaceContent`.

        The right-hand chat panel stays as `WorkspaceChatbot` for
        every Part-5 slide (same locale-aware welcome bubble as
        Parts 1 / 2 / 4 / 5; chat history is bucketed per
        `${projectId}:5`).
      -->
      <template v-else-if="isPart5">
        <Part5Content v-if="slideStore.isPart5VideoSlide(slideStore.activeSlideId)" />
        <WorkspaceContent v-else />
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

      <!-- Part 7: student-work commenter (LKP-driven) -->
      <template v-else-if="isPart7">
        <Part7Content />
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

  <!-- Fullscreen teaching mode overlay -->
  <TeachingMode v-if="teachingActive" @close="teachingActive = false" />
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
