<script setup>
import { useFamilyStore } from '@/stores/familyStore'
import { ref, computed } from 'vue'

const store = useFamilyStore()
const newDesc = ref('')
const newAmount = ref('')
const newCategory = ref('Food')

const income = computed(() =>
  store.transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
)

const expenses = computed(() =>
  Math.abs(store.transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0))
)

function handleAdd() {
  if (!newDesc.value.trim() || !newAmount.value) return
  store.addTransaction(newDesc.value, newAmount.value, newCategory.value)
  newDesc.value = ''
  newAmount.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 anim-fade-up">
      <div>
        <h1 class="text-2xl lg:text-3xl font-extrabold text-gray-800">Family Finance 💰</h1>
        <p class="text-gray-500 mt-1">Track income and expenses.</p>
      </div>
      <span class="self-start sm:self-auto inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur px-4 py-2 text-xs font-semibold text-blue-600 shadow-sm border border-blue-100">
        <span class="w-2 h-2 rounded-full bg-emerald-400 anim-pulse-ring" />
        {{ store.transactions.length }} transactions
      </span>
    </div>

    <!-- Balance Card -->
    <div class="shimmer relative overflow-hidden bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-500 rounded-2xl p-6 text-white shadow-lg shadow-blue-200/70 anim-fade-up" style="--delay: 60ms">
      <div class="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div class="pointer-events-none absolute -bottom-16 right-16 h-40 w-40 rounded-full bg-cyan-300/20 blur-2xl" />

      <div class="relative grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div class="min-w-0">
          <p class="text-sm opacity-80">Total Balance</p>
          <p class="mt-1 text-3xl lg:text-4xl font-extrabold tabular-nums break-words">
            ${{ store.totalBalance.toFixed(2) }}
          </p>
          <p class="mt-2 text-xs opacity-70">{{ store.transactions.length }} transactions this period</p>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:min-w-[220px]">
          <div class="min-w-0 rounded-xl bg-white/15 backdrop-blur px-4 py-3 transition-transform duration-300 hover:scale-105">
            <p class="text-[10px] uppercase tracking-wide opacity-70">Income</p>
            <p class="truncate text-sm font-bold tabular-nums">+${{ income.toFixed(2) }}</p>
          </div>
          <div class="min-w-0 rounded-xl bg-white/15 backdrop-blur px-4 py-3 transition-transform duration-300 hover:scale-105">
            <p class="text-[10px] uppercase tracking-wide opacity-70">Expenses</p>
            <p class="truncate text-sm font-bold tabular-nums">-${{ expenses.toFixed(2) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Transaction -->
    <div class="bg-white/80 backdrop-blur rounded-2xl p-4 sm:p-5 shadow-sm border border-blue-50 anim-fade-up" style="--delay: 120ms">
      <div class="mb-3 flex items-center gap-2">
        <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-sm">➕</span>
        <h2 class="text-sm font-bold text-gray-700">Add transaction</h2>
      </div>

      <form class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto]"
            @submit.prevent="handleAdd">
        <input v-model="newDesc" placeholder="Description"
               class="w-full min-w-0 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all duration-300 sm:col-span-2 xl:col-span-1" />
        <input v-model="newAmount" type="number" step="0.01" placeholder="Amount (- for expense)"
               class="w-full min-w-0 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all duration-300" />
        <select v-model="newCategory"
                class="w-full min-w-0 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-white transition-all duration-300">
          <option>Food</option>
          <option>Utilities</option>
          <option>Education</option>
          <option>Entertainment</option>
          <option>Income</option>
        </select>
        <button type="submit"
                class="w-full xl:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold shadow-md shadow-blue-200/60 transition-all duration-300 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95 sm:col-span-2 xl:col-span-1">
          Add
        </button>
      </form>
    </div>

    <!-- Transaction List -->
    <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-blue-50 overflow-hidden anim-fade-up" style="--delay: 180ms">
      <div class="flex items-center justify-between border-b border-gray-50 px-4 py-3">
        <h2 class="text-sm font-bold text-gray-700">Recent activity</h2>
        <span class="text-xs text-gray-400">{{ store.transactions.length }} total</span>
      </div>

      <TransitionGroup name="list" tag="div" class="relative divide-y divide-gray-50">
        <div v-for="tx in [...store.transactions].reverse()" :key="tx.id"
             class="group flex items-center gap-3 sm:gap-4 p-4 hover:bg-gray-50/70 transition-colors duration-300">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
               :class="tx.amount >= 0 ? 'bg-green-100' : 'bg-red-100'">
            {{ tx.amount >= 0 ? '📈' : '📉' }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="truncate text-sm font-medium text-gray-700">{{ tx.description }}</p>
            <p class="truncate text-xs text-gray-400">
              <span class="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">{{ tx.category }}</span>
              · {{ tx.date }}
            </p>
          </div>
          <span class="shrink-0 whitespace-nowrap text-sm font-bold tabular-nums"
                :class="tx.amount >= 0 ? 'text-green-600' : 'text-red-500'">
            {{ tx.amount >= 0 ? '+' : '' }}{{ tx.amount.toFixed(2) }}
          </span>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>
