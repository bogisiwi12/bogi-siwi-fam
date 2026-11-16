<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useFinanceStore } from '@/stores/financeStore'
import { useAuthStore } from '@/stores/authStore'
import {
  CURRENCIES,
  FINANCE_CATEGORIES,
  FINANCE_TYPES,
  WALLET_TYPES,
  categoryMeta,
  walletMeta
} from '@/config/finance'

const store = useFinanceStore()
const auth = useAuthStore()
const canManage = computed(() => auth.isAdmin || auth.isParent)

const currency = ref(loadCurrency())
const rangeMode = ref('month')
const selectedMonth = ref(currentMonth())
const typeFilter = ref('all')
const categoryFilter = ref('all')
const walletFilter = ref('all')
const search = ref('')

const showForm = ref(false)
const editingId = ref(null)
const formError = ref('')
const form = reactive({
  type: 'expense',
  amount: '',
  category: 'food',
  date: todayIso(),
  note: '',
  walletId: ''
})

const showWalletForm = ref(false)
const editingWalletId = ref(null)
const walletFormError = ref('')
const walletForm = reactive({
  name: '',
  type: 'cash',
  initialBalance: '',
  creditLimit: ''
})

function loadCurrency() {
  try {
    return localStorage.getItem('finance-currency') || 'IDR'
  } catch {
    return 'IDR'
  }
}

function todayIso() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function currentMonth() {
  return todayIso().slice(0, 7)
}

function formatMoney(value) {
  const amount = Number(value) || 0
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.value,
      maximumFractionDigits: 0
    }).format(amount)
  } catch {
    return `${currency.value} ${amount.toLocaleString()}`
  }
}

function formatSigned(value) {
  const amount = Number(value) || 0
  return `${amount >= 0 ? '+' : '−'}${formatMoney(Math.abs(amount))}`
}

function formatMonthLabel(value) {
  if (!value) return 'All time'
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return value
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })
}

