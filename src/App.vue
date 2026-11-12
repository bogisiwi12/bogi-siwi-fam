<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { useFamilyStore } from '@/stores/familyStore'
import { useAuthStore } from '@/stores/authStore'

const store = useFamilyStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const isPublic = computed(() => !!route.meta.public)

const allNavItems = [
  { path: '/', label: 'Dashboard', shortLabel: 'Home', icon: '🏠' },
  { path: '/members', label: 'Members & Rules', shortLabel: 'Members', icon: '👨‍👩‍👧‍👦' },
  { path: '/calendar', label: 'Calendar', shortLabel: 'Calendar', icon: '📅' },
  { path: '/tasks', label: 'Tasks & Chores', shortLabel: 'Tasks', icon: '✅' },
  { path: '/finance', label: 'Finance', shortLabel: 'Finance', icon: '💰' },
  { path: '/shopping', label: 'Shopping', shortLabel: 'Shopping', icon: '🛒' },
  {
    path: '/users',
    label: 'User Management',
    shortLabel: 'Users',
    icon: '🛡️',
    adminOnly: true
  }
]

const navItems = computed(() =>
  allNavItems.filter((item) => !item.adminOnly || auth.isAdmin)
)

const mobileNav = ref(null)

function centerActiveMobileNav() {
  const container = mobileNav.value
  if (!container) return
  const active = container.querySelector('[aria-current="page"]')
  if (!active) return
  container.scrollTo({
    left: active.offsetLeft - (container.clientWidth - active.clientWidth) / 2,
    behavior: 'smooth'
  })
}

onMounted(centerActiveMobileNav)

watch(
  () => route.path,
  async () => {
    await nextTick()
    centerActiveMobileNav()
  }
)

async function handleLogout() {
  store.dispose()
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-blue-50 via-white to-cyan-50 font-family-display">
    <!-- Ambient background -->
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div class="anim-float-slow absolute -top-32 -left-24 h-80 w-80 rounded-full bg-blue-300/30 blur-3xl" />
      <div class="anim-float absolute top-1/3 -right-28 h-96 w-96 rounded-full bg-cyan-300/25 blur-3xl" style="animation-delay: -2s" />
      <div class="anim-float-slow absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" style="animation-delay: -4s" />
    </div>

    <!-- Auth pages (no app shell) -->
    <div v-if="isPublic" class="relative z-10">
      <RouterView />
    </div>

    <div v-else class="relative z-10">
      <!-- Mobile Header -->
      <header class="lg:hidden bg-white/70 backdrop-blur-xl border-b border-blue-100/70 sticky top-0 z-50 shadow-sm shadow-blue-100/40">
        <div class="flex items-center justify-between px-4 py-3">
          <h1 class="text-gradient text-xl font-extrabold tracking-tight">Bogi-Siwi Fam</h1>
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-2 rounded-full bg-blue-50/80 py-1 pl-1 pr-2">
              <img v-if="auth.user?.photoURL" :src="auth.user.photoURL" alt="" class="h-7 w-7 rounded-full object-cover" />
              <span v-else class="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-xs font-bold text-white">{{ auth.initial }}</span>
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
        <aside class="hidden lg:flex flex-col w-64 min-h-screen bg-white/60 backdrop-blur-xl border-r border-blue-100/70 p-6 sticky top-0">
          <h1 class="text-gradient text-2xl font-extrabold tracking-tight mb-2">Bogi-Siwi Fam</h1>
          <p class="text-xs text-gray-400 mb-8">Family Management Hub</p>

          <nav class="flex-1 space-y-1.5 overflow-y-auto pr-1" aria-label="Main navigation">
            <RouterLink v-for="(item, i) in navItems" :key="item.path" :to="item.path"
              class="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-300 anim-fade-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2"
              :style="{ '--delay': `${i * 60}ms` }"
              :class="$route.path === item.path
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-200/70'
                : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg transition-all duration-300"
                :class="$route.path === item.path
                  ? 'bg-white/20 scale-105'
                  : 'bg-blue-50/80 group-hover:bg-blue-100 group-hover:scale-105'">
                {{ item.icon }}
              </span>
              <span class="flex-1 truncate">{{ item.label }}</span>
              <span v-if="$route.path === item.path"
                class="h-1.5 w-1.5 rounded-full bg-white/90 anim-pop" />
            </RouterLink>
          </nav>

          <div class="mt-auto space-y-4 border-t border-gray-100 pt-6">
            <div class="flex items-center gap-3 rounded-xl bg-blue-50/70 p-3">
              <img v-if="auth.user?.photoURL" :src="auth.user.photoURL" alt="" class="h-9 w-9 rounded-full object-cover" />
              <span v-else class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-sm font-bold text-white">{{ auth.initial }}</span>
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
      <nav class="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100/70 bg-white/85 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-12px_rgba(37,99,235,0.25)] backdrop-blur-xl"
        aria-label="Main navigation">
        <div ref="mobileNav"
          class="flex min-w-full snap-x snap-mandatory items-stretch justify-around gap-0.5 overflow-x-auto px-1.5 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <RouterLink v-for="item in navItems" :key="item.path" :to="item.path"
            class="group relative flex min-w-[40px] flex-1 basis-0 snap-center flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-[9px] font-semibold leading-tight transition-all duration-300 min-[380px]:text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
            :class="$route.path === item.path ? 'text-blue-600' : 'text-gray-400 hover:text-blue-500'">
            <span class="absolute inset-0 rounded-2xl transition-all duration-300"
              :class="$route.path === item.path
                ? 'bg-gradient-to-b from-blue-50 to-cyan-50 shadow-sm ring-1 ring-blue-100'
                : 'bg-transparent group-hover:bg-blue-50/70'" />
            <span v-if="$route.path === item.path"
              class="absolute -top-0.5 h-1 w-6 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 shadow-sm" />
            <span class="relative text-base transition-transform duration-300 min-[380px]:text-lg"
              :class="$route.path === item.path ? 'scale-110' : 'group-hover:scale-105'">{{ item.icon }}</span>
            <span class="relative w-full truncate text-center">{{ item.shortLabel }}</span>
          </RouterLink>
        </div>
      </nav>
    </div>
  </div>
</template>
