<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useUserStore } from '@/stores/userStore'
import { ROLES, ROLE_META } from '@/config/roles'

const auth = useAuthStore()
const store = useUserStore()
const search = ref('')

const counts = computed(() => {
  const totals = { admin: 0, parent: 0, child: 0, member: 0 }
  for (const user of store.users) {
    if (user.role in totals) totals[user.role]++
  }
  return totals
})

const filteredUsers = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return store.sortedUsers
  return store.sortedUsers.filter(
    (user) =>
      (user.name || '').toLowerCase().includes(term) ||
      (user.email || '').toLowerCase().includes(term)
  )
})

function roleMeta(role) {
  return ROLE_META[role] || ROLE_META.member
}

function userInitial(user) {
  return (user.name || user.email || '?').charAt(0).toUpperCase()
}

function formatLastLogin(value) {
  const date = value?.toDate?.()
  if (!date) return 'Never signed in'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function handleRoleChange(user, event) {
  const nextRole = event.target.value
  if (nextRole === user.role) return
  const ok = await store.updateRole(user.id, nextRole)
  if (!ok) event.target.value = user.role
}

onMounted(() => store.subscribe())
onUnmounted(() => store.dispose())
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 anim-fade-up">
      <div>
        <h1 class="text-2xl lg:text-3xl font-extrabold text-gray-800">User Management 🛡️</h1>
        <p class="text-gray-500 mt-1">Assign roles and manage who can access the family hub.</p>
      </div>
      <span class="self-start sm:self-auto inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur px-4 py-2 text-xs font-semibold text-purple-600 shadow-sm border border-purple-100">
        <span class="w-2 h-2 rounded-full bg-purple-400 anim-pulse-ring" />
        {{ store.users.length }} user{{ store.users.length === 1 ? '' : 's' }}
      </span>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="role in ROLES" :key="role"
           class="group bg-white/80 backdrop-blur rounded-2xl p-5 shadow-sm border border-blue-50 hover-lift anim-fade-up">
        <div class="flex items-center justify-between">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-transform duration-300 group-hover:scale-110"
                :class="roleMeta(role).badge">
            {{ roleMeta(role).icon }}
          </span>
          <span class="text-2xl font-extrabold text-gray-800 tabular-nums">{{ counts[role] }}</span>
        </div>
        <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">{{ roleMeta(role).label }}</p>
      </div>
    </div>

    <Transition name="page">
      <div v-if="store.error"
           class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
        {{ store.error }}
      </div>
    </Transition>

    <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-blue-50 overflow-hidden anim-fade-up" style="--delay: 120ms">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-50 px-4 py-3">
        <h2 class="text-sm font-bold text-gray-700">All users</h2>
        <div class="relative w-full sm:w-72">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">🔍</span>
          <input v-model="search" type="search" placeholder="Search name or email"
                 class="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none transition-all duration-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        </div>
      </div>

      <div v-if="store.loading" class="flex items-center justify-center gap-3 px-4 py-12 text-sm text-gray-400">
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-500" />
        Loading users...
      </div>

      <div v-else-if="filteredUsers.length === 0" class="px-4 py-12 text-center">
        <p class="text-3xl">👥</p>
        <p class="mt-2 text-sm font-semibold text-gray-600">No users found</p>
        <p class="mt-1 text-xs text-gray-400">
          {{ search ? 'Try a different search term.' : 'Users appear here after they sign in.' }}
        </p>
      </div>

      <TransitionGroup v-else name="list" tag="div" class="relative divide-y divide-gray-50">
        <div v-for="user in filteredUsers" :key="user.id"
             class="group flex flex-col gap-3 p-4 transition-colors duration-300 hover:bg-gray-50/70 sm:flex-row sm:items-center sm:gap-4">
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <img v-if="user.photoURL" :src="user.photoURL" alt=""
                 class="h-11 w-11 flex-shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm" />
            <span v-else
                  class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-sm font-bold text-white ring-2 ring-white shadow-sm">
              {{ userInitial(user) }}
            </span>
            <div class="min-w-0">
              <p class="flex items-center gap-2 truncate text-sm font-semibold text-gray-800">
                {{ user.name || 'Unnamed user' }}
                <span v-if="user.id === auth.user?.uid"
                      class="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600">
                  You
                </span>
              </p>
              <p class="truncate text-xs text-gray-400">{{ user.email || 'No email' }}</p>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 sm:justify-end">
            <div class="text-left sm:text-right">
              <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    :class="roleMeta(user.role).badge">
                <span class="h-1.5 w-1.5 rounded-full" :class="roleMeta(user.role).dot" />
                {{ roleMeta(user.role).label }}
              </span>
              <p class="mt-1 text-[11px] text-gray-400">Last login: {{ formatLastLogin(user.lastLoginAt) }}</p>
            </div>

            <select :value="user.role" @change="handleRoleChange(user, $event)"
                    :disabled="user.id === auth.user?.uid"
                    :title="user.id === auth.user?.uid ? 'You cannot change your own role' : 'Change role'"
                    class="w-32 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium outline-none transition-all duration-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400">
              <option v-for="role in ROLES" :key="role" :value="role">{{ roleMeta(role).label }}</option>
            </select>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <div class="rounded-2xl border border-blue-100/70 bg-blue-50/60 px-4 py-3 text-xs text-blue-700 anim-fade-up" style="--delay: 180ms">
      <p class="font-semibold">Role permissions</p>
      <p class="mt-1 text-blue-600/80">
        <strong>Admin</strong> can manage user roles. <strong>Parent</strong>, <strong>Child</strong>, and
        <strong>Member</strong> are labels for now and can be used to control access later. You cannot change your own role.
      </p>
    </div>
  </div>
</template>
