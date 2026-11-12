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
    { path: '/calendar', name: 'calendar', component: () => import('@/views/CalendarView.vue') },
    { path: '/tasks', name: 'tasks', component: () => import('@/views/TasksView.vue') },
    { path: '/finance', name: 'finance', component: () => import('@/views/FinanceView.vue') },
    { path: '/shopping', name: 'shopping', component: () => import('@/views/ShoppingView.vue') }
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

  const familyStore = useFamilyStore()
  await familyStore.init()

  return true
})

export default router
