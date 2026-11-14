<script setup>
import { useFamilyStore } from '@/stores/familyStore'
import { useAuthStore } from '@/stores/authStore'
import { computed } from 'vue'

const store = useFamilyStore()
const auth = useAuthStore()
const canManage = computed(() => auth.isAdmin || auth.isParent)

const recentTasks = computed(() =>
  store.pendingTasks.slice(0, 4)
)

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric'
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 anim-fade-up">
      <div>
        <h1 class="text-2xl lg:text-3xl font-extrabold text-gray-800">
          {{ auth.isGuest ? 'Welcome!' : 'Welcome back!' }} <span class="inline-block anim-float">👋</span>
        </h1>
        <p class="text-gray-500 mt-1">Here's what's happening with the family today.</p>
      </div>
      <span class="self-start sm:self-auto inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur px-4 py-2 text-xs font-semibold text-blue-600 shadow-sm border border-blue-100">
        <span class="w-2 h-2 rounded-full bg-emerald-400 anim-pulse-ring" />
        {{ today }}
      </span>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 gap-4">
      <div class="group bg-white/80 backdrop-blur rounded-2xl p-5 shadow-sm border border-blue-50 hover-lift anim-fade-up" style="--delay: 60ms">
        <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center text-2xl mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
          👨‍👩‍👧‍👦
        </div>
        <p class="text-2xl font-extrabold text-gray-800">{{ store.members.length }}</p>
        <p class="text-xs text-gray-400">Members</p>
      </div>
      <div class="group bg-white/80 backdrop-blur rounded-2xl p-5 shadow-sm border border-blue-50 hover-lift anim-fade-up" style="--delay: 180ms">
        <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center text-2xl mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
          ✅
        </div>
        <p class="text-2xl font-extrabold text-gray-800">{{ store.pendingTasks.length }}</p>
        <p class="text-xs text-gray-400">Pending Tasks</p>
      </div>
    </div>

    <div class="grid lg:grid-cols-2 gap-6">
      <!-- Pending Tasks -->
      <div class="bg-white/80 backdrop-blur rounded-2xl p-6 shadow-sm border border-blue-50 hover-lift anim-fade-up" style="--delay: 180ms">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-bold text-gray-800">✅ Pending Tasks</h2>
          <RouterLink to="/tasks" class="group text-xs font-semibold text-blue-500 hover:text-blue-700">
            View all <span class="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
          </RouterLink>
        </div>
        <div class="space-y-2">
          <div v-for="(task, i) in recentTasks" :key="task.id"
               class="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors duration-300 anim-fade-up"
               :style="{ '--delay': `${240 + i * 70}ms` }">
            <button v-if="canManage" @click="store.toggleTask(task.id)"
                    class="w-5 h-5 rounded-full border-2 border-blue-300 flex-shrink-0 transition-all duration-300 hover:border-blue-500 hover:bg-blue-100 hover:scale-110 active:scale-90" />
            <span v-else
                  class="w-5 h-5 rounded-full border-2 border-gray-200 bg-gray-50 flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-700 truncate">{{ task.title }}</p>
              <p class="text-xs text-gray-400">Assigned to {{ task.assignee }}</p>
            </div>
            <span class="text-xs font-bold text-cyan-500">+{{ task.points }}</span>
          </div>
        </div>
      </div>

      <!-- Shopping Progress -->
      <div class="bg-white/80 backdrop-blur rounded-2xl p-6 shadow-sm border border-blue-50 hover-lift anim-fade-up" style="--delay: 240ms">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-bold text-gray-800">🛒 Shopping List</h2>
          <RouterLink to="/shopping" class="group text-xs font-semibold text-blue-500 hover:text-blue-700">
            View all <span class="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
          </RouterLink>
        </div>
        <div class="flex items-center gap-4 mb-4">
          <div class="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
            <div class="bg-gradient-to-r from-blue-500 to-cyan-500 h-3 rounded-full transition-all duration-700 ease-out"
                 :style="{ width: (store.shoppingProgress.done / store.shoppingProgress.total * 100) + '%' }" />
          </div>
          <span class="text-sm font-bold text-gray-600">{{ store.shoppingProgress.done }}/{{ store.shoppingProgress.total }}</span>
        </div>
        <div class="space-y-2">
          <div v-for="item in store.shoppingList.filter(i => !i.done).slice(0, 3)" :key="item.id"
               class="flex items-center gap-2 text-sm text-gray-600">
            <span class="w-2 h-2 rounded-full bg-blue-400" />
            {{ item.name }} <span class="text-gray-400">x{{ item.quantity }}</span>
          </div>
        </div>
      </div>

      <!-- Family Rules -->
      <div class="bg-white/80 backdrop-blur rounded-2xl p-6 shadow-sm border border-blue-50 hover-lift anim-fade-up" style="--delay: 300ms">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-bold text-gray-800">📋 Family Rules</h2>
          <RouterLink to="/members" class="group text-xs font-semibold text-blue-500 hover:text-blue-700">
            View all <span class="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
          </RouterLink>
        </div>
        <div class="space-y-3">
          <div v-for="rule in store.rules.slice(0, 3)" :key="rule.id"
               class="group flex items-center gap-3 rounded-xl p-2 -m-2 transition-colors duration-300 hover:bg-gray-50">
            <span class="text-xl transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-6">{{ rule.icon }}</span>
            <div>
              <p class="text-sm font-medium text-gray-700">{{ rule.title }}</p>
              <p class="text-xs text-gray-400">{{ rule.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
