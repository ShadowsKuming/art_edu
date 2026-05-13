<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectsStore } from '@/stores/projects'
import { useSlideStore } from '@/stores/slides'
import { usePart5Store } from '@/stores/part5'
import { useI18n } from 'vue-i18n'
import DashboardHeader from '@/components/dashboard/DashboardHeader.vue'

const router = useRouter()
const projectsStore = useProjectsStore()
const slideStore = useSlideStore()
const part5Store = usePart5Store()
const { t, locale } = useI18n()

// ── Filter tabs ───────────────────────────────────────────────────────────────
type FilterTab = 'all' | 'completed' | 'drafts' | 'saved' | 'taught'
const activeFilter = ref<FilterTab>('all')

const filteredProjects = computed(() => {
  if (activeFilter.value === 'all') return projectsStore.projects
  return projectsStore.projects.filter(p => (p.status ?? 'draft') === activeFilter.value)
})

// ── Stats ─────────────────────────────────────────────────────────────────────
const totalSlides   = computed(() => projectsStore.projects.reduce((s, p) => s + p.snapshot.slides.length, 0))
const readyCount    = computed(() => projectsStore.projects.filter(p => p.status === 'completed').length)
const draftsCount   = computed(() => projectsStore.projects.filter(p => !p.status || p.status === 'draft').length)
const sharedCount   = computed(() => projectsStore.projects.filter(p => p.status === 'taught').length)

// ── Create modal ──────────────────────────────────────────────────────────────
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

// ── Open / Resume ─────────────────────────────────────────────────────────────
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

// ── Delete ────────────────────────────────────────────────────────────────────
const confirmDeleteId = ref<string | null>(null)

function requestDelete(id: string) { confirmDeleteId.value = id }

function confirmDelete() {
  if (confirmDeleteId.value) {
    projectsStore.deleteProject(confirmDeleteId.value)
    confirmDeleteId.value = null
  }
}

