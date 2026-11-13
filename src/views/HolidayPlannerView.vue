<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useHolidayStore } from '@/stores/holidayStore'
import { useAuthStore } from '@/stores/authStore'
import MarqueeText from '@/components/MarqueeText.vue'

const store = useHolidayStore()
const auth = useAuthStore()
const canManage = computed(() => auth.isAdmin || auth.isParent)

const selectedTripId = ref(null)
const expandedDayId = ref(null)
const activityFormDayId = ref(null)
const showTripForm = ref(false)
const editingTripId = ref(null)
const formError = ref('')
const dayError = ref('')
const editingDay = ref(null)
const dayNameInput = ref('')
const dayNameError = ref('')
const dayNameInputEl = ref(null)
const editingActivity = ref(null)
const activityEditError = ref('')
const activityEditTitleEl = ref(null)
const copied = ref(false)

const coverOptions = ['✈️', '🏖️', '🏔️', '🗺️', '🏝️', '🎡', '🗼', '🏰', '🚢', '🚗']

const statusOptions = [
  { value: 'planning', label: 'Planning', class: 'bg-amber-100 text-amber-700' },
  { value: 'confirmed', label: 'Confirmed', class: 'bg-emerald-100 text-emerald-700' },
  { value: 'completed', label: 'Completed', class: 'bg-gray-100 text-gray-600' }
]

const categories = [
  { value: 'sightseeing', label: 'Sightseeing', icon: '📷', class: 'bg-blue-100 text-blue-700' },
  { value: 'food', label: 'Food & Drink', icon: '🍽️', class: 'bg-orange-100 text-orange-700' },
  { value: 'transport', label: 'Transport', icon: '🚆', class: 'bg-violet-100 text-violet-700' },
  { value: 'stay', label: 'Stay', icon: '🏨', class: 'bg-cyan-100 text-cyan-700' },
  { value: 'adventure', label: 'Adventure', icon: '🎢', class: 'bg-emerald-100 text-emerald-700' },
  { value: 'shopping', label: 'Shopping', icon: '🛍️', class: 'bg-pink-100 text-pink-700' },
  { value: 'mass', label: 'Mass', icon: '⛪', class: 'bg-indigo-100 text-indigo-700' },
  { value: 'other', label: 'Other', icon: '📌', class: 'bg-gray-100 text-gray-600' }
]

const tripForm = reactive({
  title: '',
  destination: '',
  startDate: '',
  endDate: '',
  travelers: 2,
  budget: 1500,
  currency: 'USD',
  status: 'planning',
  cover: '✈️',
  notes: ''
})

const dayForm = reactive({ date: '', title: '' })
const activityForm = reactive({
  time: '09:00',
  title: '',
  location: '',
  category: 'sightseeing',
  cost: 0,
  notes: ''
})

const activityEditForm = reactive({
  time: '09:00',
  title: '',
  location: '',
  category: 'sightseeing',
  cost: 0,
  notes: ''
})

const selectedTrip = computed(
  () => store.trips.find((trip) => trip.id === selectedTripId.value) || null
)

const plannedCost = computed(() =>
  Object.values(store.activitiesByDay)
    .flat()
    .reduce((sum, activity) => sum + (Number(activity.cost) || 0), 0)
)

const plannedActivities = computed(() =>
  Object.values(store.activitiesByDay).flat().length
)

const totalTrips = computed(() => store.trips.length)
const upcomingTrips = computed(
  () => store.trips.filter((trip) => trip.status !== 'completed').length
)
const completedTrips = computed(
  () => store.trips.filter((trip) => trip.status === 'completed').length
)

const overBudget = computed(() => {
  const budget = Number(selectedTrip.value?.budget) || 0
  return budget > 0 && plannedCost.value > budget
})

const budgetProgress = computed(() => {
  const budget = Number(selectedTrip.value?.budget) || 0
  if (!budget) return plannedCost.value > 0 ? 100 : 0
  return Math.min(100, (plannedCost.value / budget) * 100)
})

function isoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayIso(offset = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return isoDate(date)
}

function parseDate(value) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value) {
  const date = parseDate(value)
  if (!date) return 'Date not set'
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatRange(trip) {
  const start = parseDate(trip?.startDate)
  const end = parseDate(trip?.endDate)
  if (!start && !end) return 'Dates not set'
  if (!start) return formatDate(trip.endDate)
  if (!end) return formatDate(trip.startDate)

  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const startText = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endText = sameMonth
    ? end.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })
    : end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return `${startText} – ${endText}`
}

function dayCount(trip) {
  const start = parseDate(trip?.startDate)
  const end = parseDate(trip?.endDate)
  if (!start || !end) return 0
  return Math.max(1, Math.round((end - start) / 86400000) + 1)
}

function weekday(value) {
  const date = parseDate(value)
  return date ? date.toLocaleDateString('en-US', { weekday: 'short' }) : ''
}

function dayNumber(value) {
  const date = parseDate(value)
  return date ? date.toLocaleDateString('en-US', { day: 'numeric' }) : ''
}

