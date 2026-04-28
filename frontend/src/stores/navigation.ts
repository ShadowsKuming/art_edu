import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNavigationStore = defineStore('navigation', () => {
  const canAccessDashboard = ref(false)
  const canAccessWorkspace = ref(false)

  function enterDashboard() {
    canAccessDashboard.value = true
  }

  function enterWorkspace() {
    canAccessWorkspace.value = true
  }

  return { canAccessDashboard, canAccessWorkspace, enterDashboard, enterWorkspace }
})
