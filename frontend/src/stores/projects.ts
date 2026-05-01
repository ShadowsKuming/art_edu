import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Slide } from './slides'

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
  snapshot: SlideSnapshot
  part5VideoDataUrl?: string
  part5VideoName?: string
}

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<Project[]>([])
  const activeProjectId = ref<string | null>(null)

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

  return {
    projects, activeProjectId, activeProject,
    createProject, saveCurrentProject, deleteProject, setActiveProject,
  }
})