function monthShort(value) {
  const date = parseDate(value)
  return date ? date.toLocaleDateString('en-US', { month: 'short' }) : ''
}

function formatTime(value) {
  if (!value) return 'Anytime'
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours)) return value
  const date = new Date()
  date.setHours(hours, minutes || 0, 0, 0)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatMoney(value, currency = 'USD') {
  const amount = Number(value) || 0
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0
    }).format(amount)
  } catch {
    return `${currency || ''} ${amount.toLocaleString()}`.trim()
  }
}

function statusMeta(status) {
  return statusOptions.find((option) => option.value === status) || statusOptions[0]
}

function categoryMeta(value) {
  return (
    categories.find((option) => option.value === value) ||
    categories.find((option) => option.value === 'other')
  )
}

function dayActivities(dayId) {
  return store.activitiesByDay[dayId] || []
}

function dayCost(dayId) {
  return dayActivities(dayId).reduce(
    (sum, activity) => sum + (Number(activity.cost) || 0),
    0
  )
}

function dayActivityCount(dayId) {
  return dayActivities(dayId).length
}

function isDayOpen(dayId) {
  return expandedDayId.value === '__all__' || expandedDayId.value === dayId
}

function resetTripForm() {
  Object.assign(tripForm, {
    title: '',
    destination: '',
    startDate: todayIso(7),
    endDate: todayIso(10),
    travelers: 2,
    budget: 1500,
    currency: 'USD',
    status: 'planning',
    cover: '✈️',
    notes: ''
  })
}

function openNewTrip() {
  if (!canManage.value) return
  editingTripId.value = null
  formError.value = ''
  resetTripForm()
  showTripForm.value = true
}

function openEditTrip(trip) {
  if (!canManage.value) return
  editingTripId.value = trip.id
  formError.value = ''
  Object.assign(tripForm, {
    title: trip.title || '',
    destination: trip.destination || '',
    startDate: trip.startDate || '',
    endDate: trip.endDate || '',
    travelers: trip.travelers || 1,
    budget: trip.budget || 0,
    currency: trip.currency || 'USD',
    status: trip.status || 'planning',
    cover: trip.cover || '✈️',
    notes: trip.notes || ''
  })
  showTripForm.value = true
}

function closeTripForm() {
  showTripForm.value = false
  formError.value = ''
}

async function saveTrip() {
  if (!canManage.value) return
  formError.value = ''
  if (!tripForm.title.trim() || !tripForm.destination.trim()) {
    formError.value = 'Trip name and destination are required.'
    return
  }
  if (!tripForm.startDate || !tripForm.endDate) {
    formError.value = 'Start and end dates are required.'
    return
  }
  if (tripForm.endDate < tripForm.startDate) {
    formError.value = 'End date must be on or after the start date.'
    return
  }

  const payload = { ...tripForm }

  if (editingTripId.value) {
    const ok = await store.updateTrip(editingTripId.value, payload)
    if (!ok) {
      formError.value = store.error
      return
    }
    showTripForm.value = false
    return
  }

  const id = await store.addTrip(payload)
  if (!id) {
    formError.value = store.error
    return
  }
  showTripForm.value = false
  selectedTripId.value = id
  expandedDayId.value = null
  activityFormDayId.value = null
  dayForm.date = payload.startDate
  dayForm.title = ''
  store.watchTrip(id)
}

function selectTrip(trip) {
  selectedTripId.value = trip.id
  expandedDayId.value = null
  activityFormDayId.value = null
  dayForm.date = trip.startDate || ''
  dayForm.title = ''
  dayError.value = ''
  store.watchTrip(trip.id)
}

function backToTrips() {
  selectedTripId.value = null
  expandedDayId.value = null
  activityFormDayId.value = null
  dayError.value = ''
  store.clearTrip()
}

function toggleDay(day) {
  if (expandedDayId.value === day.id) {
    expandedDayId.value = null
    activityFormDayId.value = null
    return
  }
  expandedDayId.value = day.id
  activityFormDayId.value = null
}

function openActivityForm(dayId) {
  if (!canManage.value) return
  activityFormDayId.value = dayId
  activityForm.time = '09:00'
  activityForm.title = ''
  activityForm.location = ''
  activityForm.category = 'sightseeing'
  activityForm.cost = 0
  activityForm.notes = ''
}

function closeActivityForm() {
  activityFormDayId.value = null
}

async function addDay() {
  if (!canManage.value) return
  dayError.value = ''
  if (!selectedTrip.value) return
  if (!dayForm.date) {
    dayError.value = 'Pick a date for this day.'
    return
  }

  const title = dayForm.title.trim() || `Day ${store.days.length + 1}`
  const id = await store.addDay(selectedTrip.value.id, {
    date: dayForm.date,
    title
  })
  if (!id) {
    dayError.value = store.error
    return
  }

  expandedDayId.value = id
  const next = parseDate(dayForm.date)
  if (next) {
    next.setDate(next.getDate() + 1)
    dayForm.date = isoDate(next)
  }
  dayForm.title = ''
}

