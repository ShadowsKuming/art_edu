import { createRouter, createWebHistory } from 'vue-router'
import { useProjectsStore } from '@/stores/projects'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
    },
    {
      path: '/workspace',
      name: 'workspace',
      component: () => import('@/views/WorkspaceView.vue'),
    },
  ],
})

router.beforeEach((to) => {
  if (to.name === 'workspace') {
    const projectsStore = useProjectsStore()
    if (!projectsStore.activeProjectId) {
      return { name: 'dashboard' }
    }
  }
})

export default router
