<script setup>
import { useFamilyStore } from '@/stores/familyStore'
import { useAuthStore } from '@/stores/authStore'
import { useUserStore } from '@/stores/userStore'
import { ref, computed, onMounted, onUnmounted } from 'vue'

const store = useFamilyStore()
const auth = useAuthStore()
const users = useUserStore()
const canManage = computed(() => auth.isAdmin || auth.isParent)
const newTask = ref('')
const newAssignee = ref('Alex')

const completed = computed(() => store.tasks.filter(t => t.done).length)
const progress = computed(() =>
  store.tasks.length ? (completed.value / store.tasks.length) * 100 : 0
)

function handleAdd() {
  if (!canManage.value) return
  if (!newTask.value.trim()) return
  store.addTask(newTask.value, newAssignee.value)
  newTask.value = ''
}

function assigneeUser(task) {
  const member = store.members.find((m) => m.name === task.assignee)
  if (member) {
    const byId = users.users.find((u) => u.id === member.userId)
    if (byId) return byId
  }
  return users.users.find((u) => u.name === task.assignee)
}

function assigneePhone(task) {
  return (assigneeUser(task)?.phone || '').replace(/[^\d]/g, '')
}

function buildTaskMessage(task) {
  const status = task.done ? 'Completed' : 'Pending'
  return [
    `Hello ${task.assignee},`,
    '',
    'This is a friendly reminder from Bogi-Siwi Fam.',
    '',
    `Task: ${task.title}`,
    `Points: ${task.points}`,
    `Status: ${status}`,
    '',
    task.done
      ? 'This task has been marked as completed. Thank you for your effort!'
      : 'Please complete this task at your earliest convenience. Thank you!',
    '',
    '- Bogi-Siwi Fam'
  ].join('\n')
}

function whatsappUrl(task) {
  const phone = assigneePhone(task)
  const text = encodeURIComponent(buildTaskMessage(task))
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`
}

onMounted(() => {
  if (auth.isAdmin) users.subscribe()
})
onUnmounted(() => {
  if (auth.isAdmin) users.dispose()
})
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

    <!-- View only notice -->
    <div v-if="!canManage"
         class="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-xs font-semibold text-amber-700 anim-fade-up">
      👀 View only — ask an admin or parent to manage tasks and chores.
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
    <div v-if="canManage" class="bg-white/80 backdrop-blur rounded-2xl p-4 shadow-sm border border-blue-50 anim-fade-up" style="--delay: 120ms">
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
        <button v-if="canManage" @click="store.toggleTask(task.id)"
                class="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 hover:scale-110 active:scale-90"
                :class="task.done ? 'bg-green-500 border-green-500 text-white' : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50'">
          <span v-if="task.done" class="text-xs anim-pop">✓</span>
        </button>
        <span v-else
              class="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0"
              :class="task.done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 bg-gray-50'">
          <span v-if="task.done" class="text-xs">✓</span>
        </span>
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
        <div class="flex items-center gap-1">
          <a v-if="canManage && !task.done" :href="whatsappUrl(task)" target="_blank" rel="noopener noreferrer"
             :title="assigneePhone(task) ? 'Send task details via WhatsApp' : 'WhatsApp will ask you to pick a contact'"
             class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600 transition-all duration-300 hover:bg-emerald-100 active:scale-90">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span class="hidden sm:inline">WhatsApp</span>
          </a>
          <button v-if="canManage" @click="store.removeTask(task.id)"
                  class="text-xs font-semibold text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-all duration-300 active:scale-90">
            Remove
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>
