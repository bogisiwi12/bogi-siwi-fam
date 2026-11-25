<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useFinanceStore } from '@/stores/financeStore'
import { useAuthStore } from '@/stores/authStore'
import NotificationBell from '@/components/NotificationBell.vue'
import { CURRENCIES, FINANCE_ENTRY_TYPES, entryTypeMeta } from '@/config/finance'

const store = useFinanceStore()
const auth = useAuthStore()
const canManage = computed(() => auth.isAdmin || auth.isParent)

const currency = ref(loadCurrency())
const activeType = ref('goal')

const showForm = ref(false)
const editingId = ref(null)
const formError = ref('')
const form = reactive({
  type: 'goal',
  name: '',
  amount: '',
  note: '',
})

function loadCurrency() {
  try {
    return localStorage.getItem('finance-currency') || 'IDR'
  } catch {
    return 'IDR'
  }
}

function formatMoney(value) {
  const amount = Number(value) || 0
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.value,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency.value} ${amount.toLocaleString()}`
  }
}

function setCurrency(event) {
  currency.value = event.target.value
  try {
    localStorage.setItem('finance-currency', currency.value)
  } catch {
    // Ignore storage failures.
  }
}

const linkedTotals = computed(() => {
  const map = new Map()
  for (const transaction of store.transactions) {
    if (!transaction.entryId) continue
    const amount = Number(transaction.amount) || 0
    map.set(transaction.entryId, (map.get(transaction.entryId) || 0) + amount)
  }
  return map
})

const entriesWithProgress = computed(() =>
  [...store.entries]
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .map((entry) => {
      const amount = Number(entry.amount) || 0
      const used = linkedTotals.value.get(entry.id) || 0
      const remaining = Math.max(0, amount - used)
      const percent = amount > 0 ? Math.min(100, (used / amount) * 100) : 0
      return {
        ...entry,
        amount,
        used,
        remaining,
        percent,
        settled: remaining <= 0 && amount > 0,
        meta: entryTypeMeta(entry.type),
      }
    }),
)

const visibleEntries = computed(() =>
  entriesWithProgress.value.filter((entry) => entry.type === activeType.value),
)

const summary = computed(() => {
  let total = 0
  let used = 0
  for (const entry of visibleEntries.value) {
    total += entry.amount
    used += entry.used
  }
  return { total, used, remaining: Math.max(0, total - used) }
})

const typeCounts = computed(() => {
  const counts = {}
  for (const type of FINANCE_ENTRY_TYPES) counts[type.value] = 0
  for (const entry of store.entries) {
    if (counts[entry.type] !== undefined) counts[entry.type] += 1
  }
  return counts
})

const activeMeta = computed(() => entryTypeMeta(activeType.value))

function resetForm() {
  form.type = activeType.value
  form.name = ''
  form.amount = ''
  form.note = ''
  formError.value = ''
}

function openNew() {
  if (!canManage.value) return
  editingId.value = null
  resetForm()
  showForm.value = true
}

function openEdit(entry) {
  if (!canManage.value) return
  editingId.value = entry.id
  form.type = entry.type || 'goal'
  form.name = entry.name || ''
  form.amount = entry.amount != null ? String(entry.amount) : ''
  form.note = entry.note || ''
  formError.value = ''
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  formError.value = ''
}

async function saveEntry() {
  if (!canManage.value) return
  formError.value = ''

  const name = form.name.trim()
  if (!name) {
    formError.value = 'Enter a name.'
    return
  }
  const amount = Number(form.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    formError.value = 'Enter an amount greater than zero.'
    return
  }

  const payload = { type: form.type, name, amount, note: form.note }

  if (editingId.value) {
    const ok = await store.updateEntry(editingId.value, payload)
    if (!ok) {
      formError.value = store.error
      return
    }
  } else {
    const id = await store.addEntry(payload)
    if (!id) {
      formError.value = store.error
      return
    }
  }

  activeType.value = form.type
  closeForm()
}

async function removeEntry(entry) {
  if (!canManage.value) return
  if (!window.confirm(`Delete "${entry.name}"? Linked transactions stay in the finance list.`)) {
    return
  }
  await store.removeEntry(entry.id)
}

function handleKeydown(event) {
  if (event.key === 'Escape' && showForm.value) closeForm()
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
  <div class="space-y-5 pb-28 lg:pb-6">
    <div class="flex flex-col gap-4 anim-fade-up sm:flex-row sm:items-center sm:justify-between">
      <div class="flex min-w-0 items-center gap-3">
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-2xl shadow-lg shadow-indigo-200/60"
        >
          🎯
        </span>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <RouterLink
              to="/finance"
              class="text-xs font-semibold text-blue-500 transition-colors hover:text-blue-700"
            >
              ← Finance
            </RouterLink>
          </div>
          <h1 class="text-2xl font-extrabold text-gray-800 lg:text-3xl">Goals & Debts</h1>
          <p class="text-sm text-gray-500">
            Track savings goals, money you borrowed, and money you lent.
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <NotificationBell />
        <select
          :value="currency"
          aria-label="Currency"
          class="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-600 shadow-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          @change="setCurrency"
        >
          <option v-for="item in CURRENCIES" :key="item" :value="item">{{ item }}</option>
        </select>
        <button
          v-if="canManage"
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-200/60 transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-95"
          @click="openNew"
        >
          + Add {{ activeMeta.label.toLowerCase() }}
        </button>
      </div>
    </div>

    <div
      v-if="store.error"
      class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600"
    >
      {{ store.error }}
    </div>

    <div class="anim-fade-up">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="type in FINANCE_ENTRY_TYPES"
          :key="type.value"
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all active:scale-95"
          :class="
            activeType === type.value
              ? 'border-transparent bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200/60'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
          "
          @click="activeType = type.value"
        >
          <span class="text-base">{{ type.icon }}</span>
          {{ type.plural }}
          <span
            class="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
            :class="
              activeType === type.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            "
          >
            {{ typeCounts[type.value] }}
          </span>
        </button>
      </div>
    </div>

    <div class="grid gap-3 min-[400px]:grid-cols-3 anim-fade-up" style="--delay: 60ms">
      <div class="rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm backdrop-blur">
        <p class="text-[10px] font-bold uppercase tracking-wide text-gray-400">
          Total {{ activeMeta.plural.toLowerCase() }}
        </p>
        <p class="mt-1 text-xl font-extrabold tabular-nums text-gray-800">
          {{ formatMoney(summary.total) }}
        </p>
      </div>
      <div class="rounded-2xl border border-emerald-50 bg-white/80 p-4 shadow-sm backdrop-blur">
        <p class="text-[10px] font-bold uppercase tracking-wide text-gray-400">Settled</p>
        <p class="mt-1 text-xl font-extrabold tabular-nums text-emerald-600">
          {{ formatMoney(summary.used) }}
        </p>
      </div>
      <div class="rounded-2xl border border-rose-50 bg-white/80 p-4 shadow-sm backdrop-blur">
        <p class="text-[10px] font-bold uppercase tracking-wide text-gray-400">Remaining</p>
        <p class="mt-1 text-xl font-extrabold tabular-nums text-rose-500">
          {{ formatMoney(summary.remaining) }}
        </p>
      </div>
    </div>

    <div
      v-if="store.entriesLoading"
      class="flex items-center justify-center gap-3 rounded-2xl border border-indigo-50 bg-white/80 px-4 py-10 text-sm text-gray-400"
    >
      <span class="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-500" />
      Loading {{ activeMeta.plural.toLowerCase() }}...
    </div>

    <div
      v-else-if="!visibleEntries.length"
      class="rounded-2xl border border-dashed border-indigo-200 bg-white/60 px-4 py-10 text-center"
    >
      <p class="text-3xl">{{ activeMeta.icon }}</p>
      <p class="mt-2 text-sm font-semibold text-gray-600">
        No {{ activeMeta.plural.toLowerCase() }} yet
      </p>
      <p class="mt-1 text-xs text-gray-400">
        {{
          activeType === 'borrowed'
            ? 'Add how much you borrowed so repayments can reduce it.'
            : activeType === 'lent'
              ? 'Add how much you lent so repayments can reduce it.'
              : 'Add a savings target so contributions can reduce the remaining amount.'
        }}
      </p>
      <button
        v-if="canManage"
        type="button"
        class="mt-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
        @click="openNew"
      >
        + Add {{ activeMeta.label.toLowerCase() }}
      </button>
    </div>

    <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="entry in visibleEntries"
        :key="entry.id"
        class="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm backdrop-blur transition-all duration-300 hover-lift"
      >
        <div class="flex items-start justify-between gap-2">
          <span
            class="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            :class="entry.meta.class"
          >
            {{ entry.meta.icon }}
          </span>
          <div v-if="canManage" class="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Edit entry"
              title="Edit"
              class="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 active:scale-90"
              @click="openEdit(entry)"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
                />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Delete entry"
              title="Delete"
              class="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-90"
              @click="removeEntry(entry)"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
            </button>
          </div>
        </div>

        <p class="mt-3 truncate text-sm font-bold text-gray-800">{{ entry.name }}</p>
        <p class="text-[10px] font-bold uppercase tracking-wide text-gray-400">
          {{ entry.meta.label }} · Started at {{ formatMoney(entry.amount) }}
        </p>

        <p class="mt-3 text-[10px] font-bold uppercase tracking-wide text-gray-400">Remaining</p>
        <p
          class="text-xl font-extrabold tabular-nums"
          :class="entry.settled ? 'text-emerald-600' : 'text-gray-800'"
        >
          {{ entry.settled ? 'Settled' : formatMoney(entry.remaining) }}
        </p>

        <div class="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            class="h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out"
            :class="entry.meta.bar"
            :style="{ width: `${Math.max(2, entry.percent)}%` }"
          />
        </div>
        <div class="mt-1.5 flex items-center justify-between text-[10px] font-semibold text-gray-400">
          <span>{{ formatMoney(entry.used) }} settled</span>
          <span>{{ Math.round(entry.percent) }}%</span>
        </div>

        <p v-if="entry.note" class="mt-2 truncate text-[11px] text-gray-400">{{ entry.note }}</p>
      </div>
    </div>

    <div class="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-xs text-indigo-700">
      <p class="font-bold">How it connects to transactions</p>
      <p class="mt-1 text-indigo-600/80">
        When adding income or an expense, pick a
        <span class="font-semibold">Goals & Debts</span> entry in the optional link field after the
        wallet. The linked transaction automatically reduces that entry's remaining amount.
      </p>
    </div>

    <Teleport to="body">
      <div
        v-if="showForm && canManage"
        class="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6"
      >
        <div class="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" @click="closeForm" />

        <div
          class="relative w-full rounded-t-3xl bg-white p-5 shadow-2xl anim-scale-in sm:max-w-md sm:rounded-3xl sm:p-6"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-xl font-extrabold text-gray-800">
                {{ editingId ? 'Edit entry' : `Add ${entryTypeMeta(form.type).label.toLowerCase()}` }}
              </h2>
              <p class="text-sm text-gray-500">
                {{
                  form.type === 'borrowed'
                    ? 'Track a debt you need to repay.'
                    : form.type === 'lent'
                      ? 'Track money someone owes you.'
                      : 'Track progress toward a savings target.'
                }}
              </p>
            </div>
            <button
              type="button"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 active:scale-90"
              aria-label="Close"
              @click="closeForm"
            >
              ✕
            </button>
          </div>

          <form class="mt-5 space-y-4" @submit.prevent="saveEntry">
            <div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Type</label>
              <div class="mt-2 grid grid-cols-3 gap-2">
                <button
                  v-for="type in FINANCE_ENTRY_TYPES"
                  :key="type.value"
                  type="button"
                  class="flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center transition-all active:scale-95"
                  :class="
                    form.type === type.value
                      ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  "
                  @click="form.type = type.value"
                >
                  <span class="text-lg">{{ type.icon }}</span>
                  <span class="text-[10px] font-semibold leading-tight text-gray-600">
                    {{ type.label }}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Name</label>
              <input
                v-model="form.name"
                maxlength="80"
                placeholder="e.g. Rent Apartment"
                class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                @keyup.esc="closeForm"
              />
            </div>

            <div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">
                {{ form.type === 'goal' ? 'Target amount' : 'Total amount' }}
              </label>
              <div
                class="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 transition-all focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100"
              >
                <span class="text-sm font-bold text-gray-400">{{ currency }}</span>
                <input
                  v-model="form.amount"
                  type="number"
                  min="0"
                  max="1000000000000"
                  step="0.01"
                  placeholder="0"
                  class="w-full bg-transparent text-lg font-extrabold text-gray-800 outline-none"
                />
              </div>
            </div>

            <div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">
                Note (optional)
              </label>
              <input
                v-model="form.note"
                maxlength="300"
                placeholder="e.g. Due at the end of the month"
                class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
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
                @click="closeForm"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-200/60 transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-95"
              >
                {{ editingId ? 'Save entry' : 'Add entry' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
