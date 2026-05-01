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
  globalBackground?: string
  globalBgColor?: string
}

export interface Project {
  id: string
  name: string
  createdAt: string
  status?: 'draft' | 'completed' | 'taught' | 'saved'
  snapshot: SlideSnapshot
  part5VideoDataUrl?: string
  part5VideoName?: string
}

export const useProjectsStore = defineStore('projects', () => {
  const projects        = ref<Project[]>(load(`${STORAGE_KEY}-list`, []))
  const activeProjectId = ref<string | null>(load(`${STORAGE_KEY}-active`, null))

  const activeProject = computed(() =>
    projects.value.find(p => p.id === activeProjectId.value) ?? null
  )

  function createProject(name: string): string {
    const id = `proj-${Date.now()}`
    projects.value.push({
      id,
      name,
      createdAt: new Date().toISOString(),
      snapshot: { slides: [], activePart: 1, maxUnlockedPart: 1 },
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
