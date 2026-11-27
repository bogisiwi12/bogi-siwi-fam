<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useFinanceStore } from '@/stores/financeStore'
import NotificationBell from '@/components/NotificationBell.vue'
import { CURRENCIES, TRANSFER_CATEGORY, categoryMeta, walletMeta } from '@/config/finance'

const store = useFinanceStore()

const currency = ref(loadCurrency())
const rangeMode = ref('month')
const selectedMonth = ref(currentMonth())

const CHART_COLORS = [
  '#f97316',
  '#f43f5e',
  '#8b5cf6',
  '#0ea5e9',
  '#10b981',
  '#eab308',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
  '#f59e0b',
  '#64748b',
  '#84cc16',
  '#06b6d4',
]

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
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency.value} ${amount.toLocaleString()}`
  }
}

function formatMonthLabel(value) {
  if (!value) return 'All time'
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return value
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function shortMonthLabel(value) {
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return value
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short' })
}

function setCurrency(event) {
  currency.value = event.target.value
  try {
    localStorage.setItem('finance-currency', currency.value)
  } catch {
    // Ignore storage failures.
  }
}

const filteredTransactions = computed(() => {
  if (rangeMode.value === 'all') return store.transactions
  return store.transactions.filter((transaction) =>
    (transaction.date || '').startsWith(selectedMonth.value),
  )
})

const periodLabel = computed(() =>
  rangeMode.value === 'all' ? 'All time' : formatMonthLabel(selectedMonth.value),
)

const totals = computed(() => {
  let income = 0
  let expense = 0
  let incomeCount = 0
  let expenseCount = 0
  let biggestExpense = null
  for (const transaction of filteredTransactions.value) {
    const amount = Number(transaction.amount) || 0
    if (transaction.type === 'income') {
      income += amount
      incomeCount += 1
    } else {
      expense += amount
      expenseCount += 1
      if (!biggestExpense || amount > biggestExpense.amount) {
        biggestExpense = { ...transaction, amount }
      }
    }
  }
  const balance = income - expense
  return {
    income,
    expense,
    balance,
    incomeCount,
    expenseCount,
    count: incomeCount + expenseCount,
    avgExpense: expenseCount > 0 ? expense / expenseCount : 0,
    biggestExpense,
    savingsRate: income > 0 ? (balance / income) * 100 : null,
  }
})

function buildBreakdown(type) {
  const map = new Map()
  let total = 0
  for (const transaction of filteredTransactions.value) {
    if (transaction.type !== type) continue
    if (transaction.category === TRANSFER_CATEGORY.value) continue
    const amount = Number(transaction.amount) || 0
    map.set(transaction.category, (map.get(transaction.category) || 0) + amount)
    total += amount
  }
  return [...map.entries()]
    .map(([value, amount]) => ({
      value,
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0,
      meta: categoryMeta(type, value),
    }))
    .sort((a, b) => b.amount - a.amount)
}

const expenseCategories = computed(() => buildBreakdown('expense'))
const incomeCategories = computed(() => buildBreakdown('income'))

const topExpenseCategories = computed(() => expenseCategories.value.slice(0, 6))
const topIncomeCategories = computed(() => incomeCategories.value.slice(0, 6))

const expenseDonut = computed(() => {
  let offset = 0
  return expenseCategories.value.map((item, index) => {
    const segment = {
      ...item,
      color: CHART_COLORS[index % CHART_COLORS.length],
      dash: `${item.percent} ${Math.max(0, 100 - item.percent)}`,
      offset: -offset,
    }
    offset += item.percent
    return segment
  })
})

function monthKeysEndingAt(month, count) {
  const [year, monthNumber] = month.split('-').map(Number)
  const keys = []
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(year, monthNumber - 1 - index, 1)
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

const monthlyTrend = computed(() => {
  const map = new Map()
  for (const transaction of store.transactions) {
    const key = (transaction.date || '').slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(key)) continue
    if (!map.has(key)) map.set(key, { income: 0, expense: 0 })
    const bucket = map.get(key)
    const amount = Number(transaction.amount) || 0
    if (transaction.type === 'income') bucket.income += amount
    else bucket.expense += amount
  }

  let keys
  if (rangeMode.value === 'month' && selectedMonth.value) {
    keys = monthKeysEndingAt(selectedMonth.value, 6)
  } else {
    keys = [...map.keys()].sort().slice(-12)
  }

  return keys.map((key) => {
    const bucket = map.get(key) || { income: 0, expense: 0 }
    return {
      key,
      label: shortMonthLabel(key),
      fullLabel: formatMonthLabel(key),
      income: bucket.income,
      expense: bucket.expense,
      net: bucket.income - bucket.expense,
    }
  })
})

const monthlyMax = computed(() =>
  Math.max(1, ...monthlyTrend.value.flatMap((month) => [month.income, month.expense])),
)

function barHeight(value) {
  if (!value) return 0
  return Math.max(3, (value / monthlyMax.value) * 100)
}

const balanceSeries = computed(() => {
  if (rangeMode.value === 'month' && selectedMonth.value) {
    const [year, month] = selectedMonth.value.split('-').map(Number)
    const days = new Date(year, month, 0).getDate()
    const daily = Array.from({ length: days }, () => 0)
    for (const transaction of filteredTransactions.value) {
      const day = Number((transaction.date || '').slice(8, 10))
      if (!day || day > days) continue
      const amount = Number(transaction.amount) || 0
      daily[day - 1] += transaction.type === 'income' ? amount : -amount
    }
    let running = 0
    return daily.map((value, index) => {
      running += value
      return { label: String(index + 1), value: running }
    })
  }

  let running = 0
  return monthlyTrend.value.map((month) => {
    running += month.net
    return { label: month.label, value: running }
  })
})

const balanceChart = computed(() => {
  const series = balanceSeries.value
  if (!series.length) return null

  const values = series.map((point) => point.value)
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const width = 100
  const height = 42
  const padX = 1.5
  const padY = 3
  const innerWidth = width - padX * 2
  const innerHeight = height - padY * 2
  const step = series.length > 1 ? innerWidth / (series.length - 1) : 0

  const points = series.map((point, index) => {
    const x = series.length > 1 ? padX + index * step : width / 2
    const y = padY + innerHeight * (1 - (point.value - min) / span)
    return { x, y, ...point }
  })

  const linePoints = points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
  const line = linePoints.join(' ')
  const baseline = (height - padY).toFixed(2)
  const area = `M${linePoints[0]} L${linePoints.slice(1).join(' L')} L${points[points.length - 1].x.toFixed(2)},${baseline} L${points[0].x.toFixed(2)},${baseline} Z`

  const zeroY = padY + innerHeight * (1 - (0 - min) / span)

  const labelIndexes = []
  const labelCount = Math.min(4, series.length)
  for (let index = 0; index < labelCount; index += 1) {
    const pointIndex =
      labelCount === 1 ? 0 : Math.round((index * (series.length - 1)) / (labelCount - 1))
    if (!labelIndexes.includes(pointIndex)) labelIndexes.push(pointIndex)
  }

  return {
    points,
    line,
    area,
    zeroY,
    lastValue: series[series.length - 1].value,
    labels: labelIndexes.map((index) => series[index].label),
    gridLines: [0.25, 0.5, 0.75].map((ratio) => padY + innerHeight * ratio),
  }
})

const walletBreakdown = computed(() => {
  const map = new Map()
  let totalExpense = 0
  for (const transaction of filteredTransactions.value) {
    const key = transaction.walletId || 'unassigned'
    if (!map.has(key)) map.set(key, { income: 0, expense: 0 })
    const bucket = map.get(key)
    const amount = Number(transaction.amount) || 0
    if (transaction.type === 'income') bucket.income += amount
    else {
      bucket.expense += amount
      totalExpense += amount
    }
  }

  const walletsById = Object.fromEntries(store.wallets.map((wallet) => [wallet.id, wallet]))

  return [...map.entries()]
    .map(([id, bucket]) => {
      const wallet = walletsById[id]
      return {
        id,
        name: wallet?.name || 'Unassigned wallet',
        type: wallet?.type || 'other',
        meta: wallet ? walletMeta(wallet.type) : walletMeta('other'),
        income: bucket.income,
        expense: bucket.expense,
        net: bucket.income - bucket.expense,
        percent: totalExpense > 0 ? (bucket.expense / totalExpense) * 100 : 0,
      }
    })
    .sort((a, b) => b.expense - a.expense)
})

const hasTransactions = computed(() => filteredTransactions.value.length > 0)

onMounted(() => {
  store.init()
})

onUnmounted(() => {
  store.dispose()
})
</script>

<template>
  <div class="space-y-5 pb-28 lg:pb-6">
    <div class="flex flex-col gap-4 anim-fade-up sm:flex-row sm:items-center sm:justify-between">
      <div class="flex min-w-0 items-center gap-3">
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-2xl shadow-lg shadow-violet-200/60"
        >
          📊
        </span>
        <div class="min-w-0">
          <RouterLink
            to="/finance"
            class="text-xs font-semibold text-blue-500 transition-colors hover:text-blue-700"
          >
            ← Finance
          </RouterLink>
          <h1 class="text-2xl font-extrabold text-gray-800 lg:text-3xl">Transaction Summary</h1>
          <p class="text-sm text-gray-500">Charts and insights across all your transactions.</p>
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
      </div>
    </div>

    <div
      v-if="store.error"
      class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600"
    >
      {{ store.error }}
    </div>

    <div
      class="rounded-2xl border border-gray-100 bg-white/80 p-3 shadow-sm backdrop-blur anim-fade-up sm:p-4"
      style="--delay: 40ms"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-2">
          <div class="inline-flex rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
              :class="
                rangeMode === 'month'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              "
              @click="rangeMode = 'month'"
            >
              Monthly
            </button>
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
              :class="
                rangeMode === 'all'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              "
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
        </div>
        <span
          class="inline-flex items-center gap-2 self-start rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-blue-500" />
          {{ periodLabel }} · {{ totals.count }} transactions
        </span>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      <div
        class="group rounded-2xl border border-emerald-50 bg-white/80 p-4 shadow-sm backdrop-blur transition-all duration-300 hover-lift anim-fade-up sm:p-5"
      >
        <div class="flex items-center justify-between gap-2">
          <span
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-lg transition-transform duration-300 group-hover:scale-110 sm:h-10 sm:w-10 sm:text-xl"
            >📈</span
          >
          <span
            class="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600"
            >{{ totals.incomeCount }} entries</span
          >
        </div>
        <p class="mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">
          Total income
        </p>
        <p class="mt-1 text-xl font-extrabold tabular-nums text-emerald-600 sm:text-2xl">
          +{{ formatMoney(totals.income) }}
        </p>
      </div>

      <div
        class="group rounded-2xl border border-rose-50 bg-white/80 p-4 shadow-sm backdrop-blur transition-all duration-300 hover-lift anim-fade-up sm:p-5"
        style="--delay: 60ms"
      >
        <div class="flex items-center justify-between gap-2">
          <span
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-lg transition-transform duration-300 group-hover:scale-110 sm:h-10 sm:w-10 sm:text-xl"
            >📉</span
          >
          <span class="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-500"
            >{{ totals.expenseCount }} entries</span
          >
        </div>
        <p class="mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">
          Total expenses
        </p>
        <p class="mt-1 text-xl font-extrabold tabular-nums text-rose-500 sm:text-2xl">
          −{{ formatMoney(totals.expense) }}
        </p>
      </div>

      <div
        class="group rounded-2xl border border-blue-50 bg-white/80 p-4 shadow-sm backdrop-blur transition-all duration-300 hover-lift anim-fade-up sm:p-5"
        style="--delay: 120ms"
      >
        <div class="flex items-center justify-between gap-2">
          <span
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-lg transition-transform duration-300 group-hover:scale-110 sm:h-10 sm:w-10 sm:text-xl"
            >💵</span
          >
        </div>
        <p class="mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">
          Net balance
        </p>
        <p
          class="mt-1 text-xl font-extrabold tabular-nums sm:text-2xl"
          :class="totals.balance >= 0 ? 'text-gray-800' : 'text-rose-500'"
        >
          {{ formatMoney(totals.balance) }}
        </p>
      </div>

      <div
        class="group rounded-2xl border border-purple-50 bg-white/80 p-4 shadow-sm backdrop-blur transition-all duration-300 hover-lift anim-fade-up sm:p-5"
        style="--delay: 180ms"
      >
        <div class="flex items-center justify-between gap-2">
          <span
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-lg transition-transform duration-300 group-hover:scale-110 sm:h-10 sm:w-10 sm:text-xl"
            >🧮</span
          >
        </div>
        <p class="mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">
          Savings rate
        </p>
        <p class="mt-1 text-xl font-extrabold tabular-nums text-purple-600 sm:text-2xl">
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

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div
        class="rounded-2xl border border-gray-100 bg-white/70 px-3 py-3 shadow-sm backdrop-blur anim-fade-up"
        style="--delay: 200ms"
      >
        <p class="text-[10px] font-bold uppercase tracking-wide text-gray-400">Transactions</p>
        <p class="mt-1 text-lg font-extrabold tabular-nums text-gray-800">{{ totals.count }}</p>
      </div>
      <div
        class="rounded-2xl border border-gray-100 bg-white/70 px-3 py-3 shadow-sm backdrop-blur anim-fade-up"
        style="--delay: 220ms"
      >
        <p class="text-[10px] font-bold uppercase tracking-wide text-gray-400">Avg. expense</p>
        <p class="mt-1 text-lg font-extrabold tabular-nums text-gray-800">
          {{ formatMoney(totals.avgExpense) }}
        </p>
      </div>
      <div
        class="rounded-2xl border border-gray-100 bg-white/70 px-3 py-3 shadow-sm backdrop-blur anim-fade-up"
        style="--delay: 240ms"
      >
        <p class="text-[10px] font-bold uppercase tracking-wide text-gray-400">Biggest expense</p>
        <p class="mt-1 truncate text-lg font-extrabold tabular-nums text-gray-800">
          {{ totals.biggestExpense ? formatMoney(totals.biggestExpense.amount) : '—' }}
        </p>
      </div>
      <div
        class="rounded-2xl border border-gray-100 bg-white/70 px-3 py-3 shadow-sm backdrop-blur anim-fade-up"
        style="--delay: 260ms"
      >
        <p class="text-[10px] font-bold uppercase tracking-wide text-gray-400">Top category</p>
        <p class="mt-1 truncate text-lg font-extrabold text-gray-800">
          {{
            topExpenseCategories.length
              ? `${topExpenseCategories[0].meta.icon} ${topExpenseCategories[0].meta.label}`
              : '—'
          }}
        </p>
      </div>
    </div>

    <div
      v-if="store.loading"
      class="flex items-center justify-center gap-3 rounded-2xl border border-blue-50 bg-white/80 px-4 py-16 text-sm text-gray-400"
    >
      <span class="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-500" />
      Loading transactions...
    </div>

    <div
      v-else-if="!hasTransactions"
      class="rounded-2xl border border-dashed border-blue-200 bg-white/60 px-4 py-16 text-center"
    >
      <p class="text-3xl">📊</p>
      <p class="mt-2 text-sm font-semibold text-gray-600">No transactions in this period</p>
      <p class="mt-1 text-xs text-gray-400">
        Add income or expenses in Finance to see the charts come alive.
      </p>
      <RouterLink
        to="/finance"
        class="mt-4 inline-flex rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
      >
        Go to Finance
      </RouterLink>
    </div>

    <template v-else>
      <div class="grid gap-4 lg:grid-cols-3">
        <div
          class="overflow-hidden rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm backdrop-blur anim-fade-up sm:p-5 lg:col-span-2"
          style="--delay: 280ms"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="text-sm font-bold text-gray-700">Monthly income vs expenses</h2>
              <p class="text-xs text-gray-400">
                {{ rangeMode === 'month' ? 'Last 6 months' : 'Last 12 months' }} at a glance
              </p>
            </div>
            <div class="flex items-center gap-3 text-[11px] font-semibold text-gray-500">
              <span class="inline-flex items-center gap-1.5">
                <span class="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Income
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="h-2.5 w-2.5 rounded-sm bg-rose-400" /> Expenses
              </span>
            </div>
          </div>

          <div class="mt-5 overflow-x-auto pb-1">
            <div class="flex min-w-[420px] items-end gap-3 sm:gap-4">
              <div
                v-for="month in monthlyTrend"
                :key="month.key"
                class="flex min-w-0 flex-1 flex-col items-center"
              >
                <div class="flex h-40 w-full items-end justify-center gap-1.5">
                  <div
                    class="w-3 rounded-t-md bg-gradient-to-t from-emerald-500 to-emerald-300 transition-all duration-700 ease-out sm:w-4"
                    :style="{ height: `${barHeight(month.income)}%` }"
                    :title="`${month.fullLabel}: income ${formatMoney(month.income)}`"
                  />
                  <div
                    class="w-3 rounded-t-md bg-gradient-to-t from-rose-500 to-rose-300 transition-all duration-700 ease-out sm:w-4"
                    :style="{ height: `${barHeight(month.expense)}%` }"
                    :title="`${month.fullLabel}: expenses ${formatMoney(month.expense)}`"
                  />
                </div>
                <p class="mt-2 truncate text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  {{ month.label }}
                </p>
                <p
                  class="mt-0.5 text-[10px] font-semibold tabular-nums"
                  :class="month.net >= 0 ? 'text-emerald-600' : 'text-rose-500'"
                >
                  {{ month.net >= 0 ? '+' : '−' }}{{ formatMoney(Math.abs(month.net)) }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          class="rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm backdrop-blur anim-fade-up sm:p-5"
          style="--delay: 320ms"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-gray-700">Expenses by category</h2>
            <span class="text-[10px] font-bold uppercase tracking-wide text-gray-400">{{
              periodLabel
            }}</span>
          </div>
          <p class="mt-1 text-[10px] font-medium text-gray-400">Wallet transfers are excluded.</p>

          <div v-if="expenseDonut.length" class="mt-4 flex flex-col items-center gap-4">
            <div class="relative h-40 w-40 shrink-0">
              <svg viewBox="0 0 42 42" class="h-full w-full -rotate-90">
                <circle
                  cx="21"
                  cy="21"
                  r="15.9155"
                  fill="none"
                  stroke="#f1f5f9"
                  stroke-width="6"
                />
                <circle
                  v-for="segment in expenseDonut"
                  :key="segment.value"
                  cx="21"
                  cy="21"
                  r="15.9155"
                  fill="none"
                  :stroke="segment.color"
                  stroke-width="6"
                  :stroke-dasharray="segment.dash"
                  :stroke-dashoffset="segment.offset"
                >
                  <title>
                    {{ segment.meta.label }}: {{ formatMoney(segment.amount) }} ({{
                      Math.round(segment.percent)
                    }}%)
                  </title>
                </circle>
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="text-[10px] font-bold uppercase tracking-wide text-gray-400">Total</span>
                <span class="text-base font-extrabold tabular-nums text-gray-800">
                  {{ formatMoney(totals.expense) }}
                </span>
              </div>
            </div>

            <ul class="w-full space-y-2">
              <li
                v-for="item in topExpenseCategories"
                :key="item.value"
                class="flex items-center justify-between gap-2 text-xs"
              >
                <span class="flex min-w-0 items-center gap-2 font-semibold text-gray-600">
                  <span class="text-sm">{{ item.meta.icon }}</span>
                  <span class="truncate">{{ item.meta.label }}</span>
                </span>
                <span class="shrink-0 font-bold tabular-nums text-gray-700">
                  {{ Math.round(item.percent) }}%
                </span>
              </li>
            </ul>
          </div>
          <p
            v-else
            class="mt-4 rounded-xl bg-gray-50 px-3 py-10 text-center text-xs font-semibold text-gray-400"
          >
            No expenses in this period.
          </p>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <div
          class="rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm backdrop-blur anim-fade-up sm:p-5 lg:col-span-2"
          style="--delay: 360ms"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="text-sm font-bold text-gray-700">Cumulative balance trend</h2>
              <p class="text-xs text-gray-400">
                {{
                  rangeMode === 'month'
                    ? 'Running net balance through the month'
                    : 'Running net balance over the last 12 months'
                }}
              </p>
            </div>
            <span
              class="rounded-full px-3 py-1 text-xs font-bold tabular-nums"
              :class="
                balanceChart && balanceChart.lastValue >= 0
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-rose-50 text-rose-500'
              "
            >
              {{ balanceChart ? formatMoney(balanceChart.lastValue) : '—' }}
            </span>
          </div>

          <div v-if="balanceChart" class="mt-4">
            <svg viewBox="0 0 100 42" class="h-44 w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.28" />
                  <stop offset="100%" stop-color="#3b82f6" stop-opacity="0" />
                </linearGradient>
              </defs>
              <line
                v-for="(line, index) in balanceChart.gridLines"
                :key="index"
                x1="0"
                :y1="line"
                x2="100"
                :y2="line"
                stroke="#eef2f7"
                stroke-width="0.3"
                stroke-dasharray="1.5 1.5"
              />
              <line
                x1="0"
                :y1="balanceChart.zeroY"
                x2="100"
                :y2="balanceChart.zeroY"
                stroke="#cbd5e1"
                stroke-width="0.35"
              />
              <path :d="balanceChart.area" fill="url(#balanceFill)" />
              <polyline
                :points="balanceChart.line"
                fill="none"
                stroke="#3b82f6"
                stroke-width="0.9"
                stroke-linecap="round"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
              />
            </svg>
            <div class="mt-1 flex items-center justify-between px-0.5">
              <span
                v-for="label in balanceChart.labels"
                :key="label"
                class="text-[10px] font-semibold text-gray-400"
              >
                {{ label }}
              </span>
            </div>
          </div>
          <p
            v-else
            class="mt-4 rounded-xl bg-gray-50 px-3 py-10 text-center text-xs font-semibold text-gray-400"
          >
            Not enough data to draw the trend.
          </p>
        </div>

        <div
          class="rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm backdrop-blur anim-fade-up sm:p-5"
          style="--delay: 400ms"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-gray-700">Spending by wallet</h2>
            <span class="text-[10px] font-bold uppercase tracking-wide text-gray-400">{{
              periodLabel
            }}</span>
          </div>

          <div v-if="walletBreakdown.length" class="mt-4 space-y-3">
            <div v-for="wallet in walletBreakdown" :key="wallet.id">
              <div class="flex items-center justify-between gap-2 text-xs">
                <span class="flex min-w-0 items-center gap-2 font-semibold text-gray-600">
                  <span
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs"
                    :class="wallet.meta.class"
                  >
                    {{ wallet.meta.icon }}
                  </span>
                  <span class="truncate">{{ wallet.name }}</span>
                </span>
                <span class="shrink-0 font-bold tabular-nums text-gray-700">
                  {{ formatMoney(wallet.expense) }}
                </span>
              </div>
              <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-700 ease-out"
                  :style="{ width: `${Math.max(wallet.expense ? 2 : 0, wallet.percent)}%` }"
                />
              </div>
              <p class="mt-1 text-[10px] font-medium text-gray-400">
                {{ Math.round(wallet.percent) }}% of expenses
              </p>
            </div>
          </div>
          <p
            v-else
            class="mt-4 rounded-xl bg-gray-50 px-3 py-10 text-center text-xs font-semibold text-gray-400"
          >
            No wallet activity in this period.
          </p>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div
          class="rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm backdrop-blur anim-fade-up sm:p-5"
          style="--delay: 440ms"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-gray-700">Top spending categories</h2>
            <span class="text-[10px] font-bold uppercase tracking-wide text-gray-400">{{
              periodLabel
            }}</span>
          </div>
          <p class="mt-1 text-[10px] font-medium text-gray-400">Wallet transfers are excluded.</p>
          <div v-if="topExpenseCategories.length" class="mt-4 space-y-3">
            <div v-for="item in topExpenseCategories" :key="item.value">
              <div class="flex items-center justify-between gap-2 text-xs">
                <span class="flex min-w-0 items-center gap-2 font-semibold text-gray-600">
                  <span class="text-sm">{{ item.meta.icon }}</span>
                  <span class="truncate">{{ item.meta.label }}</span>
                </span>
                <span class="shrink-0 font-bold tabular-nums text-gray-700">{{
                  formatMoney(item.amount)
                }}</span>
              </div>
              <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-rose-400 to-orange-300 transition-all duration-700 ease-out"
                  :style="{ width: `${Math.max(2, item.percent)}%` }"
                />
              </div>
              <p class="mt-1 text-[10px] font-medium text-gray-400">
                {{ Math.round(item.percent) }}% of expenses
              </p>
            </div>
          </div>
          <p
            v-else
            class="mt-4 rounded-xl bg-gray-50 px-3 py-10 text-center text-xs font-semibold text-gray-400"
          >
            No expenses in this period.
          </p>
        </div>

        <div
          class="rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm backdrop-blur anim-fade-up sm:p-5"
          style="--delay: 480ms"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-gray-700">Income sources</h2>
            <span class="text-[10px] font-bold uppercase tracking-wide text-gray-400">{{
              periodLabel
            }}</span>
          </div>
          <p class="mt-1 text-[10px] font-medium text-gray-400">Wallet transfers are excluded.</p>
          <div v-if="topIncomeCategories.length" class="mt-4 space-y-3">
            <div v-for="item in topIncomeCategories" :key="item.value">
              <div class="flex items-center justify-between gap-2 text-xs">
                <span class="flex min-w-0 items-center gap-2 font-semibold text-gray-600">
                  <span class="text-sm">{{ item.meta.icon }}</span>
                  <span class="truncate">{{ item.meta.label }}</span>
                </span>
                <span class="shrink-0 font-bold tabular-nums text-gray-700">{{
                  formatMoney(item.amount)
                }}</span>
              </div>
              <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700 ease-out"
                  :style="{ width: `${Math.max(2, item.percent)}%` }"
                />
              </div>
              <p class="mt-1 text-[10px] font-medium text-gray-400">
                {{ Math.round(item.percent) }}% of income
              </p>
            </div>
          </div>
          <p
            v-else
            class="mt-4 rounded-xl bg-gray-50 px-3 py-10 text-center text-xs font-semibold text-gray-400"
          >
            No income in this period.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
