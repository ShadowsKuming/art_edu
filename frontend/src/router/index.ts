import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/views/HomePage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  /**
   * Smooth-scroll to in-page anchors whenever the route target includes
   * a hash (e.g. `router.push({ path: '/', hash: '#contact' })` from
   * MyAccount's "Send Feedback" button). Without this, `vue-router`
   * just changes the URL bar — it never actually scrolls the new view
   * to the matching `id`.
   *
   * `top: 88` accounts for the sticky `SiteHeader` (`--header-height`)
   * on the marketing site so the anchored section doesn't slide under it.
   */
  scrollBehavior(to) {
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth', top: 88 }
    }
    return { top: 0 }
  },
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
      path: '/workspace/:projectId',
      name: 'workspace',
      component: () => import('@/views/CreateLesson.vue'),
    },
  ],
})

router.beforeEach((to) => {
  // Workspace requires a project ID in the URL.
  if (to.name === 'workspace' && !to.params.projectId) {
    return { name: 'lessons' }
  }
})

export default router
