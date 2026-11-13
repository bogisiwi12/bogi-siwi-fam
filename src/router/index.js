import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useFamilyStore } from '@/stores/familyStore'
import DashboardView from '@/views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/AuthView.vue'),
      meta: { public: true }
    },
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/members', name: 'members', component: () => import('@/views/MembersView.vue') },
    { path: '/tasks', name: 'tasks', component: () => import('@/views/TasksView.vue') },
    { path: '/shopping', name: 'shopping', component: () => import('@/views/ShoppingView.vue') },
    {
      path: '/holiday',
      name: 'holiday',
      component: () => import('@/views/HolidayPlannerView.vue')
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('@/views/UsersView.vue'),
      meta: { requiresAdmin: true }
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (!authStore.initialized) {
    await authStore.init()
  }

  if (to.meta.public) {
    if (authStore.isAuthenticated) return { name: 'dashboard' }
    return true
  }

  if (!authStore.isAuthenticated) {
    return {
      name: 'login',
      query: to.fullPath === '/' ? {} : { redirect: to.fullPath }
    }
  }

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return { name: 'dashboard' }
  }

  const familyStore = useFamilyStore()
  await familyStore.init()

  return true
})

export default router
