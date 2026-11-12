<script setup>
import { useFamilyStore } from '@/stores/familyStore'
import { ref, computed } from 'vue'

const store = useFamilyStore()
const newTask = ref('')
const newAssignee = ref('Alex')

const completed = computed(() => store.tasks.filter(t => t.done).length)
const progress = computed(() =>
  store.tasks.length ? (completed.value / store.tasks.length) * 100 : 0
)

function handleAdd() {
  if (!newTask.value.trim()) return
  store.addTask(newTask.value, newAssignee.value)
  newTask.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 anim-fade-up">
      <div>
        <h1 class="text-2xl lg:text-3xl font-extrabold text-gray-800">Tasks & Chores ✅</h1>
        <p class="text-gray-500 mt-1">Who's doing what around the house.</p>
      </div>
      <span class="self-start sm:self-auto inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur px-4 py-2 text-xs font-semibold text-blue-600 shadow-sm border border-blue-100">
        <span class="w-2 h-2 rounded-full bg-emerald-400 anim-pulse-ring" />
        {{ completed }} of {{ store.tasks.length }} done
      </span>
    </div>

    <!-- Progress -->
    <div class="bg-white/80 backdrop-blur rounded-2xl p-5 shadow-sm border border-blue-50 anim-fade-up" style="--delay: 60ms">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-semibold text-gray-600">Daily progress</span>
        <span class="text-sm font-bold text-blue-600 tabular-nums">{{ Math.round(progress) }}%</span>
      </div>
      <div class="bg-gray-100 rounded-full h-3 overflow-hidden">
        <div class="bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 h-3 rounded-full transition-all duration-700 ease-out"
             :style="{ width: progress + '%' }" />
      </div>
    </div>

    <!-- Add Task -->
    <div class="bg-white/80 backdrop-blur rounded-2xl p-4 shadow-sm border border-blue-50 anim-fade-up" style="--delay: 120ms">
      <div class="flex flex-col sm:flex-row gap-3">
        <input v-model="newTask" placeholder="New task..."
               class="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all duration-300"
               @keyup.enter="handleAdd" />
        <select v-model="newAssignee"
                class="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-white transition-all duration-300">
          <option v-for="m in store.members" :key="m.id" :value="m.name">{{ m.name }}</option>
        </select>
        <button @click="handleAdd"
                class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold shadow-md shadow-blue-200/60 transition-all duration-300 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95">
          Add
        </button>
      </div>
    </div>

    <!-- Tasks List -->
    <TransitionGroup name="list" tag="div"
                     class="relative bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-blue-50 divide-y divide-gray-50 overflow-hidden">
      <div v-for="task in store.tasks" :key="task.id"
           class="group flex items-center gap-4 p-4 hover:bg-gray-50/70 transition-colors duration-300"
           :class="task.done ? 'opacity-60' : ''">
        <button @click="store.toggleTask(task.id)"
                class="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 hover:scale-110 active:scale-90"
                :class="task.done ? 'bg-green-500 border-green-500 text-white' : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50'">
          <span v-if="task.done" class="text-xs anim-pop">✓</span>
        </button>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium transition-all duration-300"
             :class="task.done ? 'line-through text-gray-400' : 'text-gray-700'">
            {{ task.title }}
          </p>
          <p class="text-xs text-gray-400">{{ task.assignee }}</p>
        </div>
        <span class="text-xs font-bold px-2 py-1 rounded-full transition-colors duration-300"
              :class="task.done ? 'bg-gray-100 text-gray-400' : 'bg-cyan-100 text-cyan-600'">
          +{{ task.points }} pts
        </span>
        <button @click="store.removeTask(task.id)"
                class="text-xs font-semibold text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-all duration-300 active:scale-90">
          Remove
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
