<script setup>
import { computed, ref, watch } from 'vue'
import { useFamilyStore } from '@/stores/familyStore'
import { formatIDR } from '@/utils/currency'

const store = useFamilyStore()

const incomeCategories = ['Salary', 'Allowance', 'Business', 'Gift', 'Other']
const expenseCategories = [
  'Food',
  'Utilities',
  'Education',
  'Entertainment',
  'Transport',
  'Health',
  'Shopping',
  'Other'
]

const categoryIcons = {
  Salary: '💼',
  Allowance: '🪙',
  Business: '📈',
  Gift: '🎁',
  Food: '🍽️',
  Utilities: '💡',
  Education: '📚',
  Entertainment: '🎬',
  Transport: '🚗',
  Health: '💊',
  Shopping: '🛍️',
  Other: '📦',
  Income: '💰'
}

const transactionFilters = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expenses' }
]

const todayISO = () => new Date().toISOString().split('T')[0]

const txType = ref('expense')
const newDesc = ref('')
const newAmount = ref('')
const newCategory = ref('Food')
const newDate = ref(todayISO())
const saving = ref(false)
const filterType = ref('all')

watch(txType, (type) => {
  const categories = type === 'income' ? incomeCategories : expenseCategories
  if (!categories.includes(newCategory.value)) newCategory.value = categories[0]
})

const income = computed(() =>
  store.transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
)

const expenses = computed(() =>
  Math.abs(store.transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0))
)

const currentMonthKey = computed(() => new Date().toISOString().slice(0, 7))
const monthLabel = computed(() =>
  new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
)

const monthTransactions = computed(() =>
  store.transactions.filter((t) => (t.date || '').startsWith(currentMonthKey.value))
)

const monthIncome = computed(() =>
  monthTransactions.value.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
)

const monthExpenses = computed(() =>
  Math.abs(
    monthTransactions.value.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)
  )
)

const monthNet = computed(() => monthIncome.value - monthExpenses.value)
const savingsRate = computed(() =>
  monthIncome.value > 0 ? (monthNet.value / monthIncome.value) * 100 : 0
)
const expenseRatio = computed(() =>
  monthIncome.value > 0 ? (monthExpenses.value / monthIncome.value) * 100 : 0
)
const progressMax = computed(() => Math.max(monthIncome.value, monthExpenses.value, 1))
const incomeWidth = computed(() => (monthIncome.value / progressMax.value) * 100)
const expenseWidth = computed(() => (monthExpenses.value / progressMax.value) * 100)
const savingsWidth = computed(() => Math.min(Math.max(savingsRate.value, 0), 100))

const categoryBreakdown = computed(() => {
  const totals = new Map()
  for (const tx of monthTransactions.value) {
    if (tx.amount >= 0) continue
    const category = tx.category || 'Other'
    totals.set(category, (totals.get(category) || 0) + Math.abs(tx.amount))
  }
  const total = monthExpenses.value || 1
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({
      category,
      amount,
      pct: (amount / total) * 100,
      icon: categoryIcons[category] || '📦'
    }))
})

const monthlyTrend = computed(() => {
  const now = new Date()
  const months = []
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const txs = store.transactions.filter((t) => (t.date || '').startsWith(key))
    const monthIncomeValue = txs
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0)
    const monthExpenseValue = Math.abs(
      txs.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)
    )
    months.push({
      key,
      label: date.toLocaleDateString('en-US', { month: 'short' }),
      income: monthIncomeValue,
      expenses: monthExpenseValue
    })
  }
  return months
})

const trendMax = computed(() =>
  Math.max(1, ...monthlyTrend.value.flatMap((m) => [m.income, m.expenses]))
)

