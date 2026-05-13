import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Slide } from './slides'

const STORAGE_KEY = 'artbloom-projects'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
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
  const projects = ref<Project[]>(load(`${STORAGE_KEY}-list`, []))
  const activeProjectId = ref<string | null>(load(`${STORAGE_KEY}-active`, null))

  const activeProject = computed(() =>
    projects.value.find(p => p.id === activeProjectId.value) ?? null
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
  }

  function setActiveProject(id: string) {
    activeProjectId.value = id
  }

  watch(projects, val => localStorage.setItem(`${STORAGE_KEY}-list`, JSON.stringify(val)), { deep: true })
  watch(activeProjectId, val => localStorage.setItem(`${STORAGE_KEY}-active`, JSON.stringify(val)))

  return {
    projects, activeProjectId, activeProject,
    createProject, saveCurrentProject, deleteProject, setActiveProject,
  }
})
