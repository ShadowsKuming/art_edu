<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectsStore } from '@/stores/projects'
import { useSlideStore } from '@/stores/slides'
import { usePart5Store } from '@/stores/part5'
import { useI18n } from 'vue-i18n'
import { toggleLocale } from '@/i18n'

const router = useRouter()
const projectsStore = useProjectsStore()
const slideStore = useSlideStore()
const part5Store = usePart5Store()
const { t, locale } = useI18n()

// Create modal
const showCreateModal = ref(false)
const newName = ref('')

function openCreate() {
  newName.value = ''
  showCreateModal.value = true
}

function confirmCreate() {
  const name = newName.value.trim() || t('dashboard.untitled')
  projectsStore.createProject(name)
  slideStore.reset()
  part5Store.clearVideo()
  showCreateModal.value = false
  router.push('/workspace')
}

function cancelCreate() {
  showCreateModal.value = false
}

// Resume
function resumeProject(id: string) {
  const project = projectsStore.projects.find(p => p.id === id)
  if (!project) return
  projectsStore.setActiveProject(id)
  slideStore.loadSnapshot(project.snapshot)
  if (project.part5VideoDataUrl) {
    part5Store.setVideo(project.part5VideoDataUrl, project.part5VideoName ?? '')
  } else {
    part5Store.clearVideo()
  }
  router.push('/workspace')
}

// Delete
const confirmDeleteId = ref<string | null>(null)

function requestDelete(id: string) {
  confirmDeleteId.value = id
}

function confirmDelete() {
  if (confirmDeleteId.value) {
    projectsStore.deleteProject(confirmDeleteId.value)
    confirmDeleteId.value = null
  }
}

function cancelDelete() {
  confirmDeleteId.value = null
}

// Helpers
function formatDate(iso: string) {
  const loc = locale.value === 'zh' ? 'zh-CN' : 'en-US'
  return new Date(iso).toLocaleDateString(loc, { year: 'numeric', month: 'short', day: 'numeric' })
}

