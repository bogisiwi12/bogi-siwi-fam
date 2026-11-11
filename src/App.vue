<script setup>
import { computed } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { useFamilyStore } from '@/stores/familyStore'
import { useAuthStore } from '@/stores/authStore'

const store = useFamilyStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const isPublic = computed(() => !!route.meta.public)

const navItems = [
  { path: '/', label: 'Dashboard', icon: '🏠' },
  { path: '/members', label: 'Members & Rules', icon: '👨‍👩‍👧‍👦' },
  { path: '/calendar', label: 'Calendar', icon: '📅' },
  { path: '/tasks', label: 'Tasks & Chores', icon: '✅' },
  { path: '/finance', label: 'Finance', icon: '💰' },
  { path: '/shopping', label: 'Shopping', icon: '🛒' }
]

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-indigo-50 via-white to-pink-50 font-family-display">
    <!-- Ambient background -->
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div class="anim-float-slow absolute -top-32 -left-24 h-80 w-80 rounded-full bg-indigo-300/30 blur-3xl" />
      <div class="anim-float absolute top-1/3 -right-28 h-96 w-96 rounded-full bg-pink-300/25 blur-3xl" style="animation-delay: -2s" />
      <div class="anim-float-slow absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl" style="animation-delay: -4s" />
    </div>

    <!-- Auth pages (no app shell) -->
    <div v-if="isPublic" class="relative z-10">
      <RouterView />
    </div>

    <div v-else class="relative z-10">
      <!-- Mobile Header -->
      <header class="lg:hidden bg-white/70 backdrop-blur-xl border-b border-indigo-100/70 sticky top-0 z-50 shadow-sm shadow-indigo-100/40">
        <div class="flex items-center justify-between px-4 py-3">
          <h1 class="text-gradient text-xl font-extrabold tracking-tight">Bogi-Siwi Fam</h1>
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-2 rounded-full bg-indigo-50/80 py-1 pl-1 pr-2">
              <img v-if="auth.user?.photoURL" :src="auth.user.photoURL" alt="" class="h-7 w-7 rounded-full object-cover" />
              <span v-else class="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 text-xs font-bold text-white">{{ auth.initial }}</span>
              <span class="max-w-[90px] truncate text-xs font-semibold text-gray-600">{{ auth.displayName }}</span>
            </div>
            <button @click="handleLogout" title="Sign out"
                    class="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 active:scale-90">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div class="flex">
        <!-- Desktop Sidebar -->
        <aside class="hidden lg:flex flex-col w-64 min-h-screen bg-white/60 backdrop-blur-xl border-r border-indigo-100/70 p-6 sticky top-0">
          <h1 class="text-gradient text-2xl font-extrabold tracking-tight mb-2">Bogi-Siwi Fam</h1>
          <p class="text-xs text-gray-400 mb-8">Family Management Hub</p>

          <nav class="space-y-1.5 flex-1">
            <RouterLink v-for="(item, i) in navItems" :key="item.path" :to="item.path"
              class="group relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 anim-fade-in"
              :style="{ '--delay': `${i * 60}ms` }"
              :class="$route.path === item.path
                ? 'bg-gradient-to-r from-indigo-500 to-pink-500 text-white shadow-lg shadow-indigo-200/70'
                : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 hover:translate-x-1'">
              <span class="text-lg transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-6">{{ item.icon }}</span>
              <span class="flex-1">{{ item.label }}</span>
              <span v-if="$route.path === item.path" class="w-1.5 h-1.5 rounded-full bg-white/90 anim-pop" />
            </RouterLink>
          </nav>

          <div class="mt-auto space-y-4 border-t border-gray-100 pt-6">
            <div class="flex items-center gap-3 rounded-xl bg-indigo-50/70 p-3">
              <img v-if="auth.user?.photoURL" :src="auth.user.photoURL" alt="" class="h-9 w-9 rounded-full object-cover" />
              <span v-else class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 text-sm font-bold text-white">{{ auth.initial }}</span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-gray-700">{{ auth.displayName }}</p>
                <p class="text-[11px] capitalize text-gray-400">{{ auth.role }}</p>
              </div>
              <button @click="handleLogout" title="Sign out"
                      class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 active:scale-90">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>

            <div>
              <div class="flex -space-x-2 mb-3">
                <div v-for="m in store.members" :key="m.id"
                     class="w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-sm shadow-sm transition-transform duration-300 hover:scale-110 hover:z-10"
                     :style="{ backgroundColor: m.color + '20' }"
                     :title="m.name">
                  {{ m.avatar }}
                </div>
              </div>
              <p class="text-xs text-gray-400">{{ store.members.length }} family members</p>
            </div>
          </div>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 min-w-0 pb-24 lg:pb-8">
          <div class="w-full max-w-7xl mx-auto px-4 py-6 lg:py-8">
            <RouterView v-slot="{ Component, route: currentRoute }">
              <Transition name="page" mode="out-in">
                <component :is="Component" :key="currentRoute.path" />
              </Transition>
            </RouterView>
          </div>
        </main>
      </div>

      <!-- Mobile Bottom Nav -->
      <nav class="lg:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-indigo-100/70 z-50 shadow-[0_-8px_30px_-12px_rgba(79,70,229,0.25)]">
        <div class="flex justify-around py-2">
          <RouterLink v-for="item in navItems" :key="item.path" :to="item.path"
            class="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-300"
            :class="$route.path === item.path
              ? 'text-indigo-600 bg-indigo-50 -translate-y-1'
              : 'text-gray-400 hover:text-indigo-500'">
            <span class="text-lg transition-transform duration-300" :class="$route.path === item.path ? 'scale-110' : ''">{{ item.icon }}</span>
            <span>{{ item.label.split(' ')[0] }}</span>
          </RouterLink>
        </div>
      </nav>
    </div>
  </div>
</template>
