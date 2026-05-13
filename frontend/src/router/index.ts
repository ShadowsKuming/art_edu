import { createRouter, createWebHistory } from 'vue-router'
import { useProjectsStore } from '@/stores/projects'
import HomePage from '@/views/HomePage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
    },
    {
      // Hub landing page after the user submits the Access modal.
      // Shows the 5 action cards (Create Lesson, My Lessons, …).
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/Dashboard.vue'),
    },
    {
      // The actual lesson list (formerly mounted at /dashboard).
      // The Dashboard hub's "My Lessons" card routes here.
      path: '/lessons',
      name: 'lessons',
      component: () => import('@/views/MyLessons.vue'),
    },
    {
      // Lesson library — browse decks shared by other teachers.
      // Currently rendered with placeholder data; routed from the
      // Dashboard hub's "Community" card.
      path: '/community',
      name: 'community',
      component: () => import('@/views/Community.vue'),
    },
    {
      // User profile + feedback page. Reached from the Dashboard hub's
      // "My Account" card and from the avatar block in the shared header.
      path: '/account',
      name: 'account',
      component: () => import('@/views/MyAccount.vue'),
    },
    {
      path: '/workspace',
      name: 'workspace',
      component: () => import('@/views/CreateLesson.vue'),
    },
  ],
})

// Workspace requires an active project. If a user deep-links to
// /workspace without one, send them to the lesson list (where they
// can pick or create a project), not the hub.
router.beforeEach((to) => {
  if (to.name === 'workspace') {
    const projectsStore = useProjectsStore()
    if (!projectsStore.activeProjectId) {
      return { name: 'lessons' }
    }
  }
})

export default router
