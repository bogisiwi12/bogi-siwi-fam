<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useHolidayStore } from '@/stores/holidayStore'
import { useAuthStore } from '@/stores/authStore'
import {
  normalizeItineraryImageUrl,
  isBookingReceiptDriveConfigured,
  uploadBookingReceipt
} from '@/services/googleDrive'
import MarqueeText from '@/components/MarqueeText.vue'

const store = useHolidayStore()
const auth = useAuthStore()
const canManage = computed(() => auth.isAdmin || auth.isParent)
const receiptDriveReady = isBookingReceiptDriveConfigured()

const selectedTripId = ref('')
const selectedTrip = computed(
  () => store.trips.find((trip) => trip.id === selectedTripId.value) || null
)

const activeActivity = ref(null)
const showBookingModal = ref(false)
const bookingError = ref('')
const receiptUploading = ref(false)
const receiptInputEl = ref(null)
const viewingReceipt = ref(null)

const bookingForm = reactive({
  realizationCost: 0,
  notes: '',
  receiptUrl: '',
  receiptFileId: '',
  receiptName: '',
  receiptMime: ''
})

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

const costedDays = computed(() =>
  store.days
    .map((day) => ({
      day,
      activities: (store.activitiesByDay[day.id] || [])
        .filter((activity) => (Number(activity.cost) || 0) > 0)
        .map((activity) => ({
          ...activity,
          dayId: day.id,
          dayDate: day.date,
          dayTitle: day.title
        }))
    }))
    .filter((group) => group.activities.length)
)

const costedActivities = computed(() => costedDays.value.flatMap((group) => group.activities))

const plannedTotal = computed(() =>
  costedActivities.value.reduce((sum, activity) => sum + (Number(activity.cost) || 0), 0)
)

const realizedTotal = computed(() =>
  Object.values(store.bookingsByActivity).reduce(
    (sum, booking) => sum + (Number(booking.realizationCost) || 0),
    0
  )
)

const bookedCount = computed(
  () => costedActivities.value.filter((activity) => store.bookingsByActivity[activity.id]).length
)

const budget = computed(() => Number(selectedTrip.value?.budget) || 0)
const remainingBudget = computed(() => budget.value - realizedTotal.value)
const variance = computed(() => realizedTotal.value - plannedTotal.value)

const budgetProgress = computed(() => {
  if (!budget.value) return realizedTotal.value > 0 ? 100 : 0
  return Math.min(100, (realizedTotal.value / budget.value) * 100)
})

const overBudget = computed(() => budget.value > 0 && realizedTotal.value > budget.value)

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

function categoryMeta(value) {
  return (
    categories.find((option) => option.value === value) ||
    categories.find((option) => option.value === 'other')
  )
}

function bookingFor(activityId) {
  return store.bookingsByActivity[activityId] || null
}

function receiptIsImage(item) {
  const mime = item?.receiptMime || ''
  if (mime.startsWith('image/')) return true
  const name = item?.receiptName || item?.receiptUrl || ''
  return /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(name)
}

function isReceiptPreviewImage(itemOrUrl) {
  if (itemOrUrl && typeof itemOrUrl === 'object') return receiptIsImage(itemOrUrl)
  return /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(String(itemOrUrl || ''))
}

