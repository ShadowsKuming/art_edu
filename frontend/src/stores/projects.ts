import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Slide } from './slides'
import { useChatbotStore } from './chatbot'

const STORAGE_KEY = 'artbloom-projects'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

// Strip legacy absolute localhost URLs from stored slide element src/background fields.
// Older snapshots baked in http://localhost:8001/textbook-assets/... before assets
// were moved to public/. Replace with root-relative paths so Cloudflare Pages serves them.
function migrateProjects(projects: Project[]): Project[] {
  const OLD = 'http://localhost:8001/textbook-assets/'
  const NEW = '/textbook-assets/'
  const fix = (s: string) => s.startsWith(OLD) ? NEW + s.slice(OLD.length) : s
  return projects.map(p => ({
    ...p,
    snapshot: {
      ...p.snapshot,
      globalBackground: p.snapshot.globalBackground ? fix(p.snapshot.globalBackground) : p.snapshot.globalBackground,
      slides: p.snapshot.slides.map(slide => ({
        ...slide,
        background: slide.background ? fix(slide.background) : slide.background,
        elements: slide.elements.map(el => ({
          ...el,
          src: el.src ? fix(el.src) : el.src,
        })),
      })),
    },
  }))
}

export interface SlideSnapshot {
  slides: Slide[]
  activePart: number
  maxUnlockedPart: number
  /**
   * Global theme background image (data URL) for the project.
   * Required key, value may be `undefined` when no theme is set.
   * Mirrors the shape returned by `useSlideStore().getSnapshot()`.
   */
  globalBackground: string | undefined
  /**
   * Global theme solid background colour (CSS color string).
   * Required key, value may be `undefined` when no theme is set.
   */
  globalBgColor: string | undefined
  activeSlideId: string | null
}

/**
 * Curriculum-anchored metadata captured by the lesson-selection modal
 * (`Dashboard.vue` → `LessonSelectionModal.vue`) when a project is
 * created. Optional so legacy projects (created before the modal landed)
 * keep working — the MyLessons "Unit / Lesson" column simply renders an
 * em-dash when this is missing.
 *
 * Stored as a snapshot of the labels rather than just IDs so renaming or
 * restructuring `curriculum.ts` later won't retroactively rewrite a
 * teacher's saved decks.
 */
export interface ProjectMeta {
  volumeId: string  // e.g. 'g2v2'
  unitId: string    // e.g. 'g2v2-u3'
  lessonId: string  // e.g. 'g2v2-u3-l1'
  grade: number
  volume: number
  unitNumber: number
  lessonNumber: number
  unitTitleEn: string
  unitTitleZh: string
  lessonTitleEn: string
  lessonTitleZh: string
}

export interface Project {
  id: string
  name: string
  createdAt: string
  status?: 'draft' | 'completed' | 'taught' | 'saved'
  snapshot: SlideSnapshot
  part5VideoDataUrl?: string
  part5VideoName?: string
  /** Curriculum origin — present when created from the lesson modal. */
  meta?: ProjectMeta
}

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<Project[]>(migrateProjects(load(`${STORAGE_KEY}-list`, [])))
  const activeProjectId = ref<string | null>(load(`${STORAGE_KEY}-active`, null))

  const activeProject = computed(() =>
    projects.value.find(p => p.id === activeProjectId.value) ?? null
  )

  /**
   * Convenience accessor — the active project's LKP id, if it was
   * created from a Community/curriculum lesson. Every store that
   * calls a backend AI endpoint reads this and passes it through as
   * `lesson_id` so the backend's LessonContextManager can inject
   * Part-specific prompts.
   *
   * Returns `null` for legacy / freeform projects.
   */
  const activeLessonId = computed<string | null>(
    () => activeProject.value?.meta?.lessonId ?? null,
  )


  /**
   * Create a project. The `meta` argument is optional so the legacy
   * MyLessons "+ New Lesson" prompt (which only collects a name) keeps
   * working unchanged. The Dashboard "Create Lesson" flow always
   * provides it.
   */
  function createProject(name: string, meta?: ProjectMeta): string {
    const id = `proj-${Date.now()}`
    projects.value.push({
      id,
      name,
      createdAt: new Date().toISOString(),
      snapshot: {
        slides: [],
        activePart: 1,
        maxUnlockedPart: 1,
        globalBackground: undefined,
        globalBgColor: undefined,
        activeSlideId: null,
      },
      meta,
    })
    activeProjectId.value = id
    return id
  }

  function saveCurrentProject(
    slideSnap: SlideSnapshot,
    part5VideoDataUrl?: string,
    part5VideoName?: string,
  ) {
    const project = projects.value.find(p => p.id === activeProjectId.value)
    if (!project) return
    project.snapshot = slideSnap
    project.part5VideoDataUrl = part5VideoDataUrl
    project.part5VideoName = part5VideoName
  }

  function deleteProject(id: string) {
    projects.value = projects.value.filter(p => p.id !== id)
    if (activeProjectId.value === id) activeProjectId.value = null
    // 2026-05 — chatbot histories are bucketed per
    // `${projectId}:${partId}`. When the teacher trashes a deck we
    // also wipe every chatbot bucket prefixed with that project's
    // id so they don't linger in localStorage forever.
    useChatbotStore().clearProject(id)
  }

  function setActiveProject(id: string) {
    activeProjectId.value = id
  }

  watch(projects, val => localStorage.setItem(`${STORAGE_KEY}-list`, JSON.stringify(val)), { deep: true })
  watch(activeProjectId, val => localStorage.setItem(`${STORAGE_KEY}-active`, JSON.stringify(val)))

  return {
    projects, activeProjectId, activeProject, activeLessonId,
    createProject, saveCurrentProject, deleteProject, setActiveProject,
  }
})