async function removeDay(day) {
  if (!canManage.value) return
  if (!selectedTrip.value) return
  if (!window.confirm(`Delete "${day.title}" and all its activities?`)) return
  const ok = await store.removeDay(selectedTrip.value.id, day.id)
  if (ok && expandedDayId.value === day.id) expandedDayId.value = null
}

function openDayEdit(day) {
  if (!canManage.value) return
  editingDay.value = day
  dayNameInput.value = day.title || ''
  dayNameError.value = ''
  nextTick(() => dayNameInputEl.value?.focus())
}

function closeDayEdit() {
  editingDay.value = null
  dayNameInput.value = ''
  dayNameError.value = ''
}

async function saveDayName() {
  if (!canManage.value || !selectedTrip.value || !editingDay.value) return
  const title = dayNameInput.value.trim()
  if (!title) {
    dayNameError.value = 'Day name cannot be empty.'
    return
  }

  const ok = await store.updateDay(selectedTrip.value.id, editingDay.value.id, {
    date: editingDay.value.date,
    title
  })
  if (!ok) {
    dayNameError.value = store.error
    return
  }
  closeDayEdit()
}

async function addActivity(dayId) {
  if (!canManage.value) return
  if (!selectedTrip.value) return
  if (!activityForm.title.trim()) return

  const id = await store.addActivity(selectedTrip.value.id, dayId, {
    ...activityForm
  })
  if (!id) return

  activityForm.title = ''
  activityForm.location = ''
  activityForm.notes = ''
  activityForm.cost = 0
}

function removeActivity(dayId, activity) {
  if (!canManage.value) return
  if (!selectedTrip.value) return
  return store.removeActivity(selectedTrip.value.id, dayId, activity.id)
}

function openActivityEdit(dayId, activity) {
  if (!canManage.value) return
  editingActivity.value = { dayId, activity }
  activityEditForm.time = activity.time || '09:00'
  activityEditForm.title = activity.title || ''
  activityEditForm.location = activity.location || ''
  activityEditForm.category = activity.category || 'sightseeing'
  activityEditForm.cost = Number(activity.cost) || 0
  activityEditForm.notes = activity.notes || ''
  activityEditError.value = ''
  nextTick(() => activityEditTitleEl.value?.focus())
}

function closeActivityEdit() {
  editingActivity.value = null
  activityEditError.value = ''
}

async function saveActivity() {
  if (!canManage.value || !selectedTrip.value || !editingActivity.value) return
  if (!activityEditForm.title.trim()) {
    activityEditError.value = 'Activity title is required.'
    return
  }

  const { dayId, activity } = editingActivity.value
  const ok = await store.updateActivity(selectedTrip.value.id, dayId, activity.id, {
    ...activityEditForm
  })
  if (!ok) {
    activityEditError.value = store.error
    return
  }
  closeActivityEdit()
}

async function removeTrip() {
  if (!canManage.value) return
  const trip = selectedTrip.value
  if (!trip) return
  if (!window.confirm(`Delete "${trip.title}" and all of its plans?`)) return
  const ok = await store.removeTrip(trip.id)
  if (ok) backToTrips()
}

function buildItineraryText() {
  const trip = selectedTrip.value
  if (!trip) return ''

  const travelerLabel = `${trip.travelers} traveler${trip.travelers === 1 ? '' : 's'}`
  const lines = [
    `${trip.cover || '✈️'} ${trip.title}`,
    `${trip.destination} · ${formatRange(trip)} · ${travelerLabel}`,
    `Status: ${statusMeta(trip.status).label} · Budget: ${formatMoney(trip.budget, trip.currency)}`,
    ''
  ]

  for (const day of store.days) {
    lines.push(`${formatDate(day.date)} — ${day.title}`)
    const activities = dayActivities(day.id).slice().sort((a, b) => {
      return (a.time || '').localeCompare(b.time || '')
    })
    if (!activities.length) {
      lines.push('  (No activities planned)')
    }
    for (const activity of activities) {
      const details = [
        activity.time ? formatTime(activity.time) : '',
        categoryMeta(activity.category).label,
        activity.location,
        activity.cost ? formatMoney(activity.cost, trip.currency) : ''
      ].filter(Boolean)
      lines.push(`  - ${activity.title}${details.length ? ` (${details.join(' · ')})` : ''}`)
      if (activity.notes) lines.push(`      ${activity.notes}`)
    }
    lines.push('')
  }

  if (trip.notes) {
    lines.push('Trip notes:', trip.notes)
  }

  return lines.join('\n')
}

function fallbackCopy(text) {
  const area = document.createElement('textarea')
  area.value = text
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  document.body.removeChild(area)
}

async function copyItinerary() {
  const text = buildItineraryText()
  if (!text) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      fallbackCopy(text)
    }
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    fallbackCopy(text)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}