function cancelDelete() { confirmDeleteId.value = null }

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  const loc = locale.value === 'zh' ? 'zh-CN' : 'en-US'
  return new Date(iso).toLocaleDateString(loc, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatTime(iso: string) {
  const loc = locale.value === 'zh' ? 'zh-CN' : 'en-US'
  return new Date(iso).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
}

function thumbnailStyle(project: typeof projectsStore.projects[0]) {
  const snap = project.snapshot
  if (snap.globalBackground) {
    return { backgroundImage: `url(${snap.globalBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  if (snap.globalBgColor) return { backgroundColor: snap.globalBgColor }
  return { background: 'linear-gradient(135deg, #B2F4BC 0%, #7FEC8F 100%)' }
}

/**
 * Render a "Unit N: Title — Lesson M: Title" string for the
 * Unit / Lesson column. Returns `null` for legacy projects (created
 * before the lesson-selection modal landed) so the template can fall
 * back to an em-dash.
 */
function unitLessonLabel(project: typeof projectsStore.projects[0]): string | null {
  const meta = project.meta
  if (!meta) return null
  const unitTitle = locale.value === 'zh' ? meta.unitTitleZh : meta.unitTitleEn
  const lessonTitle = locale.value === 'zh' ? meta.lessonTitleZh : meta.lessonTitleEn
  // i18n keys mirror those used by the lesson-selection modal so the
  // labels stay consistent end-to-end ("Unit 3" / "第3单元", etc.).
  const unitPrefix = t('lessonSelect.unit', { n: meta.unitNumber })
  const lessonPrefix = t('lessonSelect.lesson', { n: meta.lessonNumber })
  return `${unitPrefix}: ${unitTitle} · ${lessonPrefix}: ${lessonTitle}`
}

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    completed: locale.value === 'zh' ? '已完成' : 'Completed',
    taught:    locale.value === 'zh' ? '已教授' : 'Taught',
    draft:     locale.value === 'zh' ? '草稿'   : 'Draft',
  }
  return map[status ?? 'draft'] ?? map.draft
}
</script>

<template>
  <div class="dashboard">

    <!-- Shared authenticated-area header (logo, lang toggle, avatar + greeting). -->
    <DashboardHeader />

    <!-- Page body -->
    <main class="dash-main">

      <!-- Title row -->
      <div class="title-row">
        <div class="title-left">
          <h1 class="page-title">{{ t('dashboard.myLessons') }}</h1>
          <p class="page-subtitle">{{ t('dashboard.subtitle') }}</p>
        </div>

        <!-- Stat cards -->
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-text">
              <span class="stat-number">{{ totalSlides }}</span>
              <span class="stat-label">{{ t('dashboard.stats.totalSlides') }}</span>
              <span class="stat-desc">{{ t('dashboard.stats.totalSlidesDesc') }}</span>
            </div>
            <img src="/total-slides.png" class="stat-icon" />
          </div>
          <div class="stat-card">
            <div class="stat-text">
              <span class="stat-number">{{ readyCount }}</span>
              <span class="stat-label">{{ t('dashboard.stats.readyToTeach') }}</span>
              <span class="stat-desc">{{ t('dashboard.stats.readyToTeachDesc') }}</span>
            </div>
            <img src="/ready-to-teach.png" class="stat-icon" />
          </div>
          <div class="stat-card">
            <div class="stat-text">
              <span class="stat-number">{{ draftsCount }}</span>
              <span class="stat-label">{{ t('dashboard.stats.drafts') }}</span>
              <span class="stat-desc">{{ t('dashboard.stats.draftsDesc') }}</span>
            </div>
            <img src="/draft.png" class="stat-icon" />
          </div>
          <div class="stat-card">
            <div class="stat-text">
              <span class="stat-number">{{ sharedCount }}</span>
              <span class="stat-label">{{ t('dashboard.stats.shared') }}</span>
              <span class="stat-desc">{{ t('dashboard.stats.sharedDesc') }}</span>
            </div>
            <img src="/shared.png" class="stat-icon" />
          </div>
        </div>
      </div>

      <!-- Filter + create row -->
      <div class="toolbar">
        <div class="filter-tabs">
          <button
            v-for="tab in (['all','completed','drafts','saved','taught'] as const)"
            :key="tab"
            class="tab-btn"
            :class="{ 'tab-btn--active': activeFilter === tab }"
            @click="activeFilter = tab"
          >{{ t(`dashboard.tabs.${tab}`) }}</button>
        </div>
        <button class="btn-create" @click="openCreate">
          <svg viewBox="0 0 20 20" fill="none" class="wand-icon">
            <path d="M4 16L13 4M13 4l2 5M13 4l-5 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="15" cy="5" r="1.2" fill="currentColor"/>
            <circle cx="10" cy="3" r="0.8" fill="currentColor"/>
            <circle cx="17" cy="9" r="0.8" fill="currentColor"/>
          </svg>
          {{ t('dashboard.createLesson') }}
        </button>
      </div>

      <!-- Empty state -->
      <div v-if="filteredProjects.length === 0" class="empty-state">
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
        <button class="btn-create" @click="openCreate">{{ t('dashboard.createLesson') }}</button>
      </div>

      <!-- Table -->
      <div v-else class="lesson-table">
        <div class="table-head">
          <span class="col-deck">{{ t('dashboard.col.deck') }}</span>
          <span class="col-unit">{{ t('dashboard.col.unit') }}</span>
          <span class="col-edited">{{ t('dashboard.col.lastEdited') }}</span>
          <span class="col-status">{{ t('dashboard.col.status') }}</span>
          <span class="col-actions">{{ t('dashboard.col.actions') }}</span>
        </div>

        <div
          v-for="project in filteredProjects"
          :key="project.id"
          class="table-row"
        >
          <!-- Slide deck -->
          <div class="col-deck">
            <div class="row-thumb" :style="thumbnailStyle(project)" />
            <div class="row-info">
              <span class="row-name">{{ project.name }}</span>
              <span class="row-meta">{{ project.snapshot.slides.length }} {{ t('dashboard.slides') }} · {{ t('dashboard.created') }} {{ formatDate(project.createdAt) }}</span>
            </div>
          </div>

          <!-- Unit / lesson — populated from `project.meta` when the
               project was created via the Dashboard lesson-selection
               modal; legacy projects fall back to an em-dash. -->
          <div class="col-unit">
            <span class="row-unit">{{ unitLessonLabel(project) ?? '—' }}</span>
          </div>

          <!-- Last edited -->
          <div class="col-edited">
            <span class="row-date">{{ formatDate(project.createdAt) }}</span>
            <span class="row-time">{{ formatTime(project.createdAt) }}</span>
          </div>

          <!-- Status badge -->
          <div class="col-status">
            <span class="status-badge" :class="`status--${project.status ?? 'draft'}`">
              {{ statusLabel(project.status) }}
            </span>
          </div>

          <!-- Actions -->
          <div class="col-actions">
            <button class="action-btn" @click="resumeProject(project.id)">
              <svg viewBox="0 0 16 16" fill="none"><path d="M2 2.5l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 2.5l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              {{ t('dashboard.actions.edit') }}
            </button>
            <button class="action-btn">
              <svg viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/></svg>
              {{ t('dashboard.actions.preview') }}
            </button>
            <button class="action-btn action-btn--green" @click="resumeProject(project.id)">
              <svg viewBox="0 0 16 16" fill="none"><path d="M4 3l9 5-9 5V3z" fill="currentColor"/></svg>
              {{ t('dashboard.actions.startTeaching') }}
            </button>
            <button class="action-btn action-btn--red" @click="requestDelete(project.id)">
              <svg viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5L11 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              {{ t('dashboard.actions.delete') }}
            </button>
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
  background: #fff;
  display: flex;
  flex-direction: column;
}

/* Header lives in <DashboardHeader> — its styles are scoped there. */

/* ── Main ── */
.dash-main {
  flex: 1;
  padding: 40px 40px 60px;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

/* ── Title + stats row ── */
.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 32px;
  margin-bottom: 32px;
}

.title-left { flex-shrink: 0; }

.page-title {
  font-size: 42px;
  font-weight: 900;
  color: #111827;
  margin: 0 0 8px;
  letter-spacing: -1px;
  line-height: 1.1;
}

.page-subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
  max-width: 320px;
  line-height: 1.6;
}

/* ── Stat cards ── */
.stats-row {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.stat-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #fff;
  border: 1.5px solid #e5e7eb;
  border-radius: 14px;
  padding: 16px 20px;
  min-width: 140px;
}

.stat-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-number {
  font-size: 28px;
  font-weight: 800;
  color: #111827;
  line-height: 1;
}

.stat-label {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  margin-top: 4px;
}

.stat-desc {
  font-size: 11px;
  color: #9ca3af;
}

.stat-icon {
  width: 36px;
  height: 36px;
  object-fit: contain;
  opacity: 0.45;
  flex-shrink: 0;
}

/* ── Toolbar ── */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.filter-tabs {
  display: flex;
  gap: 4px;
  background: #f3f4f6;
  border-radius: 999px;
  padding: 4px;
}

.tab-btn {
  height: 34px;
  padding: 0 18px;
  border-radius: 999px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  color: #6b7280;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.tab-btn--active {
  background: #7FEC8F;
  color: #111827;
  font-weight: 700;
}

.tab-btn:not(.tab-btn--active):hover { background: #e5e7eb; color: #374151; }

.btn-create {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 22px;
  background: #7FEC8F;
  color: #111827;
  border: none;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 2px 3px 6px rgba(0,0,0,0.10);
}
.btn-create:hover { transform: translateY(-1px); }

.wand-icon { width: 16px; height: 16px; }

/* ── Empty state ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 40vh;
  text-align: center;
}
.empty-icon svg { width: 72px; height: 72px; }
.empty-title { font-size: 22px; font-weight: 700; color: #111827; margin: 0; }
.empty-desc  { font-size: 15px; color: #6b7280; margin: 0; }

/* ── Table ── */
.lesson-table {
  border: 1.5px solid #e5e7eb;
  border-radius: 16px;
  overflow: hidden;
}

.table-head {
  display: grid;
  grid-template-columns: 2fr 1fr 1.2fr 1fr 2fr;
  background: #f9fafb;
  padding: 12px 24px;
  border-bottom: 1.5px solid #e5e7eb;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #9ca3af;
}

.table-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1.2fr 1fr 2fr;
  padding: 16px 24px;
  align-items: center;
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.1s;
}
.table-row:last-child { border-bottom: none; }
.table-row:hover { background: #fafafa; }

/* Deck column */
.col-deck {
  display: flex;
  align-items: center;
  gap: 14px;
}

.row-thumb {
  width: 80px;
  height: 54px;
  border-radius: 8px;
  flex-shrink: 0;
  border: 1px solid #e5e7eb;
}

.row-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.row-name {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-meta {
  font-size: 12px;
  color: #9ca3af;
}

/* Unit column */
.col-unit { font-size: 13px; color: #6b7280; }
.row-unit { }

/* Edited column */
.col-edited {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.row-date { font-size: 13px; color: #374151; }
.row-time { font-size: 11px; color: #9ca3af; }

/* Status column */
.col-status { }

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.status--completed { background: #dcfce7; color: #16a34a; }
.status--taught    { background: #ede9fe; color: #7c3aed; }
.status--draft     { background: #f3f4f6; color: #6b7280; }

/* Actions column */
.col-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  background: #fff;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  color: #374151;
  cursor: pointer;
  white-space: nowrap;
}
.action-btn svg { width: 13px; height: 13px; flex-shrink: 0; }
.action-btn:hover { background: #f3f4f6; }

.action-btn--green {
  background: #7FEC8F;
  border-color: #7FEC8F;
  color: #111827;
  font-weight: 600;
}
.action-btn--green:hover { background: #6de07f; }

.action-btn--red { color: #dc2626; border-color: #fecaca; }
.action-btn--red:hover { background: #fee2e2; border-color: #fca5a5; }

/* ── Modals ── */
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

.modal-title { font-size: 20px; font-weight: 700; color: #111827; margin: 0; }
.modal-desc  { font-size: 14px; color: #6b7280; margin: 0; }

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

.modal-actions { display: flex; justify-content: flex-end; gap: 10px; }

.modal-btn-cancel {
  height: 40px; padding: 0 20px; background: #e6e6e6; color: #374151;
  border: none; border-radius: 999px; font-size: 14px; font-weight: 600;
  font-family: inherit; cursor: pointer;
}
.modal-btn-cancel:hover { background: #d8d8d8; }

.modal-btn-create {
  height: 40px; padding: 0 20px; background: #7FEC8F; color: #000;
  border: none; border-radius: 999px; font-size: 14px; font-weight: 600;
  font-family: inherit; cursor: pointer;
}
.modal-btn-create:hover { transform: translateY(-1px); }

.modal-btn-delete {
  height: 40px; padding: 0 20px; background: #dc2626; color: #fff;
  border: none; border-radius: 999px; font-size: 14px; font-weight: 600;
  font-family: inherit; cursor: pointer;
}
.modal-btn-delete:hover { background: #b91c1c; }
</style>
