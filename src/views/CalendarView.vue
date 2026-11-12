<script setup>
import { useFamilyStore } from '@/stores/familyStore'
import { ref, computed } from 'vue'

const store = useFamilyStore()

const newEventTitle = ref('')
const newEventDate = ref(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`)
const newEventTime = ref('09:00')
const newEventMember = ref('All')

const currentMonth = ref(new Date().getMonth())
const currentYear = ref(new Date().getFullYear())

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const daysInMonth = computed(() => {
  return new Date(currentYear.value, currentMonth.value + 1, 0).getDate()
})

const firstDayOfWeek = computed(() => {
  return new Date(currentYear.value, currentMonth.value, 1).getDay()
})

const calendarDays = computed(() => {
  const days = []
  for (let i = 0; i < firstDayOfWeek.value; i++) days.push(null)
  for (let d = 1; d <= daysInMonth.value; d++) days.push(d)
  return days
})

const today = new Date()
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

function dateForDay(day) {
  return `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getEventsForDay(day) {
  if (!day) return []
  return store.events.filter(e => e.date === dateForDay(day))
}

function isToday(day) {
  return day !== null && dateForDay(day) === todayStr
}

function prevMonth() {
  if (currentMonth.value === 0) { currentMonth.value = 11; currentYear.value-- }
  else currentMonth.value--
}

function nextMonth() {
  if (currentMonth.value === 11) { currentMonth.value = 0; currentYear.value++ }
  else currentMonth.value++
}

function goToday() {
  const now = new Date()
  currentMonth.value = now.getMonth()
  currentYear.value = now.getFullYear()
}

function handleAddEvent() {
  if (!newEventTitle.value.trim() || !newEventDate.value || !newEventTime.value) return
  const member = store.members.find(m => m.name === newEventMember.value)
  store.addEvent(newEventTitle.value, newEventDate.value, newEventTime.value, newEventMember.value, member?.color || '#2563eb')
  newEventTitle.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 anim-fade-up">
      <div>
        <h1 class="text-2xl lg:text-3xl font-extrabold text-gray-800">Family Calendar 📅</h1>
        <p class="text-gray-500 mt-1">Keep track of everyone's schedule.</p>
      </div>
      <div class="flex items-center gap-2 bg-white/80 backdrop-blur rounded-2xl p-1.5 shadow-sm border border-blue-100">
        <button @click="prevMonth" class="p-2 rounded-xl hover:bg-blue-50 text-blue-600 transition-all duration-300 hover:scale-110 active:scale-90">←</button>
        <span class="font-bold text-gray-700 min-w-[140px] text-center tabular-nums">{{ monthNames[currentMonth] }} {{ currentYear }}</span>
        <button @click="nextMonth" class="p-2 rounded-xl hover:bg-blue-50 text-blue-600 transition-all duration-300 hover:scale-110 active:scale-90">→</button>
        <button @click="goToday"
                class="ml-1 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-semibold transition-all duration-300 hover:opacity-90 hover:shadow-md active:scale-95">
          Today
        </button>
      </div>
    </div>

    <!-- Calendar Grid -->
    <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-blue-50 overflow-hidden anim-fade-up" style="--delay: 100ms">
      <div class="grid grid-cols-7 bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 text-white text-[11px] sm:text-xs font-semibold">
        <div v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="day"
             class="py-3 text-center tracking-wide">{{ day }}</div>
      </div>
      <div :key="`${currentYear}-${currentMonth}`" class="grid grid-cols-7 anim-fade-in">
        <div v-for="(day, idx) in calendarDays" :key="idx"
             class="group min-h-[74px] lg:min-h-[104px] p-1.5 border-t border-r border-gray-50 transition-colors duration-300"
             :class="day ? 'bg-white hover:bg-blue-50/40' : 'bg-gray-50/50'">
          <template v-if="day">
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold transition-all duration-300"
                  :class="isToday(day)
                    ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-200'
                    : 'text-gray-500 group-hover:text-blue-600'">
              {{ day }}
            </span>
            <div class="mt-1 space-y-0.5">
              <div v-for="event in getEventsForDay(day)" :key="event.id"
                   class="text-[10px] lg:text-xs px-1.5 py-0.5 rounded text-white truncate cursor-default transition-transform duration-200 hover:scale-[1.03]"
                   :style="{ backgroundColor: event.color }"
                   :title="`${event.title} - ${event.time}`">
                {{ event.title }}
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Add Event -->
    <div class="bg-white/80 backdrop-blur rounded-2xl p-4 sm:p-5 shadow-sm border border-blue-50 anim-fade-up" style="--delay: 140ms">
      <div class="mb-3 flex items-center gap-2">
        <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-sm">➕</span>
        <h2 class="text-sm font-bold text-gray-700">Add event</h2>
      </div>
      <form class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]"
            @submit.prevent="handleAddEvent">
        <input v-model="newEventTitle" placeholder="Event title"
               class="w-full min-w-0 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all duration-300" />
        <input v-model="newEventDate" type="date"
               class="w-full min-w-0 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all duration-300" />
        <input v-model="newEventTime" type="time"
               class="w-full min-w-0 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all duration-300" />
        <select v-model="newEventMember"
                class="w-full min-w-0 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-white transition-all duration-300">
          <option>All</option>
          <option v-for="m in store.members" :key="m.id" :value="m.name">{{ m.name }}</option>
        </select>
        <button type="submit"
                class="w-full xl:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold shadow-md shadow-blue-200/60 transition-all duration-300 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95 sm:col-span-2 xl:col-span-1">
          Add
        </button>
      </form>
    </div>

    <!-- Event List -->
    <div class="bg-white/80 backdrop-blur rounded-2xl p-6 shadow-sm border border-blue-50 anim-fade-up" style="--delay: 180ms">
      <h2 class="font-bold text-gray-800 mb-4">All Events</h2>
      <div class="space-y-2">
        <div v-for="(event, i) in store.events" :key="event.id"
             class="group flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all duration-300 hover:translate-x-1 anim-fade-up"
             :style="{ '--delay': `${240 + i * 70}ms` }">
          <div class="w-3 h-3 rounded-full flex-shrink-0 transition-transform duration-300 group-hover:scale-150" :style="{ backgroundColor: event.color }" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-700">{{ event.title }}</p>
            <p class="text-xs text-gray-400">{{ event.date }} at {{ event.time }}</p>
          </div>
          <span class="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600 font-medium">{{ event.member }}</span>
          <button @click="store.removeEvent(event.id)"
                  class="text-xs font-semibold text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-all duration-300 active:scale-90">
            Remove
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