function printItinerary() {
  if (!selectedTrip.value) return
  expandedDayId.value = '__all__'
  window.setTimeout(() => {
    window.print()
    expandedDayId.value = null
  }, 150)
}

onMounted(() => {
  store.init()
})

onUnmounted(() => {
  store.dispose()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 anim-fade-up sm:flex-row sm:items-end sm:justify-between no-print">
      <div>
        <h1 class="text-2xl font-extrabold text-gray-800 lg:text-3xl">
          Holiday Planner <span class="inline-block anim-float">✈️</span>
        </h1>
        <p class="mt-1 text-gray-500">
          Build a polished, day-by-day itinerary for your next trip.
        </p>
      </div>
      <div class="flex items-center gap-2 self-start sm:self-auto">
        <span
          v-if="!canManage"
          class="inline-flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-600"
        >
          👀 View only
        </span>
        <button
          v-if="selectedTrip"
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-white/80 px-4 py-2.5 text-sm font-semibold text-blue-600 shadow-sm transition-all duration-300 hover:bg-blue-50 active:scale-95"
          @click="printItinerary"
        >
          🖨️ Print
        </button>
        <button
          v-if="canManage"
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-95"
          @click="openNewTrip"
        >
          + New Trip
        </button>
      </div>
    </div>

    <div
      v-if="store.error"
      class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 no-print"
    >
      {{ store.error }}
    </div>

    <template v-if="!selectedTrip">
      <div
        class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 p-6 text-white shadow-xl shadow-blue-200/60 anim-fade-up sm:p-8"
      >
        <div class="pointer-events-none absolute inset-0 opacity-20" aria-hidden="true">
          <span class="absolute -right-6 -top-8 text-8xl">🌍</span>
          <span class="absolute bottom-2 right-24 text-5xl anim-float">🧳</span>
          <span class="absolute -bottom-6 left-1/3 text-7xl">🗺️</span>
        </div>
        <div class="relative max-w-2xl">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
            Plan something unforgettable
          </p>
          <h2 class="mt-2 text-2xl font-extrabold sm:text-3xl">
            Your next great escape starts here.
          </h2>
          <p class="mt-2 max-w-xl text-sm text-white/85">
            Capture flights, stays, meals, and adventures in one professional itinerary your whole
            family can follow.
          </p>
          <button
            v-if="canManage"
            type="button"
            class="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-blue-600 shadow-lg shadow-blue-900/10 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
            @click="openNewTrip"
          >
            Create your first trip →
          </button>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-3 sm:gap-4">
        <div
          class="rounded-2xl border border-blue-50 bg-white/80 p-4 shadow-sm backdrop-blur anim-fade-up sm:p-5"
          style="--delay: 60ms"
        >
          <p class="text-2xl font-extrabold text-gray-800">{{ totalTrips }}</p>
          <p class="text-xs text-gray-400">Total trips</p>
        </div>
        <div
          class="rounded-2xl border border-blue-50 bg-white/80 p-4 shadow-sm backdrop-blur anim-fade-up sm:p-5"
          style="--delay: 120ms"
        >
          <p class="text-2xl font-extrabold text-blue-600">{{ upcomingTrips }}</p>
          <p class="text-xs text-gray-400">Upcoming</p>
        </div>
        <div
          class="rounded-2xl border border-blue-50 bg-white/80 p-4 shadow-sm backdrop-blur anim-fade-up sm:p-5"
          style="--delay: 180ms"
        >
          <p class="text-2xl font-extrabold text-emerald-600">{{ completedTrips }}</p>
          <p class="text-xs text-gray-400">Completed</p>
        </div>
      </div>

      <div v-if="store.loading" class="rounded-2xl border border-blue-50 bg-white/80 p-8 text-center text-sm font-semibold text-gray-400">
        Loading your trips…
      </div>

      <div
        v-else-if="!store.trips.length"
        class="rounded-3xl border border-dashed border-blue-200 bg-white/60 p-10 text-center"
      >
        <div class="text-5xl">🧳</div>
        <h3 class="mt-3 text-lg font-extrabold text-gray-700">No trips yet</h3>
        <p class="mt-1 text-sm text-gray-500">
          {{ canManage
            ? 'Create a trip to start shaping your itinerary.'
            : 'No trips have been planned yet. Check back soon.' }}
        </p>
        <button
          v-if="canManage"
          type="button"
          class="mt-4 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-200/60 transition-all hover:bg-blue-600 active:scale-95"
          @click="openNewTrip"
        >
          + New Trip
        </button>
      </div>

      <div v-else class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <button
          v-for="(trip, index) in store.trips"
          :key="trip.id"
          type="button"
          class="group relative flex flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white/80 p-5 text-left shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200 hover:shadow-xl hover:shadow-blue-100/70 active:scale-[0.99] anim-fade-up"
          :style="{ '--delay': `${120 + index * 60}ms` }"
          @click="selectTrip(trip)"
        >
          <div class="flex items-start justify-between gap-3">
            <span
              class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 text-3xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
            >
              {{ trip.cover || '✈️' }}
            </span>
            <span
              class="rounded-full px-2.5 py-1 text-[11px] font-bold"
              :class="statusMeta(trip.status).class"
            >
              {{ statusMeta(trip.status).label }}
            </span>
          </div>

          <h3 class="mt-4 truncate text-lg font-extrabold text-gray-800">
            {{ trip.title }}
          </h3>
          <p class="mt-0.5 truncate text-sm text-gray-500">📍 {{ trip.destination }}</p>
          <p class="mt-2 text-xs font-semibold text-blue-600">🗓️ {{ formatRange(trip) }}</p>

          <div
            class="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs font-semibold text-gray-400"
          >
            <span>👥 {{ trip.travelers }} traveler{{ trip.travelers === 1 ? '' : 's' }}</span>
            <span>{{ formatMoney(trip.budget, trip.currency) }}</span>
          </div>

          <span
            class="pointer-events-none absolute -bottom-8 -right-6 text-8xl opacity-5 transition-transform duration-500 group-hover:scale-110"
            aria-hidden="true"
          >
            {{ trip.cover || '✈️' }}
          </span>
        </button>
      </div>
    </template>

    <template v-else>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50 no-print"
        @click="backToTrips"
      >
        ← All trips
      </button>

      <div
        class="relative overflow-hidden rounded-3xl border border-blue-100 bg-white/85 p-5 shadow-sm backdrop-blur anim-fade-up print-surface sm:p-6"
      >
        <div
          class="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-blue-100 to-cyan-50 opacity-70"
          aria-hidden="true"
        />
        <div class="relative flex flex-col gap-5 sm:flex-row sm:items-start">
          <div
            class="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-100 to-cyan-50 text-5xl shadow-sm"
          >
            {{ selectedTrip.cover || '✈️' }}
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded-full px-2.5 py-1 text-[11px] font-bold"
                :class="statusMeta(selectedTrip.status).class"
              >
                {{ statusMeta(selectedTrip.status).label }}
              </span>
              <span class="text-xs font-semibold text-gray-400">
                {{ selectedTrip.travelers }} traveler{{ selectedTrip.travelers === 1 ? '' : 's' }}
              </span>
            </div>
            <h2 class="mt-1 truncate text-2xl font-extrabold text-gray-800 sm:text-3xl">
              {{ selectedTrip.title }}
            </h2>
            <p class="text-sm text-gray-500">📍 {{ selectedTrip.destination }}</p>
            <p class="mt-1 text-sm font-semibold text-blue-600">
              🗓️ {{ formatRange(selectedTrip) }}
              <span class="text-gray-400">
                · {{ dayCount(selectedTrip) }} days
                <template v-if="dayCount(selectedTrip) > 1">
                  / {{ dayCount(selectedTrip) - 1 }} nights
                </template>
              </span>
            </p>
          </div>

          <div class="flex flex-wrap gap-2 no-print">
            <button
              v-if="canManage"
              type="button"
              class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-all hover:border-blue-200 hover:text-blue-600 active:scale-95"
              @click="openEditTrip(selectedTrip)"
            >
              ✏️ Edit
            </button>
            <button
              type="button"
              class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-all hover:border-blue-200 hover:text-blue-600 active:scale-95"
              @click="copyItinerary"
            >
              {{ copied ? '✓ Copied' : '📋 Copy' }}
            </button>
            <button
              type="button"
              class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-all hover:border-blue-200 hover:text-blue-600 active:scale-95"
              @click="printItinerary"
            >
              🖨️ Print
            </button>
            <button
              v-if="canManage"
              type="button"
              class="rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-semibold text-red-500 transition-all hover:bg-red-50 active:scale-95"
              @click="removeTrip"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border border-blue-50 bg-white/80 p-5 shadow-sm backdrop-blur print-surface">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Planned spend</p>
          <p class="mt-1 text-2xl font-extrabold text-gray-800">
            {{ formatMoney(plannedCost, selectedTrip.currency) }}
          </p>
          <div class="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div
              class="h-full rounded-full transition-all duration-700 ease-out"
              :class="overBudget
                ? 'bg-gradient-to-r from-rose-500 to-orange-400'
                : 'bg-gradient-to-r from-blue-500 to-cyan-500'"
              :style="{ width: budgetProgress + '%' }"
            />
          </div>
          <p
            v-if="overBudget"
            class="mt-2 text-[11px] font-semibold text-rose-500"
          >
            Over budget by {{ formatMoney(plannedCost - (Number(selectedTrip.budget) || 0), selectedTrip.currency) }}
          </p>
          <p
            v-else-if="Number(selectedTrip.budget) > 0"
            class="mt-2 text-[11px] font-semibold text-gray-400"
          >
            of {{ formatMoney(selectedTrip.budget, selectedTrip.currency) }} budget
          </p>
          <p v-else class="mt-2 text-[11px] font-semibold text-gray-400">No budget set</p>
        </div>

        <div class="rounded-2xl border border-blue-50 bg-white/80 p-5 shadow-sm backdrop-blur print-surface">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Activities</p>
          <p class="mt-1 text-2xl font-extrabold text-gray-800">{{ plannedActivities }}</p>
          <p class="mt-2 text-[11px] text-gray-400">
            Across {{ store.days.length }} planned day{{ store.days.length === 1 ? '' : 's' }}
          </p>
        </div>

        <div class="rounded-2xl border border-blue-50 bg-white/80 p-5 shadow-sm backdrop-blur print-surface">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Itinerary</p>
          <p class="mt-1 text-2xl font-extrabold text-gray-800">
            {{ store.days.length }}<span class="text-base font-semibold text-gray-400"> / {{ dayCount(selectedTrip) || '–' }}</span>
          </p>
          <p class="mt-2 text-[11px] text-gray-400">Days planned for this trip</p>
        </div>
      </div>

      <div
        v-if="selectedTrip.notes"
        class="rounded-2xl border border-blue-50 bg-white/80 p-5 shadow-sm backdrop-blur print-surface"
      >
        <h3 class="text-sm font-bold text-gray-700">📝 Trip notes</h3>
        <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-500">
          {{ selectedTrip.notes }}
        </p>
      </div>

      <div
        v-if="canManage"
        class="rounded-2xl border border-blue-100 bg-white/80 p-4 shadow-sm backdrop-blur no-print"
      >
        <div class="flex flex-col gap-3 sm:flex-row">
          <input
            v-model="dayForm.date"
            type="date"
            class="rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all duration-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <input
            v-model="dayForm.title"
            placeholder="Day theme — e.g. Old town & street food"
            class="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all duration-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            @keyup.enter="addDay"
          />
          <button
            type="button"
            class="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-95"
            @click="addDay"
          >
            + Add day
          </button>
        </div>
        <p v-if="dayError" class="mt-2 text-xs font-semibold text-red-500">{{ dayError }}</p>
      </div>
      <div
        v-else
        class="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-xs font-semibold text-amber-700 no-print"
      >
        👀 View only — ask an admin or parent to make changes to this itinerary.
      </div>

      <div
        v-if="!store.days.length"
        class="rounded-3xl border border-dashed border-blue-200 bg-white/60 p-10 text-center"
      >
        <div class="text-5xl">🗓️</div>
        <h3 class="mt-3 text-lg font-extrabold text-gray-700">Your itinerary is empty</h3>
        <p class="mt-1 text-sm text-gray-500">
          {{ canManage
            ? 'Add the first day above, then fill it with flights, meals, and adventures.'
            : 'An admin or parent has not added any days to this trip yet.' }}
        </p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="(day, index) in store.days"
          :key="day.id"
          class="overflow-hidden rounded-2xl border border-blue-100 bg-white/80 shadow-sm backdrop-blur anim-fade-up print-surface"
        >
          <div class="flex items-center gap-2 p-4 sm:gap-3">
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-3 text-left"
              @click="toggleDay(day)"
            >
              <span
                class="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-200"
              >
                <span class="text-[9px] font-bold uppercase tracking-wide opacity-90">
                  {{ weekday(day.date) }}
                </span>
                <span class="text-lg font-extrabold leading-none">{{ dayNumber(day.date) }}</span>
                <span class="text-[9px] font-semibold uppercase">{{ monthShort(day.date) }}</span>
              </span>

              <div class="min-w-0 flex-1">
                <MarqueeText
                  :text="day.title || `Day ${index + 1}`"
                  class="text-sm font-bold text-gray-800"
                />
                <p class="truncate text-xs text-gray-400">
                  {{ formatDate(day.date) }} · {{ dayActivityCount(day.id) }} activities ·
                  {{ formatMoney(dayCost(day.id), selectedTrip.currency) }}
                </p>
              </div>
            </button>

            <button
              type="button"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500 transition-all hover:bg-blue-100 active:scale-90"
              :aria-expanded="isDayOpen(day.id)"
              :aria-label="isDayOpen(day.id) ? 'Collapse day' : 'Expand day'"
              @click="toggleDay(day)"
            >
              <span class="text-lg font-bold">{{ isDayOpen(day.id) ? '−' : '+' }}</span>
            </button>

            <button
              v-if="canManage"
              type="button"
              class="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-blue-400 transition-colors hover:bg-blue-50 hover:text-blue-600 no-print"
              @click="openDayEdit(day)"
            >
              Edit
            </button>

            <button
              v-if="canManage"
              type="button"
              class="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 no-print"
              @click="removeDay(day)"
            >
              Delete
            </button>
          </div>

          <div v-if="isDayOpen(day.id)" class="border-t border-gray-100 px-4 pb-4 pt-3">
            <div v-if="dayActivities(day.id).length" class="space-y-3">
              <div
                v-for="activity in dayActivities(day.id)"
                :key="activity.id"
                class="group flex gap-3"
              >
                <div class="flex flex-col items-center">
                  <span
                    class="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                    :class="categoryMeta(activity.category).class"
                  >
                    {{ categoryMeta(activity.category).icon }}
                  </span>
                  <span class="mt-1 w-px flex-1 bg-gradient-to-b from-blue-100 to-transparent" />
                </div>

                <div class="flex-1 rounded-xl bg-gray-50/80 p-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-bold text-blue-600">{{ formatTime(activity.time) }}</span>
                    <span
                      class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      :class="categoryMeta(activity.category).class"
                    >
                      {{ categoryMeta(activity.category).label }}
                    </span>
                  </div>
                  <p class="mt-1 text-sm font-bold text-gray-800">{{ activity.title }}</p>
                  <p v-if="activity.location" class="text-xs text-gray-500">
                    📍 {{ activity.location }}
                  </p>
                  <p v-if="activity.notes" class="mt-1 text-xs leading-relaxed text-gray-500">
                    {{ activity.notes }}
                  </p>
                  <div class="mt-2 flex items-center justify-between">
                    <span v-if="activity.cost" class="text-xs font-bold text-emerald-600">
                      {{ formatMoney(activity.cost, selectedTrip.currency) }}
                    </span>
                    <span v-else class="text-xs text-gray-400">Free</span>
                    <div v-if="canManage" class="flex items-center gap-1 no-print">
                      <button
                        type="button"
                        class="rounded-lg px-2 py-1 text-[11px] font-semibold text-blue-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                        @click="openActivityEdit(day.id, activity)"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        class="rounded-lg px-2 py-1 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        @click="removeActivity(day.id, activity)"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p
              v-else
              class="rounded-xl bg-gray-50 px-3 py-4 text-center text-xs font-semibold text-gray-400"
            >
              {{ canManage
                ? 'No activities yet. Add your first stop.'
                : 'No activities planned for this day yet.' }}
            </p>

            <template v-if="canManage">
              <button
                v-if="activityFormDayId !== day.id"
                type="button"
                class="mt-3 w-full rounded-xl border border-dashed border-blue-200 px-4 py-2.5 text-xs font-bold text-blue-500 transition-colors hover:bg-blue-50 no-print"
                @click="openActivityForm(day.id)"
              >
                + Add activity
              </button>

              <div
                v-else
                class="mt-3 space-y-2 rounded-xl border border-blue-100 bg-blue-50/40 p-3 no-print"
              >
              <div class="grid grid-cols-2 gap-2">
                <input
                  v-model="activityForm.time"
                  type="time"
                  class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <select
                  v-model="activityForm.category"
                  class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option v-for="cat in categories" :key="cat.value" :value="cat.value">
                    {{ cat.icon }} {{ cat.label }}
                  </option>
                </select>
              </div>
              <input
                v-model="activityForm.title"
                placeholder="What are you doing?"
                class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                @keyup.enter="addActivity(day.id)"
              />
              <input
                v-model="activityForm.location"
                placeholder="Location / address"
                class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <div class="grid grid-cols-2 gap-2">
                <input
                  v-model="activityForm.cost"
                  type="number"
                  min="0"
                  max="10000000"
                  step="0.01"
                  placeholder="Cost"
                  class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <input
                  v-model="activityForm.notes"
                  maxlength="300"
                  placeholder="Notes (optional)"
                  class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div class="flex gap-2 pt-1">
                <button
                  type="button"
                  class="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
                  @click="addActivity(day.id)"
                >
                  Add to itinerary
                </button>
                <button
                  type="button"
                  class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-500 transition-all hover:bg-gray-50 active:scale-95"
                  @click="closeActivityForm"
                >
                  Cancel
                </button>
              </div>
            </div>
            </template>
          </div>
        </div>
      </div>
    </template>

    <Teleport to="body">
      <div
        v-if="showTripForm && canManage"
        class="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6"
      >
        <div class="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" @click="closeTripForm" />

        <div
          class="relative max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl anim-scale-in sm:max-w-2xl sm:rounded-3xl sm:p-6"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-xl font-extrabold text-gray-800">
                {{ editingTripId ? 'Edit trip' : 'Create a new trip' }}
              </h2>
              <p class="text-sm text-gray-500">
                Set the essentials, then build the day-by-day plan.
              </p>
            </div>
            <button
              type="button"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 active:scale-90"
              aria-label="Close"
              @click="closeTripForm"
            >
              ✕
            </button>
          </div>

          <div class="mt-5 space-y-4">
            <div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Cover</label>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="icon in coverOptions"
                  :key="icon"
                  type="button"
                  class="flex h-10 w-10 items-center justify-center rounded-xl border text-xl transition-all duration-200"
                  :class="tripForm.cover === icon
                    ? 'scale-110 border-blue-400 bg-blue-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:bg-gray-50'"
                  @click="tripForm.cover = icon"
                >
                  {{ icon }}
                </button>
              </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div class="sm:col-span-2">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Trip name</label>
                <input
                  v-model="tripForm.title"
                  maxlength="100"
                  placeholder="e.g. Bali Family Escape"
                  class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div class="sm:col-span-2">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Destination</label>
                <input
                  v-model="tripForm.destination"
                  maxlength="120"
                  placeholder="e.g. Bali, Indonesia"
                  class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Start date</label>
                <input
                  v-model="tripForm.startDate"
                  type="date"
                  class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400">End date</label>
                <input
                  v-model="tripForm.endDate"
                  type="date"
                  class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Travelers</label>
                <input
                  v-model="tripForm.travelers"
                  type="number"
                  min="1"
                  max="50"
                  class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Status</label>
                <select
                  v-model="tripForm.status"
                  class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option v-for="status in statusOptions" :key="status.value" :value="status.value">
                    {{ status.label }}
                  </option>
                </select>
              </div>

              <div>
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Budget</label>
                <input
                  v-model="tripForm.budget"
                  type="number"
                  min="0"
                  max="10000000"
                  step="0.01"
                  class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Currency</label>
                <input
                  v-model="tripForm.currency"
                  maxlength="8"
                  placeholder="USD"
                  class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm uppercase outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div class="sm:col-span-2">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Notes</label>
                <textarea
                  v-model="tripForm.notes"
                  rows="3"
                  maxlength="1000"
                  placeholder="Flights, reservations, reminders…"
                  class="mt-1 w-full resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <p
              v-if="formError"
              class="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"
            >
              {{ formError }}
            </p>

            <div class="flex gap-3 pt-1">
              <button
                type="button"
                class="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-500 transition-all hover:bg-gray-50 active:scale-95"
                @click="closeTripForm"
              >
                Cancel
              </button>
              <button
                type="button"
                class="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200/60 transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-95"
                @click="saveTrip"
              >
                {{ editingTripId ? 'Save changes' : 'Create trip' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="editingDay && canManage"
        class="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6"
      >
        <div class="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" @click="closeDayEdit" />

        <div
          class="relative w-full rounded-t-3xl bg-white p-5 shadow-2xl anim-scale-in sm:max-w-md sm:rounded-3xl sm:p-6"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-lg font-extrabold text-gray-800">Edit day name</h2>
              <p class="mt-0.5 text-sm text-gray-500">{{ formatDate(editingDay.date) }}</p>
            </div>
            <button
              type="button"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 active:scale-90"
              aria-label="Close"
              @click="closeDayEdit"
            >
              ✕
            </button>
          </div>

          <form class="mt-5 space-y-4" @submit.prevent="saveDayName">
            <div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Day name</label>
              <input
                ref="dayNameInputEl"
                v-model="dayNameInput"
                maxlength="100"
                placeholder="e.g. Old town & street food"
                class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                @keyup.esc="closeDayEdit"
              />
            </div>

            <p v-if="dayNameError" class="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
              {{ dayNameError }}
            </p>

            <div class="flex gap-3 pt-1">
              <button
                type="button"
                class="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-500 transition-all hover:bg-gray-50 active:scale-95"
                @click="closeDayEdit"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200/60 transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-95"
              >
                Save name
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="editingActivity && canManage"
        class="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6"
      >
        <div class="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" @click="closeActivityEdit" />

        <div
          class="relative max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl anim-scale-in sm:max-w-lg sm:rounded-3xl sm:p-6"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-lg font-extrabold text-gray-800">Edit activity</h2>
              <p class="mt-0.5 text-sm text-gray-500">Update this stop without removing it.</p>
            </div>
            <button
              type="button"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 active:scale-90"
              aria-label="Close"
              @click="closeActivityEdit"
            >
              ✕
            </button>
          </div>

          <form class="mt-5 space-y-3" @submit.prevent="saveActivity">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Time</label>
                <input
                  v-model="activityEditForm.time"
                  type="time"
                  class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Category</label>
                <select
                  v-model="activityEditForm.category"
                  class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option v-for="cat in categories" :key="cat.value" :value="cat.value">
                    {{ cat.icon }} {{ cat.label }}
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Activity</label>
              <input
                ref="activityEditTitleEl"
                v-model="activityEditForm.title"
                maxlength="120"
                placeholder="What are you doing?"
                class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                @keyup.esc="closeActivityEdit"
              />
            </div>

            <div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Location</label>
              <input
                v-model="activityEditForm.location"
                maxlength="120"
                placeholder="Location / address"
                class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Cost</label>
                <input
                  v-model="activityEditForm.cost"
                  type="number"
                  min="0"
                  max="10000000"
                  step="0.01"
                  class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Notes</label>
                <input
                  v-model="activityEditForm.notes"
                  maxlength="300"
                  placeholder="Optional"
                  class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <p v-if="activityEditError" class="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
              {{ activityEditError }}
            </p>

            <div class="flex gap-3 pt-1">
              <button
                type="button"
                class="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-500 transition-all hover:bg-gray-50 active:scale-95"
                @click="closeActivityEdit"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200/60 transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-95"
              >
                Save changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>