function receiptPreviewUrl(url, isImage) {
  const normalized = normalizeItineraryImageUrl(url)
  if (isImage) return normalized
  try {
    const parsed = new URL(normalized)
    if (parsed.origin === 'https://www.googleapis.com' && parsed.pathname.startsWith('/drive/v3/files/')) {
      const id = parsed.pathname.split('/').pop()
      if (id) return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`
    }
    if (parsed.origin === 'https://drive.google.com') {
      const match = parsed.pathname.match(/^\/file\/d\/([^/]+)/)
      if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
    }
  } catch {
    // Fall back to the normalized URL.
  }
  return normalized
}

function openReceipt(url, title, item = null) {
  if (!url) return
  const isImage = isReceiptPreviewImage(item || url)
  viewingReceipt.value = {
    url: receiptPreviewUrl(url, isImage),
    title,
    isImage
  }
}

function closeReceipt() {
  viewingReceipt.value = null
}

function selectTrip(id) {
  selectedTripId.value = id
}

function openBooking(activity) {
  if (!canManage.value || !selectedTrip.value) return
  const existing = bookingFor(activity.id)
  activeActivity.value = activity
  if (existing) {
    Object.assign(bookingForm, {
      realizationCost: Number(existing.realizationCost) || 0,
      notes: existing.notes || '',
      receiptUrl: existing.receiptUrl || '',
      receiptFileId: existing.receiptFileId || '',
      receiptName: existing.receiptName || '',
      receiptMime: existing.receiptMime || ''
    })
  } else {
    Object.assign(bookingForm, {
      realizationCost: Number(activity.cost) || 0,
      notes: '',
      receiptUrl: '',
      receiptFileId: '',
      receiptName: '',
      receiptMime: ''
    })
  }
  bookingError.value = ''
  showBookingModal.value = true
}

function closeBooking() {
  showBookingModal.value = false
  activeActivity.value = null
  bookingError.value = ''
}

function pickReceipt() {
  receiptInputEl.value?.click()
}

async function handleReceiptChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || !activeActivity.value) return
  receiptUploading.value = true
  bookingError.value = ''
  try {
    const result = await uploadBookingReceipt(file, activeActivity.value.title || 'booking')
    bookingForm.receiptUrl = result.url
    bookingForm.receiptFileId = result.id
    bookingForm.receiptName = result.name
    bookingForm.receiptMime = result.mimeType || file.type
  } catch (err) {
    bookingError.value = err?.message || 'Could not upload the receipt.'
  } finally {
    receiptUploading.value = false
  }
}

function removeReceipt() {
  bookingForm.receiptUrl = ''
  bookingForm.receiptFileId = ''
  bookingForm.receiptName = ''
  bookingForm.receiptMime = ''
}

async function saveBooking() {
  if (!canManage.value || !selectedTrip.value || !activeActivity.value) return
  bookingError.value = ''
  const amount = Number(bookingForm.realizationCost)
  if (!Number.isFinite(amount) || amount < 0) {
    bookingError.value = 'Enter a valid realization cost.'
    return
  }

  const activity = activeActivity.value
  const ok = await store.saveBooking(selectedTrip.value.id, activity, {
    dayId: activity.dayId,
    dayDate: activity.dayDate,
    dayTitle: activity.dayTitle,
    title: activity.title,
    category: activity.category,
    plannedCost: Number(activity.cost) || 0,
    realizationCost: amount,
    currency: selectedTrip.value.currency || 'USD',
    receiptUrl: bookingForm.receiptUrl,
    receiptFileId: bookingForm.receiptFileId,
    receiptName: bookingForm.receiptName,
    receiptMime: bookingForm.receiptMime,
    notes: bookingForm.notes,
    createdBy: auth.user?.uid || '',
    createdByName: auth.displayName
  })

  if (!ok) {
    bookingError.value = store.error
    return
  }
  closeBooking()
}

async function deleteBooking() {
  if (!canManage.value || !selectedTrip.value || !activeActivity.value) return
  if (!window.confirm('Delete this booking transaction?')) return
  const ok = await store.removeBooking(selectedTrip.value.id, activeActivity.value.id)
  if (ok) closeBooking()
}

watch(selectedTripId, (id) => {
  if (id) {
    store.watchTrip(id)
  } else {
    store.clearTrip()
  }
})

function handleKeydown(event) {
  if (event.key === 'Escape') {
    if (viewingReceipt.value) closeReceipt()
    else if (showBookingModal.value) closeBooking()
  }
}

onMounted(() => {
  store.init()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  store.dispose()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 anim-fade-up sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-extrabold text-gray-800 lg:text-3xl">
          Booking Transactions <span class="inline-block anim-float">🧾</span>
        </h1>
        <p class="mt-1 text-gray-500">
          Match each itinerary budget to a booking receipt and its real cost.
        </p>
      </div>
      <span
        v-if="!canManage"
        class="inline-flex items-center gap-2 self-start rounded-xl border border-amber-100 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-600 sm:self-auto"
      >
        👀 View only
      </span>
    </div>

    <div
      v-if="store.error"
      class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600"
    >
      {{ store.error }}
    </div>

    <div
      class="rounded-2xl border border-blue-100 bg-white/85 p-4 shadow-sm backdrop-blur anim-fade-up sm:p-5"
    >
      <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Select trip</label>
      <div class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          :value="selectedTripId"
          class="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:max-w-md"
          @change="selectTrip($event.target.value)"
        >
          <option value="">Choose a trip…</option>
          <option v-for="trip in store.trips" :key="trip.id" :value="trip.id">
            {{ trip.cover || '✈️' }} {{ trip.title }} — {{ trip.destination }}
          </option>
        </select>
        <RouterLink
          to="/holiday"
          class="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-600 transition-all hover:bg-blue-100 active:scale-95"
        >
          ← Back to itineraries
        </RouterLink>
      </div>
    </div>

    <div
      v-if="store.loading"
      class="rounded-2xl border border-blue-50 bg-white/80 p-8 text-center text-sm font-semibold text-gray-400"
    >
      Loading your trips…
    </div>

    <div
      v-else-if="!store.trips.length"
      class="rounded-3xl border border-dashed border-blue-200 bg-white/60 p-10 text-center"
    >
      <div class="text-5xl">🧳</div>
      <h3 class="mt-3 text-lg font-extrabold text-gray-700">No trips yet</h3>
      <p class="mt-1 text-sm text-gray-500">
        Create an itinerary first, then come back to record booking transactions.
      </p>
    </div>

    <template v-else-if="selectedTrip">
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border border-blue-50 bg-white/80 p-5 shadow-sm backdrop-blur">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Planned</p>
          <p class="mt-1 text-2xl font-extrabold text-gray-800">
            {{ formatMoney(plannedTotal, selectedTrip.currency) }}
          </p>
          <p class="mt-2 text-[11px] text-gray-400">
            Across {{ costedActivities.length }} costed item{{ costedActivities.length === 1 ? '' : 's' }}
          </p>
        </div>

        <div class="rounded-2xl border border-blue-50 bg-white/80 p-5 shadow-sm backdrop-blur">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Realized</p>
          <p class="mt-1 text-2xl font-extrabold text-emerald-600">
            {{ formatMoney(realizedTotal, selectedTrip.currency) }}
          </p>
          <p class="mt-2 text-[11px] text-gray-400">
            {{ bookedCount }} of {{ costedActivities.length }} booked
          </p>
        </div>

        <div class="rounded-2xl border border-blue-50 bg-white/80 p-5 shadow-sm backdrop-blur">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Remaining budget
          </p>
          <p
            class="mt-1 text-2xl font-extrabold"
            :class="overBudget ? 'text-rose-500' : 'text-gray-800'"
          >
            {{ budget ? formatMoney(remainingBudget, selectedTrip.currency) : '—' }}
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
            v-if="budget && overBudget"
            class="mt-2 text-[11px] font-semibold text-rose-500"
          >
            Over budget by {{ formatMoney(realizedTotal - budget, selectedTrip.currency) }}
          </p>
          <p v-else-if="budget" class="mt-2 text-[11px] font-semibold text-gray-400">
            of {{ formatMoney(budget, selectedTrip.currency) }} trip budget
          </p>
          <p v-else class="mt-2 text-[11px] font-semibold text-gray-400">No budget set</p>
        </div>
      </div>

      <div
        class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-50 bg-white/70 px-4 py-3 text-xs font-semibold"
      >
        <span class="text-gray-500">
          {{ selectedTrip.title }} · {{ formatMoney(plannedTotal, selectedTrip.currency) }} planned
        </span>
        <span :class="variance > 0 ? 'text-rose-500' : 'text-emerald-600'">
          {{ variance > 0 ? 'Over plan' : 'Under plan' }} by
          {{ formatMoney(Math.abs(variance), selectedTrip.currency) }}
        </span>
      </div>

      <div
        v-if="!costedActivities.length"
        class="rounded-3xl border border-dashed border-blue-200 bg-white/60 p-10 text-center"
      >
        <div class="text-5xl">💸</div>
        <h3 class="mt-3 text-lg font-extrabold text-gray-700">No costed itinerary items</h3>
        <p class="mt-1 text-sm text-gray-500">
          Add a cost to an activity in the itinerary to record its booking here.
        </p>
        <RouterLink
          to="/holiday"
          class="mt-4 inline-flex rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-200/60 transition-all hover:bg-blue-600 active:scale-95"
        >
          Open itinerary
        </RouterLink>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="group in costedDays"
          :key="group.day.id"
          class="overflow-hidden rounded-2xl border border-blue-100 bg-white/80 shadow-sm backdrop-blur"
        >
          <div class="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
            <span
              class="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-200"
            >
              <span class="text-[9px] font-bold uppercase tracking-wide opacity-90">
                {{ parseDate(group.day.date)?.toLocaleDateString('en-US', { weekday: 'short' }) }}
              </span>
              <span class="text-lg font-extrabold leading-none">
                {{ parseDate(group.day.date)?.toLocaleDateString('en-US', { day: 'numeric' }) }}
              </span>
              <span class="text-[9px] font-semibold uppercase">
                {{ parseDate(group.day.date)?.toLocaleDateString('en-US', { month: 'short' }) }}
              </span>
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold text-gray-800">{{ group.day.title }}</p>
              <p class="text-xs text-gray-400">{{ formatDate(group.day.date) }}</p>
            </div>
          </div>

          <div class="divide-y divide-gray-100">
            <div
              v-for="activity in group.activities"
              :key="activity.id"
              class="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors sm:flex-nowrap"
              :class="canManage ? 'cursor-pointer hover:bg-blue-50/50' : ''"
              @click="canManage ? openBooking(activity) : null"
            >
              <span
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                :class="categoryMeta(activity.category).class"
              >
                {{ categoryMeta(activity.category).icon }}
              </span>

              <div class="min-w-0 flex-1">
                <MarqueeText
                  :text="activity.title"
                  class="text-sm font-bold text-gray-800"
                />
                <p class="truncate text-xs text-gray-400">
                  {{ categoryMeta(activity.category).label }}
                  <template v-if="activity.location"> · 📍 {{ activity.location }}</template>
                </p>
              </div>

              <div class="flex flex-col items-end text-right">
                <span class="text-xs font-semibold text-gray-400">
                  Planned {{ formatMoney(activity.cost, selectedTrip.currency) }}
                </span>
                <template v-if="bookingFor(activity.id)">
                  <span class="text-sm font-extrabold text-emerald-600">
                    {{ formatMoney(bookingFor(activity.id).realizationCost, selectedTrip.currency) }}
                  </span>
                  <span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-500">
                    ✓ Booked
                  </span>
                </template>
                <span
                  v-else
                  class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600"
                >
                  Not booked
                </span>
              </div>

              <div class="flex shrink-0 items-center gap-1" @click.stop>
                <template v-if="bookingFor(activity.id)?.receiptUrl">
                  <button
                    v-if="receiptIsImage(bookingFor(activity.id))"
                    type="button"
                    class="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 transition-all hover:border-blue-200 hover:text-blue-600 active:scale-95"
                    @click="openReceipt(bookingFor(activity.id).receiptUrl, activity.title, bookingFor(activity.id))"
                  >
                    🧾 Receipt
                  </button>
                  <button
                    v-else
                    type="button"
                    class="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 transition-all hover:border-blue-200 hover:text-blue-600 active:scale-95"
                    @click="openReceipt(bookingFor(activity.id).receiptUrl, activity.title, bookingFor(activity.id))"
                  >
                    🧾 Preview
                  </button>
                </template>
                <button
                  v-if="canManage"
                  type="button"
                  class="rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
                  @click="openBooking(activity)"
                >
                  {{ bookingFor(activity.id) ? 'Edit' : 'Record' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div
      v-else-if="store.trips.length"
      class="rounded-3xl border border-dashed border-blue-200 bg-white/60 p-10 text-center"
    >
      <div class="text-5xl">🗺️</div>
      <h3 class="mt-3 text-lg font-extrabold text-gray-700">Pick a trip to begin</h3>
      <p class="mt-1 text-sm text-gray-500">
        Select a trip above to see its costed itinerary items and record bookings.
      </p>
    </div>

    <Teleport to="body">
      <div
        v-if="showBookingModal && activeActivity && canManage"
        class="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6"
      >
        <div class="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" @click="closeBooking" />

        <div
          class="relative max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl anim-scale-in sm:max-w-lg sm:rounded-3xl sm:p-6"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <h2 class="text-lg font-extrabold text-gray-800">Record booking</h2>
              <p class="mt-0.5 truncate text-sm text-gray-500">{{ activeActivity.title }}</p>
              <p class="text-xs text-gray-400">
                {{ activeActivity.dayTitle }} · {{ formatDate(activeActivity.dayDate) }}
              </p>
            </div>
            <button
              type="button"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 active:scale-90"
              aria-label="Close"
              @click="closeBooking"
            >
              ✕
            </button>
          </div>

          <div
            class="mt-4 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3"
          >
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Itinerary budget
            </span>
            <span class="text-sm font-extrabold text-blue-600">
              {{ formatMoney(activeActivity.cost, selectedTrip?.currency) }}
            </span>
          </div>

          <div class="mt-4 space-y-3">
            <div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">
                Booking receipt
              </label>
              <div class="mt-2 rounded-xl border border-dashed border-blue-200 bg-blue-50/30 p-3">
                <div class="flex items-center gap-3">
                  <template v-if="bookingForm.receiptUrl">
                    <button
                      v-if="receiptIsImage(bookingForm)"
                      type="button"
                      class="relative shrink-0 overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm"
                      @click="openReceipt(bookingForm.receiptUrl, bookingForm.receiptName || 'Receipt', bookingForm)"
                    >
                      <img
                        :src="normalizeItineraryImageUrl(bookingForm.receiptUrl)"
                        :alt="bookingForm.receiptName || 'Receipt'"
                        class="h-16 w-16 object-cover"
                      />
                    </button>
                    <button
                      v-else
                      type="button"
                      class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white text-2xl shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50/40 active:scale-95"
                      @click="openReceipt(bookingForm.receiptUrl, bookingForm.receiptName || 'Receipt', bookingForm)"
                    >
                      📄
                    </button>
                  </template>
                  <div
                    v-else
                    class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white text-2xl"
                  >
                    🧾
                  </div>

                  <div class="min-w-0 flex-1">
                    <p v-if="bookingForm.receiptName" class="truncate text-xs font-semibold text-gray-600">
                      {{ bookingForm.receiptName }}
                    </p>
                    <div class="mt-1 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        :disabled="receiptUploading || !receiptDriveReady"
                        class="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-600 transition-all hover:bg-blue-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        @click="pickReceipt"
                      >
                        <span
                          v-if="receiptUploading"
                          class="h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600"
                        />
                        {{
                          receiptUploading
                            ? 'Uploading…'
                            : bookingForm.receiptUrl
                              ? 'Replace receipt'
                              : 'Upload receipt'
                        }}
                      </button>
                      <button
                        v-if="bookingForm.receiptUrl && !receiptIsImage(bookingForm)"
                        type="button"
                        class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-600 transition-all hover:border-blue-200 hover:text-blue-600 active:scale-95"
                        @click="openReceipt(bookingForm.receiptUrl, bookingForm.receiptName || 'Receipt', bookingForm)"
                      >
                        Preview
                      </button>
                      <button
                        v-if="bookingForm.receiptUrl"
                        type="button"
                        class="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-red-500 transition-colors hover:bg-red-50"
                        @click="removeReceipt"
                      >
                        Remove
                      </button>
                    </div>
                    <p class="mt-1 text-[10px] text-gray-400">Image or PDF — saved to Google Drive.</p>
                    <p v-if="!receiptDriveReady" class="text-[10px] font-medium text-amber-600">
                      Receipt uploads are not configured.
                    </p>
                  </div>
                </div>
                <input
                  ref="receiptInputEl"
                  type="file"
                  accept="image/*,application/pdf"
                  class="hidden"
                  @change="handleReceiptChange"
                />
              </div>
            </div>

            <div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">
                Realization cost
              </label>
              <div class="mt-1 flex items-center gap-2">
                <span
                  class="rounded-lg bg-gray-100 px-3 py-2.5 text-xs font-bold text-gray-500"
                >
                  {{ selectedTrip?.currency || 'USD' }}
                </span>
                <input
                  v-model="bookingForm.realizationCost"
                  type="number"
                  min="0"
                  max="10000000"
                  step="0.01"
                  class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <p class="mt-1 text-[11px] text-gray-400">
                Planned {{ formatMoney(activeActivity.cost, selectedTrip?.currency) }}. Enter the
                actual amount you paid.
              </p>
            </div>

            <div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Notes</label>
              <textarea
                v-model="bookingForm.notes"
                rows="2"
                maxlength="500"
                placeholder="Booking reference, vendor, payment method…"
                class="mt-1 w-full resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <p
            v-if="bookingError"
            class="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"
          >
            {{ bookingError }}
          </p>

          <div class="mt-4 flex gap-3">
            <button
              v-if="bookingFor(activeActivity.id)"
              type="button"
              class="rounded-xl border border-red-100 bg-white px-4 py-2.5 text-sm font-semibold text-red-500 transition-all hover:bg-red-50 active:scale-95"
              @click="deleteBooking"
            >
              Delete
            </button>
            <button
              type="button"
              class="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-500 transition-all hover:bg-gray-50 active:scale-95"
              @click="closeBooking"
            >
              Cancel
            </button>
            <button
              type="button"
              class="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200/60 transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-95"
              @click="saveBooking"
            >
              Save booking
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="viewingReceipt"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/90 p-4 backdrop-blur-sm"
        @click="closeReceipt"
      >
        <button
          type="button"
          class="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg text-white transition-all hover:bg-white/20 active:scale-90"
          aria-label="Close receipt"
          @click.stop="closeReceipt"
        >
          ✕
        </button>
        <figure class="flex max-h-full w-full max-w-6xl flex-col items-center" @click.stop>
          <img
            v-if="viewingReceipt.isImage"
            :src="viewingReceipt.url"
            :alt="viewingReceipt.title"
            class="max-h-[85vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
          />
          <iframe
            v-else
            :src="viewingReceipt.url"
            :title="viewingReceipt.title || 'Receipt preview'"
            class="h-[85vh] w-full rounded-2xl bg-white shadow-2xl"
          />
          <figcaption
            v-if="viewingReceipt.title"
            class="mt-3 text-center text-sm font-semibold text-white/80"
          >
            {{ viewingReceipt.title }}
          </figcaption>
        </figure>
      </div>
    </Teleport>
  </div>
</template>
