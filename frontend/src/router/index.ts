import { createRouter, createWebHistory } from 'vue-router'
import { useNavigationStore } from '@/stores/navigation'
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
  const nav = useNavigationStore()

  if (to.name === 'dashboard' && !nav.canAccessDashboard) {
    return { name: 'home' }
  }

  if (to.name === 'workspace' && !nav.canAccessWorkspace) {
    return { name: 'dashboard' }
  }
})

export default router