function formatGroupDate(value) {
  if (!value) return 'No date'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const allCategories = computed(() =>
  FINANCE_TYPES.flatMap((type) =>
    FINANCE_CATEGORIES[type].map((category) => ({ ...category, type }))
  )
)

const walletsById = computed(() =>
  Object.fromEntries(store.wallets.map((wallet) => [wallet.id, wallet]))
)

const totalWalletBalance = computed(() =>
  store.walletsWithBalance.reduce((sum, wallet) => sum + (Number(wallet.balance) || 0), 0)
)

const periodLabel = computed(() =>
  rangeMode.value === 'all' ? 'All time' : formatMonthLabel(selectedMonth.value)
)

const filteredTransactions = computed(() => {
  const term = search.value.trim().toLowerCase()
  return store.transactions.filter((transaction) => {
    if (
      rangeMode.value === 'month' &&
      selectedMonth.value &&
      !(transaction.date || '').startsWith(selectedMonth.value)
    ) {
      return false
    }
    if (typeFilter.value !== 'all' && transaction.type !== typeFilter.value) return false
    if (categoryFilter.value !== 'all' && transaction.category !== categoryFilter.value) {
      return false
    }
    if (walletFilter.value !== 'all' && transaction.walletId !== walletFilter.value) {
      return false
    }
    if (term) {
      const label = categoryMeta(transaction.type, transaction.category).label
      const wallet = walletsById.value[transaction.walletId]
      const haystack =
        `${transaction.note || ''} ${label} ${transaction.date || ''} ${wallet?.name || ''}`.toLowerCase()
      if (!haystack.includes(term)) return false
    }
    return true
  })
})

const totals = computed(() => {
  let income = 0
  let expense = 0
  for (const transaction of filteredTransactions.value) {
    const amount = Number(transaction.amount) || 0
    if (transaction.type === 'income') income += amount
    else expense += amount
  }
  const balance = income - expense
  return {
    income,
    expense,
    balance,
    savingsRate: income > 0 ? (balance / income) * 100 : null
  }
})

const groupedByDate = computed(() => {
  const groups = new Map()
  const sorted = [...filteredTransactions.value].sort((a, b) =>
    (b.date || '').localeCompare(a.date || '')
  )
  for (const transaction of sorted) {
    const key = transaction.date || 'No date'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(transaction)
  }
  return [...groups.entries()].map(([date, items]) => ({ date, items }))
})

const expenseBreakdown = computed(() => {
  const totalsByCategory = new Map()
  let total = 0
  for (const transaction of filteredTransactions.value) {
    if (transaction.type !== 'expense') continue
    const amount = Number(transaction.amount) || 0
    totalsByCategory.set(
      transaction.category,
      (totalsByCategory.get(transaction.category) || 0) + amount
    )
    total += amount
  }
  return [...totalsByCategory.entries()]
    .map(([value, amount]) => ({
      value,
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0,
      meta: categoryMeta('expense', value)
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6)
})

const transactionCounts = computed(() => ({
  income: filteredTransactions.value.filter((t) => t.type === 'income').length,
  expense: filteredTransactions.value.filter((t) => t.type === 'expense').length
}))

const hasFilters = computed(
  () =>
    typeFilter.value !== 'all' ||
    categoryFilter.value !== 'all' ||
    walletFilter.value !== 'all' ||
    Boolean(search.value.trim())
)

function groupNet(items) {
  const net = items.reduce(
    (sum, transaction) =>
      sum +
      (transaction.type === 'income'
        ? Number(transaction.amount) || 0
        : -(Number(transaction.amount) || 0)),
    0
  )
  return formatSigned(net)
}

function setCurrency(event) {
  currency.value = event.target.value
  try {
    localStorage.setItem('finance-currency', currency.value)
  } catch {
    // Ignore storage failures.
  }
}

function resetFilters() {
  typeFilter.value = 'all'
  categoryFilter.value = 'all'
  walletFilter.value = 'all'
  search.value = ''
}

function resetForm() {
  form.type = 'expense'
  form.amount = ''
  form.category = 'food'
  form.date = todayIso()
  form.note = ''
  form.walletId = store.wallets[0]?.id || ''
  formError.value = ''
}

function openNewTransaction() {
  if (!canManage.value) return
  editingId.value = null
  resetForm()
  showForm.value = true
}

function openEditTransaction(transaction) {
  if (!canManage.value) return
  editingId.value = transaction.id
  form.type = transaction.type || 'expense'
  form.amount = transaction.amount != null ? String(transaction.amount) : ''
  form.category = transaction.category || FINANCE_CATEGORIES[form.type][0].value
  form.date = transaction.date || todayIso()
  form.note = transaction.note || ''
  form.walletId = transaction.walletId || store.wallets[0]?.id || ''
  formError.value = ''
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  formError.value = ''
}

function changeType(type) {
  form.type = type
  if (!FINANCE_CATEGORIES[type].some((category) => category.value === form.category)) {
    form.category = FINANCE_CATEGORIES[type][0].value
  }
}

async function saveTransaction() {
  if (!canManage.value) return
  formError.value = ''

  const amount = Number(form.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    formError.value = 'Enter an amount greater than zero.'
    return
  }
  if (!form.category) {
    formError.value = 'Choose a category.'
    return
  }
  if (!form.date) {
    formError.value = 'Choose a date.'
    return
  }
  if (!form.walletId) {
    formError.value = 'Choose a wallet for this transaction.'
    return
  }

  const payload = {
    type: form.type,
    amount,
    category: form.category,
    date: form.date,
    note: form.note,
    walletId: form.walletId
  }

  if (editingId.value) {
    const ok = await store.updateTransaction(editingId.value, payload)
    if (!ok) {
      formError.value = store.error
      return
    }
  } else {
    const id = await store.addTransaction(payload)
    if (!id) {
      formError.value = store.error
      return
    }
  }

  closeForm()
}

async function removeTransaction(transaction) {
  if (!canManage.value) return
  const label = transaction.note || categoryMeta(transaction.type, transaction.category).label
  if (!window.confirm(`Delete "${label}"?`)) return
  await store.removeTransaction(transaction.id)
}

function resetWalletForm() {
  walletForm.name = ''
  walletForm.type = 'cash'
  walletForm.initialBalance = ''
  walletForm.creditLimit = ''
  walletFormError.value = ''
}

function openNewWallet() {
  if (!canManage.value) return
  editingWalletId.value = null
  resetWalletForm()
  showWalletForm.value = true
}

function openEditWallet(wallet) {
  if (!canManage.value) return
  editingWalletId.value = wallet.id
  walletForm.name = wallet.name || ''
  walletForm.type = wallet.type || 'cash'
  walletForm.initialBalance =
    wallet.initialBalance != null ? String(wallet.initialBalance) : ''
  walletForm.creditLimit = wallet.creditLimit != null ? String(wallet.creditLimit) : ''
  walletFormError.value = ''
  showWalletForm.value = true
}

function closeWalletForm() {
  showWalletForm.value = false
  walletFormError.value = ''
}

async function saveWallet() {
  if (!canManage.value) return
  walletFormError.value = ''

  const name = walletForm.name.trim()
  if (!name) {
    walletFormError.value = 'Enter a wallet name.'
    return
  }
  const initialBalance = Number(walletForm.initialBalance || 0)
  if (!Number.isFinite(initialBalance)) {
    walletFormError.value = 'Enter a valid starting balance.'
    return
  }

  const creditLimit = Number(walletForm.creditLimit || 0)
  if (walletForm.type === 'credit' && (!Number.isFinite(creditLimit) || creditLimit <= 0)) {
    walletFormError.value = 'Enter a credit limit greater than zero.'
    return
  }

  const payload = { name, type: walletForm.type, initialBalance, creditLimit }

  if (editingWalletId.value) {
    const ok = await store.updateWallet(editingWalletId.value, payload)
    if (!ok) {
      walletFormError.value = store.error
      return
    }
  } else {
    const id = await store.addWallet(payload)
    if (!id) {
      walletFormError.value = store.error
      return
    }
  }

  closeWalletForm()
}

async function removeWallet(wallet) {
  if (!canManage.value) return
  if (
    !window.confirm(
      `Delete the "${wallet.name}" wallet? Linked transactions stay in the list but will show as unassigned.`
    )
  ) {
    return
  }
  await store.removeWallet(wallet.id)
  if (walletFilter.value === wallet.id) walletFilter.value = 'all'
  if (form.walletId === wallet.id) form.walletId = ''
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return
  if (showForm.value) closeForm()
  if (showWalletForm.value) closeWalletForm()
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
          Finance <span class="inline-block anim-float">💰</span>
        </h1>
        <p class="mt-1 text-gray-500">
          Track the family's income and expenses in one clear place.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2 self-start sm:self-auto">
        <select
          :value="currency"
          aria-label="Currency"
          class="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-600 shadow-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          @change="setCurrency"
        >
          <option v-for="item in CURRENCIES" :key="item" :value="item">{{ item }}</option>
        </select>
        <span
          v-if="store.wallets.length"
          class="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 shadow-sm"
        >
          Wallet balance: {{ formatMoney(totalWalletBalance) }}
        </span>
        <button
          v-if="canManage"
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-95"
          @click="openNewTransaction"
        >
          + Add transaction
        </button>
      </div>
    </div>

    <div
      v-if="store.error"
      class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600"
    >
      {{ store.error }}
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="group rounded-2xl border border-blue-50 bg-white/80 p-5 shadow-sm backdrop-blur transition-all duration-300 hover-lift anim-fade-up">
        <div class="flex items-center justify-between">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-xl transition-transform duration-300 group-hover:scale-110">💵</span>
          <span class="text-[10px] font-bold uppercase tracking-wide text-gray-400">{{ periodLabel }}</span>
        </div>
        <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Net balance</p>
        <p
          class="mt-1 text-2xl font-extrabold tabular-nums"
          :class="totals.balance >= 0 ? 'text-gray-800' : 'text-rose-500'"
        >
          {{ formatMoney(totals.balance) }}
        </p>
        <p class="mt-1 text-[11px] text-gray-400">
          {{ transactionCounts.income + transactionCounts.expense }} transactions this period
        </p>
      </div>

      <div class="group rounded-2xl border border-emerald-50 bg-white/80 p-5 shadow-sm backdrop-blur transition-all duration-300 hover-lift anim-fade-up" style="--delay: 60ms">
        <div class="flex items-center justify-between">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-xl transition-transform duration-300 group-hover:scale-110">📈</span>
          <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">{{ transactionCounts.income }} entries</span>
        </div>
        <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Income</p>
        <p class="mt-1 text-2xl font-extrabold tabular-nums text-emerald-600">
          +{{ formatMoney(totals.income) }}
        </p>
        <p class="mt-1 text-[11px] text-gray-400">Money coming in</p>
      </div>

      <div class="group rounded-2xl border border-rose-50 bg-white/80 p-5 shadow-sm backdrop-blur transition-all duration-300 hover-lift anim-fade-up" style="--delay: 120ms">
        <div class="flex items-center justify-between">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-xl transition-transform duration-300 group-hover:scale-110">📉</span>
          <span class="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-500">{{ transactionCounts.expense }} entries</span>
        </div>
        <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Expenses</p>
        <p class="mt-1 text-2xl font-extrabold tabular-nums text-rose-500">
          −{{ formatMoney(totals.expense) }}
        </p>
        <p class="mt-1 text-[11px] text-gray-400">Money going out</p>
      </div>

      <div class="group rounded-2xl border border-purple-50 bg-white/80 p-5 shadow-sm backdrop-blur transition-all duration-300 hover-lift anim-fade-up" style="--delay: 180ms">
        <div class="flex items-center justify-between">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-xl transition-transform duration-300 group-hover:scale-110">🧮</span>
        </div>
        <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Savings rate</p>
        <p class="mt-1 text-2xl font-extrabold tabular-nums text-purple-600">
          {{ totals.savingsRate == null ? '—' : `${Math.round(totals.savingsRate)}%` }}
        </p>
        <div class="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            class="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-400 transition-all duration-700 ease-out"
            :style="{ width: `${Math.min(100, Math.max(0, totals.savingsRate || 0))}%` }"
          />
        </div>
      </div>
    </div>

    <div class="anim-fade-up" style="--delay: 220ms">
      <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 class="text-sm font-bold text-gray-700">Wallets</h2>
          <p class="text-xs text-gray-400">
            Every income and expense is linked to a wallet.
          </p>
        </div>
        <button
          v-if="canManage"
          type="button"
          class="rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs font-semibold text-blue-600 shadow-sm transition-all hover:bg-blue-50 active:scale-95"
          @click="openNewWallet"
        >
          + Add wallet
        </button>
      </div>

      <div
        v-if="store.walletsLoading"
        class="flex items-center justify-center gap-3 rounded-2xl border border-blue-50 bg-white/80 px-4 py-8 text-sm text-gray-400"
      >
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-500" />
        Loading wallets...
      </div>

      <div
        v-else-if="!store.wallets.length"
        class="rounded-2xl border border-dashed border-blue-200 bg-white/60 px-4 py-8 text-center"
      >
        <p class="text-3xl">👛</p>
        <p class="mt-2 text-sm font-semibold text-gray-600">No wallets yet</p>
        <p class="mt-1 text-xs text-gray-400">
          Add a wallet (cash, bank, e-wallet) so you can assign each transaction.
        </p>
        <button
          v-if="canManage"
          type="button"
          class="mt-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
          @click="openNewWallet"
        >
          + Add wallet
        </button>
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="wallet in store.walletsWithBalance"
          :key="wallet.id"
          class="group relative overflow-hidden rounded-2xl border border-blue-50 bg-white/80 p-4 shadow-sm backdrop-blur transition-all duration-300 hover-lift"
        >
          <div class="flex items-start justify-between gap-2">
            <span
              class="flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-transform duration-300 group-hover:scale-110"
              :class="walletMeta(wallet.type).class"
            >
              {{ walletMeta(wallet.type).icon }}
            </span>
            <div v-if="canManage" class="flex items-center gap-1">
              <button
                type="button"
                class="rounded-lg px-2 py-1 text-[11px] font-semibold text-blue-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                @click="openEditWallet(wallet)"
              >
                Edit
              </button>
              <button
                type="button"
                class="rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                @click="removeWallet(wallet)"
              >
                Delete
              </button>
            </div>
          </div>
          <p class="mt-3 truncate text-sm font-bold text-gray-800">{{ wallet.name }}</p>
          <p class="text-[10px] font-bold uppercase tracking-wide text-gray-400">
            {{ walletMeta(wallet.type).label }}
          </p>

          <template v-if="wallet.type === 'credit'">
            <p class="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">Remaining credit</p>
            <p
              class="text-xl font-extrabold tabular-nums"
              :class="wallet.availableCredit > 0 ? 'text-gray-800' : 'text-rose-500'"
            >
              {{ formatMoney(wallet.availableCredit) }}
            </p>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                class="h-full rounded-full transition-all duration-700 ease-out"
                :class="wallet.usedAmount >= wallet.creditLimit
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-amber-400 to-orange-400'"
                :style="{ width: `${wallet.creditLimit ? Math.min(100, (wallet.usedAmount / wallet.creditLimit) * 100) : 0}%` }"
              />
            </div>
            <div class="mt-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold text-gray-400">
              <span>Used {{ formatMoney(wallet.usedAmount) }}</span>
              <span>Limit {{ formatMoney(wallet.creditLimit) }}</span>
            </div>
          </template>
          <template v-else>
            <p
              class="mt-2 text-xl font-extrabold tabular-nums"
              :class="wallet.balance >= 0 ? 'text-gray-800' : 'text-rose-500'"
            >
              {{ formatMoney(wallet.balance) }}
            </p>
            <p v-if="Number(wallet.initialBalance)" class="mt-0.5 text-[10px] text-gray-400">
              Started at {{ formatMoney(wallet.initialBalance) }}
            </p>
          </template>
        </div>
      </div>
    </div>

    <div class="rounded-2xl border border-blue-50 bg-white/80 p-4 shadow-sm backdrop-blur anim-fade-up" style="--delay: 240ms">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div class="flex flex-wrap items-center gap-2">
          <div class="inline-flex rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
              :class="rangeMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
              @click="rangeMode = 'month'"
            >
              Monthly
            </button>
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
              :class="rangeMode === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
              @click="rangeMode = 'all'"
            >
              All time
            </button>
          </div>
          <input
            v-if="rangeMode === 'month'"
            v-model="selectedMonth"
            type="month"
            aria-label="Filter by month"
            class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <select
            v-model="typeFilter"
            aria-label="Filter by type"
            class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All types</option>
            <option value="income">Income only</option>
            <option value="expense">Expenses only</option>
          </select>
          <select
            v-model="walletFilter"
            aria-label="Filter by wallet"
            class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All wallets</option>
            <option v-for="wallet in store.wallets" :key="wallet.id" :value="wallet.id">
              {{ walletMeta(wallet.type).icon }} {{ wallet.name }}
            </option>
          </select>
          <select
            v-model="categoryFilter"
            aria-label="Filter by category"
            class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All categories</option>
            <option v-for="category in allCategories" :key="`${category.type}-${category.value}`" :value="category.value">
              {{ category.icon }} {{ category.label }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <div class="relative flex-1 xl:w-64">
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">🔍</span>
            <input
              v-model="search"
              type="search"
              placeholder="Search note or category"
              class="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <button
            v-if="hasFilters"
            type="button"
            class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-500 transition-all hover:bg-gray-50 active:scale-95"
            @click="resetFilters"
          >
            Clear
          </button>
        </div>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
      <div class="overflow-hidden rounded-2xl border border-blue-50 bg-white/80 shadow-sm backdrop-blur anim-fade-up lg:col-span-2" style="--delay: 300ms">
        <div class="flex items-center justify-between border-b border-gray-50 px-4 py-3">
          <h2 class="text-sm font-bold text-gray-700">Transactions</h2>
          <span class="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-gray-500 shadow-sm ring-1 ring-gray-100">
            {{ filteredTransactions.length }} shown
          </span>
        </div>

        <div v-if="store.loading" class="flex items-center justify-center gap-3 px-4 py-12 text-sm text-gray-400">
          <span class="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-500" />
          Loading transactions...
        </div>

        <div v-else-if="!filteredTransactions.length" class="px-4 py-12 text-center">
          <p class="text-3xl">🧾</p>
          <p class="mt-2 text-sm font-semibold text-gray-600">
            {{ store.transactions.length ? 'No transactions match your filters' : 'No transactions yet' }}
          </p>
          <p class="mt-1 text-xs text-gray-400">
            {{ store.transactions.length
              ? 'Try a different month, type or search term.'
              : 'Add your first income or expense to start tracking.' }}
          </p>
          <button
            v-if="canManage && !store.transactions.length"
            type="button"
            class="mt-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
            @click="openNewTransaction"
          >
            + Add transaction
          </button>
        </div>

        <div v-else class="divide-y divide-gray-50">
          <template v-for="group in groupedByDate" :key="group.date">
            <div class="flex items-center justify-between bg-gray-50/60 px-4 py-2">
              <span class="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                {{ formatGroupDate(group.date) }}
              </span>
              <span class="text-[11px] font-semibold text-gray-400">{{ groupNet(group.items) }}</span>
            </div>
            <div
              v-for="transaction in group.items"
              :key="transaction.id"
              class="group flex items-center gap-3 px-4 py-3 transition-colors duration-300 hover:bg-gray-50/70"
            >
              <span
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                :class="categoryMeta(transaction.type, transaction.category).class"
              >
                {{ categoryMeta(transaction.type, transaction.category).icon }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-gray-800">
                  {{ transaction.note || categoryMeta(transaction.type, transaction.category).label }}
                </p>
                <p class="truncate text-xs text-gray-400">
                  {{ categoryMeta(transaction.type, transaction.category).label }}
                  <span class="text-gray-300">·</span>
                  <span :class="walletsById[transaction.walletId] ? '' : 'text-amber-500'">
                    {{ walletsById[transaction.walletId]?.name || 'Unassigned wallet' }}
                  </span>
                </p>
              </div>
              <span
                class="shrink-0 text-sm font-bold tabular-nums"
                :class="transaction.type === 'income' ? 'text-emerald-600' : 'text-rose-500'"
              >
                {{ transaction.type === 'income' ? '+' : '−' }}{{ formatMoney(transaction.amount) }}
              </span>
              <div v-if="canManage" class="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  class="rounded-lg px-2 py-1 text-[11px] font-semibold text-blue-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  @click="openEditTransaction(transaction)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  @click="removeTransaction(transaction)"
                >
                  Delete
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div class="space-y-4">
        <div class="rounded-2xl border border-blue-50 bg-white/80 p-5 shadow-sm backdrop-blur anim-fade-up" style="--delay: 360ms">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-gray-700">Spending by category</h2>
            <span class="text-[10px] font-bold uppercase tracking-wide text-gray-400">{{ periodLabel }}</span>
          </div>
          <div v-if="expenseBreakdown.length" class="mt-4 space-y-3">
            <div v-for="item in expenseBreakdown" :key="item.value">
              <div class="flex items-center justify-between gap-2 text-xs">
                <span class="flex min-w-0 items-center gap-2 font-semibold text-gray-600">
                  <span class="text-sm">{{ item.meta.icon }}</span>
                  <span class="truncate">{{ item.meta.label }}</span>
                </span>
                <span class="shrink-0 font-bold tabular-nums text-gray-700">{{ formatMoney(item.amount) }}</span>
              </div>
              <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-rose-400 to-orange-300 transition-all duration-700 ease-out"
                  :style="{ width: `${Math.max(2, item.percent)}%` }"
                />
              </div>
              <p class="mt-1 text-[10px] font-medium text-gray-400">{{ Math.round(item.percent) }}% of expenses</p>
            </div>
          </div>
          <p v-else class="mt-4 rounded-xl bg-gray-50 px-3 py-6 text-center text-xs font-semibold text-gray-400">
            No expenses in this period.
          </p>
        </div>

        <div class="rounded-2xl border border-blue-50 bg-gradient-to-br from-blue-500 to-cyan-500 p-5 text-white shadow-lg shadow-blue-200/60 anim-fade-up" style="--delay: 420ms">
          <p class="text-xs font-bold uppercase tracking-wide text-white/70">Period summary</p>
          <p class="mt-1 text-sm font-semibold text-white/90">{{ periodLabel }}</p>
          <dl class="mt-4 space-y-2 text-sm">
            <div class="flex items-center justify-between">
              <dt class="text-white/75">Income entries</dt>
              <dd class="font-bold tabular-nums">{{ transactionCounts.income }}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-white/75">Expense entries</dt>
              <dd class="font-bold tabular-nums">{{ transactionCounts.expense }}</dd>
            </div>
            <div class="flex items-center justify-between border-t border-white/20 pt-2">
              <dt class="text-white/75">Net balance</dt>
              <dd class="font-bold tabular-nums">{{ formatMoney(totals.balance) }}</dd>
            </div>
          </dl>
          <p class="mt-4 rounded-xl bg-white/10 px-3 py-2 text-[11px] font-medium text-white/80">
            {{ totals.balance >= 0
              ? 'Great job — the family is cash-flow positive this period.'
              : 'Spending is above income this period. Review the top categories.' }}
          </p>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showForm && canManage"
        class="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6"
      >
        <div class="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" @click="closeForm" />

        <div class="relative max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl anim-scale-in sm:max-w-lg sm:rounded-3xl sm:p-6">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-xl font-extrabold text-gray-800">
                {{ editingId ? 'Edit transaction' : 'Add transaction' }}
              </h2>
              <p class="text-sm text-gray-500">
                {{ editingId ? 'Update the details of this entry.' : 'Record money coming in or going out.' }}
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

          <form class="mt-5 space-y-4" @submit.prevent="saveTransaction">
            <div class="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                class="rounded-lg px-3 py-2 text-sm font-bold transition-all active:scale-95"
                :class="form.type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                @click="changeType('income')"
              >
                ↑ Income
              </button>
              <button
                type="button"
                class="rounded-lg px-3 py-2 text-sm font-bold transition-all active:scale-95"
                :class="form.type === 'expense' ? 'bg-white text-rose-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                @click="changeType('expense')"
              >
                ↓ Expense
              </button>
            </div>

            <div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Amount</label>
              <div class="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                <span class="text-sm font-bold text-gray-400">{{ currency }}</span>
                <input
                  v-model="form.amount"
                  type="number"
                  min="0"
                  max="1000000000000"
                  step="0.01"
                  placeholder="0"
                  class="w-full bg-transparent text-lg font-bold text-gray-800 outline-none"
                  @keyup.esc="closeForm"
                />
              </div>
            </div>

            <div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Wallet</label>
              <select
                v-model="form.walletId"
                class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="" disabled>Select a wallet…</option>
                <option v-for="wallet in store.walletsWithBalance" :key="wallet.id" :value="wallet.id">
                  {{ walletMeta(wallet.type).icon }} {{ wallet.name }} —
                  {{ wallet.type === 'credit'
                    ? `Available ${formatMoney(wallet.availableCredit)}`
                    : formatMoney(wallet.balance) }}
                </option>
              </select>
              <p v-if="!store.wallets.length" class="mt-1 text-[11px] font-medium text-amber-600">
                You need at least one wallet before saving a transaction.
              </p>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Category</label>
                <select
                  v-model="form.category"
                  class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option v-for="category in FINANCE_CATEGORIES[form.type]" :key="category.value" :value="category.value">
                    {{ category.icon }} {{ category.label }}
                  </option>
                </select>
              </div>
              <div>
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Date</label>
                <input
                  v-model="form.date"
                  type="date"
                  class="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Note (optional)</label>
              <input
                v-model="form.note"
                maxlength="300"
                placeholder="e.g. Weekly groceries at the market"
                class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <p v-if="formError" class="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
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
                :disabled="!store.wallets.length"
                class="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200/60 transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {{ editingId ? 'Save changes' : 'Add transaction' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showWalletForm && canManage"
        class="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6"
      >
        <div class="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" @click="closeWalletForm" />

        <div class="relative w-full rounded-t-3xl bg-white p-5 shadow-2xl anim-scale-in sm:max-w-md sm:rounded-3xl sm:p-6">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-xl font-extrabold text-gray-800">
                {{ editingWalletId ? 'Edit wallet' : 'Add wallet' }}
              </h2>
              <p class="text-sm text-gray-500">
                {{ editingWalletId ? 'Update this wallet’s details.' : 'Create a wallet to track a balance.' }}
              </p>
            </div>
            <button
              type="button"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 active:scale-90"
              aria-label="Close"
              @click="closeWalletForm"
            >
              ✕
            </button>
          </div>

          <form class="mt-5 space-y-4" @submit.prevent="saveWallet">
            <div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Wallet name</label>
              <input
                v-model="walletForm.name"
                maxlength="60"
                placeholder="e.g. BCA Savings, Cash, GoPay"
                class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                @keyup.esc="closeWalletForm"
              />
            </div>

            <div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Wallet type</label>
              <div class="mt-2 grid grid-cols-3 gap-2">
                <button
                  v-for="type in WALLET_TYPES"
                  :key="type.value"
                  type="button"
                  class="flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center transition-all active:scale-95"
                  :class="walletForm.type === type.value
                    ? 'border-blue-400 bg-blue-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:bg-gray-50'"
                  @click="walletForm.type = type.value"
                >
                  <span class="text-lg">{{ type.icon }}</span>
                  <span class="text-[10px] font-semibold leading-tight text-gray-600">{{ type.label }}</span>
                </button>
              </div>
            </div>

            <div v-if="walletForm.type === 'credit'">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Credit limit</label>
              <div class="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                <span class="text-sm font-bold text-gray-400">{{ currency }}</span>
                <input
                  v-model="walletForm.creditLimit"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  class="w-full bg-transparent text-lg font-bold text-gray-800 outline-none"
                />
              </div>
              <p class="mt-1 text-[11px] text-gray-400">
                The maximum credit available on this card.
              </p>
            </div>

            <div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">
                {{ walletForm.type === 'credit' ? 'Outstanding amount' : 'Starting balance' }}
              </label>
              <div class="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                <span class="text-sm font-bold text-gray-400">{{ currency }}</span>
                <input
                  v-model="walletForm.initialBalance"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  class="w-full bg-transparent text-lg font-bold text-gray-800 outline-none"
                />
              </div>
              <p class="mt-1 text-[11px] text-gray-400">
                {{ walletForm.type === 'credit'
                  ? 'How much is already used. Linked expenses raise the used amount; payments lower it.'
                  : 'The current balance updates automatically from linked transactions.' }}
              </p>
            </div>

            <p v-if="walletFormError" class="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
              {{ walletFormError }}
            </p>

            <div class="flex gap-3 pt-1">
              <button
                type="button"
                class="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-500 transition-all hover:bg-gray-50 active:scale-95"
                @click="closeWalletForm"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200/60 transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-95"
              >
                {{ editingWalletId ? 'Save wallet' : 'Add wallet' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