const filteredTransactions = computed(() => {
  const list = [...store.transactions]
    .filter((tx) => {
      if (filterType.value === 'income') return tx.amount > 0
      if (filterType.value === 'expense') return tx.amount < 0
      return true
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  return list
})

function formatDate(date) {
  if (!date) return '—'
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function handleAdd() {
  const amount = Math.abs(Number(newAmount.value))
  if (!newDesc.value.trim() || !amount) return

  saving.value = true
  const ok = await store.addTransaction(
    newDesc.value,
    txType.value === 'income' ? amount : -amount,
    newCategory.value,
    newDate.value || todayISO()
  )
  saving.value = false
  if (!ok) return

  newDesc.value = ''
  newAmount.value = ''
  newDate.value = todayISO()
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 anim-fade-up sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-extrabold text-gray-800 lg:text-3xl">Family Finance 💰</h1>
        <p class="mt-1 text-gray-500">Record income and expenses, and keep an eye on your monthly progress.</p>
      </div>
      <span class="inline-flex items-center gap-2 self-start rounded-full border border-blue-100 bg-white/70 px-4 py-2 text-xs font-semibold text-blue-600 shadow-sm backdrop-blur sm:self-auto">
        <span class="h-2 w-2 rounded-full bg-emerald-400 anim-pulse-ring" />
        {{ store.transactions.length }} transactions
      </span>
    </div>

    <div v-if="store.error" class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
      {{ store.error }}
    </div>

    <!-- Balance overview -->
    <div class="shimmer relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-500 p-6 text-white shadow-lg shadow-blue-200/70 anim-fade-up" style="--delay: 60ms">
      <div class="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div class="pointer-events-none absolute -bottom-16 right-16 h-40 w-40 rounded-full bg-cyan-300/20 blur-2xl" />

      <div class="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div class="min-w-0">
          <p class="text-sm opacity-80">Total balance</p>
          <p class="mt-1 break-words text-3xl font-extrabold tabular-nums lg:text-4xl">
            {{ formatIDR(store.totalBalance) }}
          </p>
          <div class="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span class="rounded-full bg-white/15 px-2.5 py-1">All-time income {{ formatIDR(income) }}</span>
            <span class="rounded-full bg-white/15 px-2.5 py-1">All-time expenses {{ formatIDR(expenses) }}</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 lg:min-w-[280px]">
          <div class="min-w-0 rounded-xl bg-white/15 px-4 py-3 backdrop-blur transition-transform duration-300 hover:scale-105">
            <p class="text-[10px] uppercase tracking-wide opacity-70">This month income</p>
            <p class="truncate text-sm font-bold tabular-nums">+{{ formatIDR(monthIncome) }}</p>
          </div>
          <div class="min-w-0 rounded-xl bg-white/15 px-4 py-3 backdrop-blur transition-transform duration-300 hover:scale-105">
            <p class="text-[10px] uppercase tracking-wide opacity-70">This month expenses</p>
            <p class="truncate text-sm font-bold tabular-nums">-{{ formatIDR(monthExpenses) }}</p>
          </div>
          <div class="col-span-2 flex items-center justify-between rounded-xl bg-white/15 px-4 py-3 backdrop-blur">
            <span class="text-[10px] font-semibold uppercase tracking-wide opacity-70">Net this month</span>
            <span class="text-sm font-bold tabular-nums">{{ formatIDR(monthNet) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Add transaction -->
    <div class="rounded-2xl border border-blue-50 bg-white/80 p-4 shadow-sm backdrop-blur anim-fade-up sm:p-5" style="--delay: 120ms">
      <div class="mb-4 flex items-center gap-2">
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-sm">➕</span>
        <div>
          <h2 class="text-sm font-bold text-gray-700">Record transaction</h2>
          <p class="text-[11px] text-gray-400">Add an income or expense entry.</p>
        </div>
      </div>

      <form class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" @submit.prevent="handleAdd">
        <div class="sm:col-span-2">
          <span class="mb-1.5 block text-[11px] font-semibold text-gray-500">Type</span>
          <div class="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
            <button type="button" :aria-pressed="txType === 'income'" @click="txType = 'income'"
              class="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all duration-300"
              :class="txType === 'income'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'">
              💵 Income
            </button>
            <button type="button" :aria-pressed="txType === 'expense'" @click="txType = 'expense'"
              class="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all duration-300"
              :class="txType === 'expense'
                ? 'bg-white text-rose-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'">
              🧾 Expense
            </button>
          </div>
        </div>

        <label class="sm:col-span-2">
          <span class="mb-1.5 block text-[11px] font-semibold text-gray-500">Description</span>
          <input v-model="newDesc" maxlength="80" placeholder="e.g. Groceries, salary, school fees"
            class="w-full min-w-0 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all duration-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        </label>

        <label>
          <span class="mb-1.5 block text-[11px] font-semibold text-gray-500">Amount</span>
          <div class="relative">
            <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">Rp</span>
            <input v-model="newAmount" type="number" min="1" step="1" placeholder="0"
              class="w-full min-w-0 rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm tabular-nums outline-none transition-all duration-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </div>
        </label>

        <label>
          <span class="mb-1.5 block text-[11px] font-semibold text-gray-500">Category</span>
          <select v-model="newCategory"
            class="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-all duration-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
            <option v-for="category in txType === 'income' ? incomeCategories : expenseCategories" :key="category">
              {{ category }}
            </option>
          </select>
        </label>

        <label>
          <span class="mb-1.5 block text-[11px] font-semibold text-gray-500">Date</span>
          <input v-model="newDate" type="date"
            class="w-full min-w-0 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all duration-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        </label>

        <button type="submit" :disabled="saving"
          class="self-end whitespace-nowrap rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:opacity-90 hover:shadow-lg active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60">
          {{ saving ? 'Saving…' : 'Add transaction' }}
        </button>
      </form>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Monthly progress -->
      <div class="rounded-2xl border border-blue-50 bg-white/80 p-5 shadow-sm backdrop-blur anim-fade-up" style="--delay: 160ms">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-bold text-gray-700">Monthly progress</h2>
            <p class="mt-0.5 text-[11px] text-gray-400">{{ monthLabel }}</p>
          </div>
          <span class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
            :class="monthNet >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'">
            {{ monthNet >= 0 ? '+' : '' }}{{ formatIDR(monthNet) }} net
          </span>
        </div>

        <div class="space-y-4">
          <div>
            <div class="mb-1.5 flex items-center justify-between text-xs">
              <span class="font-semibold text-gray-600">Income</span>
              <span class="font-bold tabular-nums text-emerald-600">{{ formatIDR(monthIncome) }}</span>
            </div>
            <div class="h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700"
                :style="{ width: `${incomeWidth}%` }" />
            </div>
          </div>

          <div>
            <div class="mb-1.5 flex items-center justify-between text-xs">
              <span class="font-semibold text-gray-600">Expenses</span>
              <span class="font-bold tabular-nums text-rose-500">{{ formatIDR(monthExpenses) }}</span>
            </div>
            <div class="h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div class="h-full rounded-full bg-gradient-to-r from-rose-400 to-orange-400 transition-all duration-700"
                :style="{ width: `${expenseWidth}%` }" />
            </div>
          </div>

          <div class="rounded-xl bg-gray-50 p-3">
            <div class="flex items-center justify-between text-xs">
              <span class="font-semibold text-gray-600">Savings rate</span>
              <span class="font-bold tabular-nums" :class="savingsRate >= 0 ? 'text-blue-600' : 'text-rose-500'">
                {{ monthIncome > 0 ? `${savingsRate.toFixed(0)}%` : '—' }}
              </span>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
              <div class="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-700"
                :style="{ width: `${savingsWidth}%` }" />
            </div>
            <p class="mt-2 text-[10px] text-gray-400">
              {{ monthIncome > 0 ? `${expenseRatio.toFixed(0)}% of income spent this month` : 'Add income to start tracking your savings rate.' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Expense breakdown -->
      <div class="rounded-2xl border border-blue-50 bg-white/80 p-5 shadow-sm backdrop-blur anim-fade-up" style="--delay: 200ms">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-bold text-gray-700">Expense breakdown</h2>
            <p class="mt-0.5 text-[11px] text-gray-400">By category · {{ monthLabel }}</p>
          </div>
          <span class="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-500">
            {{ categoryBreakdown.length }} categories
          </span>
        </div>

        <div v-if="categoryBreakdown.length" class="space-y-3">
          <div v-for="item in categoryBreakdown" :key="item.category">
            <div class="mb-1 flex items-center justify-between gap-3 text-xs">
              <span class="flex min-w-0 items-center gap-1.5 font-semibold text-gray-600">
                <span>{{ item.icon }}</span>
                <span class="truncate">{{ item.category }}</span>
              </span>
              <span class="shrink-0 font-bold tabular-nums text-gray-500">{{ formatIDR(item.amount) }}</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-gray-100">
              <div class="h-full rounded-full bg-gradient-to-r from-rose-400 to-orange-400 transition-all duration-700"
                :style="{ width: `${item.pct}%` }" />
            </div>
          </div>
        </div>

        <div v-else class="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 text-center">
          <span class="text-2xl">🧾</span>
          <p class="mt-1 text-xs font-semibold text-gray-500">No expenses this month</p>
          <p class="text-[11px] text-gray-400">Record an expense to see the breakdown.</p>
        </div>
      </div>
    </div>

    <!-- Income vs expenses trend -->
    <div class="rounded-2xl border border-blue-50 bg-white/80 p-5 shadow-sm backdrop-blur anim-fade-up" style="--delay: 220ms">
      <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-bold text-gray-700">Income vs expenses</h2>
          <p class="mt-0.5 text-[11px] text-gray-400">Last 6 months</p>
        </div>
        <div class="flex items-center gap-3 text-[10px] font-semibold text-gray-400">
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-emerald-400" /> Income</span>
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-rose-400" /> Expenses</span>
        </div>
      </div>

      <div class="flex items-end gap-2 sm:gap-4">
        <div v-for="month in monthlyTrend" :key="month.key" class="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div class="flex h-32 w-full items-end justify-center gap-1">
            <div class="w-2.5 rounded-t-md bg-emerald-400 transition-all duration-500 hover:bg-emerald-500 sm:w-3"
              :style="{ height: `${month.income ? Math.max((month.income / trendMax) * 100, 3) : 0}%` }"
              :title="`Income ${formatIDR(month.income)}`" />
            <div class="w-2.5 rounded-t-md bg-rose-400 transition-all duration-500 hover:bg-rose-500 sm:w-3"
              :style="{ height: `${month.expenses ? Math.max((month.expenses / trendMax) * 100, 3) : 0}%` }"
              :title="`Expenses ${formatIDR(month.expenses)}`" />
          </div>
          <span class="truncate text-[10px] font-semibold text-gray-400">{{ month.label }}</span>
        </div>
      </div>
    </div>

    <!-- Transaction history -->
    <div class="overflow-hidden rounded-2xl border border-blue-50 bg-white/80 shadow-sm backdrop-blur anim-fade-up" style="--delay: 260ms">
      <div class="flex flex-col gap-3 border-b border-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-sm font-bold text-gray-700">Transaction history</h2>
          <p class="text-[11px] text-gray-400">{{ filteredTransactions.length }} of {{ store.transactions.length }} transactions</p>
        </div>
        <div class="flex rounded-xl bg-gray-100 p-1">
          <button v-for="tab in transactionFilters" :key="tab.value" type="button"
            :aria-pressed="filterType === tab.value" @click="filterType = tab.value"
            class="rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all duration-300"
            :class="filterType === tab.value
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'">
            {{ tab.label }}
          </button>
        </div>
      </div>

      <TransitionGroup name="list" tag="div" class="relative divide-y divide-gray-50">
        <div v-for="tx in filteredTransactions" :key="tx.id"
          class="group flex items-center gap-3 p-4 transition-colors duration-300 hover:bg-gray-50/70 sm:gap-4">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg transition-transform duration-300 group-hover:scale-110"
            :class="tx.amount >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'">
            {{ categoryIcons[tx.category] || (tx.amount >= 0 ? '💰' : '🧾') }}
          </div>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-gray-700">{{ tx.description }}</p>
            <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
              <span class="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-500">{{ tx.category }}</span>
              <span>{{ formatDate(tx.date) }}</span>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-2 sm:gap-3">
            <span class="whitespace-nowrap text-sm font-bold tabular-nums"
              :class="tx.amount >= 0 ? 'text-emerald-600' : 'text-rose-500'">
              {{ tx.amount >= 0 ? '+' : '' }}{{ formatIDR(tx.amount) }}
            </span>
            <button type="button" @click="store.removeTransaction(tx.id)" title="Remove transaction"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 transition-all duration-300 hover:bg-rose-50 hover:text-rose-500 active:scale-90">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 .93h6a1 1 0 0 0 1-.93l1-13M10 11v6m4-6v6" />
              </svg>
            </button>
          </div>
        </div>
      </TransitionGroup>

      <div v-if="!filteredTransactions.length" class="flex flex-col items-center justify-center px-4 py-12 text-center">
        <span class="text-3xl">💳</span>
        <p class="mt-2 text-sm font-semibold text-gray-600">No transactions found</p>
        <p class="text-xs text-gray-400">Try another filter or record a new transaction.</p>
      </div>
    </div>
  </div>
</template>