function cardBgStyle(project: typeof projectsStore.projects[0]) {
  const snap = project.snapshot
  if (snap.globalBackground) {
    return { backgroundImage: `url(${snap.globalBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  if (snap.globalBgColor) {
    return { backgroundColor: snap.globalBgColor }
  }
  return { background: 'linear-gradient(135deg, #B2F4BC 0%, #7FEC8F 100%)' }
}
</script>

<template>
  <div class="dashboard">

    <!-- Header -->
    <header class="dash-header">
      <img src="/LOGO.png" alt="ArtBloom" class="dash-logo" />
      <div class="dash-header-right">
        <button class="lang-btn" @click="toggleLocale">{{ locale === 'en' ? '中文' : 'EN' }}</button>
        <button class="btn-new" @click="openCreate">{{ t('dashboard.newLesson') }}</button>
      </div>
    </header>

    <!-- Content -->
    <main class="dash-main">
      <!-- Empty state -->
      <div v-if="projectsStore.projects.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 64 64" fill="none">
            <rect x="8" y="12" width="48" height="40" rx="6" stroke="#d1d5db" stroke-width="2.5"/>
            <path d="M22 28h20M22 36h12" stroke="#d1d5db" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="48" cy="48" r="12" fill="#7FEC8F"/>
            <path d="M48 43v10M43 48h10" stroke="#000" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <h2 class="empty-title">{{ t('dashboard.noLessons') }}</h2>
        <p class="empty-desc">{{ t('dashboard.noLessonsDesc') }}</p>
        <button class="btn-new" @click="openCreate">{{ t('dashboard.newLesson') }}</button>
      </div>

      <!-- Project grid -->
      <div v-else class="project-grid">
        <div
          v-for="project in projectsStore.projects"
          :key="project.id"
          class="project-card"
        >
          <!-- Thumbnail -->
          <div class="card-thumbnail" :style="cardBgStyle(project)" />

          <!-- Body -->
          <div class="card-body">
            <h3 class="card-name">{{ project.name }}</h3>
            <p class="card-progress">
              {{ t('dashboard.partProgress', { n: project.snapshot.maxUnlockedPart }) }}
            </p>
            <p class="card-date">{{ formatDate(project.createdAt) }}</p>
          </div>

          <!-- Footer -->
          <div class="card-footer">
            <button class="btn-delete" :title="t('dashboard.deleteLesson')" @click="requestDelete(project.id)">
              <svg viewBox="0 0 20 20" fill="none">
                <path d="M6 4V3a1 1 0 011-1h6a1 1 0 011 1v1M3 4h14M5 4l1 12a1 1 0 001 1h6a1 1 0 001-1l1-12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="btn-resume" @click="resumeProject(project.id)">{{ t('dashboard.resume') }}</button>
          </div>
        </div>
      </div>
    </main>

    <!-- Create modal -->
    <div v-if="showCreateModal" class="modal-backdrop" @click.self="cancelCreate">
      <div class="modal">
        <h2 class="modal-title">{{ t('dashboard.modal.newTitle') }}</h2>
        <input
          v-model="newName"
          class="modal-input"
          :placeholder="t('dashboard.modal.namePlaceholder')"
          autofocus
          @keydown.enter="confirmCreate"
          @keydown.esc="cancelCreate"
        />
        <div class="modal-actions">
          <button class="modal-btn-cancel" @click="cancelCreate">{{ t('dashboard.modal.cancel') }}</button>
          <button class="modal-btn-create" @click="confirmCreate">{{ t('dashboard.modal.create') }}</button>
        </div>
      </div>
    </div>

    <!-- Delete confirmation -->
    <div v-if="confirmDeleteId" class="modal-backdrop" @click.self="cancelDelete">
      <div class="modal">
        <h2 class="modal-title">{{ t('dashboard.modal.deleteTitle') }}</h2>
        <p class="modal-desc">{{ t('dashboard.modal.deleteDesc') }}</p>
        <div class="modal-actions">
          <button class="modal-btn-cancel" @click="cancelDelete">{{ t('dashboard.modal.cancel') }}</button>
          <button class="modal-btn-delete" @click="confirmDelete">{{ t('dashboard.modal.delete') }}</button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.dashboard {
  min-height: 100vh;
  background: #F3F4F4;
  display: flex;
  flex-direction: column;
}

/* Header */
.dash-header {
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  padding: 14px 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.dash-logo {
  height: 40px;
  width: auto;
}

.dash-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lang-btn {
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1.5px solid #d1d5db;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  color: #374151;
}
.lang-btn:hover { border-color: #7FEC8F; background: #f0fdf4; }

.btn-new {
  height: 40px;
  padding: 0 22px;
  background: #7FEC8F;
  color: #000;
  border: none;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 2px 3px 6px rgba(0,0,0,0.10);
}

.btn-new:hover { transform: translateY(-1px) scale(1.02); }

/* Main */
.dash-main {
  flex: 1;
  padding: 48px 40px;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 60vh;
  text-align: center;
}

.empty-icon svg { width: 72px; height: 72px; }

.empty-title {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.empty-desc {
  font-size: 15px;
  color: #6b7280;
  margin: 0;
}

/* Grid */
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

/* Card */
.project-card {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.15s, transform 0.15s;
}

.project-card:hover {
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
  transform: translateY(-2px);
}

.card-thumbnail {
  width: 100%;
  aspect-ratio: 16 / 9;
  flex-shrink: 0;
}

.card-body {
  padding: 16px 18px 10px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-name {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-progress {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

.card-date {
  font-size: 12px;
  color: #9ca3af;
  margin: 0;
}

.card-footer {
  padding: 10px 18px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.btn-delete {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: #f3f4f6;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 7px;
}

.btn-delete:hover { background: #fee2e2; color: #dc2626; }

.btn-delete svg { width: 18px; height: 18px; }

.btn-resume {
  height: 34px;
  padding: 0 20px;
  background: #7FEC8F;
  color: #000;
  border: none;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.btn-resume:hover { transform: translateY(-1px) scale(1.02); }

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}

.modal {
  background: #fff;
  border-radius: 20px;
  padding: 32px 36px;
  width: 380px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.16);
}

.modal-title {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.modal-desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.modal-input {
  height: 44px;
  border: 1.5px solid #e5e7eb;
  border-radius: 12px;
  padding: 0 14px;
  font-size: 15px;
  font-family: inherit;
  color: #111827;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

.modal-input:focus { border-color: #7FEC8F; }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.modal-btn-cancel {
  height: 40px;
  padding: 0 20px;
  background: #e6e6e6;
  color: #374151;
  border: none;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.modal-btn-cancel:hover { background: #d8d8d8; }

.modal-btn-create {
  height: 40px;
  padding: 0 20px;
  background: #7FEC8F;
  color: #000;
  border: none;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.modal-btn-create:hover { transform: translateY(-1px) scale(1.02); }

.modal-btn-delete {
  height: 40px;
  padding: 0 20px;
  background: #dc2626;
  color: #fff;
  border: none;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.modal-btn-delete:hover { background: #b91c1c; }
</style>
