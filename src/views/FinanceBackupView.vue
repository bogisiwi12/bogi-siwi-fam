<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import * as XLSX from 'xlsx'
import { useFinanceStore } from '@/stores/financeStore'
import { useAuthStore } from '@/stores/authStore'
import { categoryMeta, FINANCE_CATEGORIES } from '@/config/finance'

const store = useFinanceStore()
const auth = useAuthStore()
const canManage = computed(() => auth.isAdmin || auth.isParent)
const exporting = ref(false)
const success = ref('')
const form = reactive({
  transactionType: 'all',
  category: 'all',
  walletId: 'all',
  dateFrom: '',
  dateTo: '',
  includeTransactions: true,
  includeWallets: true,
  includeEntries: true
})

const categoryOptions = computed(() => {
  if (form.transactionType === 'all') {
    const categories = [...FINANCE_CATEGORIES.income, ...FINANCE_CATEGORIES.expense]
    return [...new Map(categories.map((category) => [category.value, category])).values()]
  }
  return FINANCE_CATEGORIES[form.transactionType] || []
})

const filteredTransactions = computed(() =>
  store.transactions.filter((transaction) => {
    if (form.transactionType !== 'all' && transaction.type !== form.transactionType) return false
    if (form.category !== 'all' && transaction.category !== form.category) return false
    if (form.walletId !== 'all' && transaction.walletId !== form.walletId) return false
    if (form.dateFrom && transaction.date < form.dateFrom) return false
    if (form.dateTo && transaction.date > form.dateTo) return false
    return true
  })
)

const selectedSheetCount = computed(
  () => Number(form.includeTransactions) + Number(form.includeWallets) + Number(form.includeEntries)
)

function onTypeChange() {
  if (form.category !== 'all' && !categoryOptions.value.some((item) => item.value === form.category)) {
    form.category = 'all'
  }
}

function safeDate(value) {
  if (!value) return ''
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString()
  return String(value)
}

function exportWorkbook() {
  success.value = ''
  if (!canManage.value || !selectedSheetCount.value) return
  if (form.dateFrom && form.dateTo && form.dateFrom > form.dateTo) {
    success.value = 'Start date must be before the end date.'
    return
  }

  exporting.value = true
  try {
    const workbook = XLSX.utils.book_new()
    if (form.includeTransactions) {
      const wallets = new Map(store.wallets.map((wallet) => [wallet.id, wallet.name]))
      const entries = new Map(store.entries.map((entry) => [entry.id, entry.name]))
      const rows = filteredTransactions.value.map((item) => ({
        'Transaction ID': item.id,
        Date: item.date || '',
        Type: item.type || '',
        Category: categoryMeta(item.type, item.category).label,
        Amount: Number(item.amount) || 0,
        Currency: localStorage.getItem('finance-currency') || 'IDR',
        Wallet: wallets.get(item.walletId) || '',
        'Wallet ID': item.walletId || '',
        'Linked Goal or Debt': entries.get(item.entryId) || '',
        'Linked Entry ID': item.entryId || '',
        Note: item.note || '',
        'Created At': safeDate(item.createdAt)
      }))
      const sheet = XLSX.utils.json_to_sheet(rows, {
        header: [
          'Transaction ID', 'Date', 'Type', 'Category', 'Amount', 'Currency', 'Wallet',
          'Wallet ID', 'Linked Goal or Debt', 'Linked Entry ID', 'Note', 'Created At'
        ]
      })
      sheet['!cols'] = [18, 13, 12, 24, 16, 12, 22, 30, 26, 30, 42, 25].map((wch) => ({ wch }))
      if (rows.length) sheet['!autofilter'] = { ref: sheet['!ref'] }
      XLSX.utils.book_append_sheet(workbook, sheet, 'Transactions')
    }

    if (form.includeWallets) {
      const rows = store.wallets.map((wallet) => {
        const computedWallet = store.walletsWithBalance.find((item) => item.id === wallet.id) || wallet
        return {
          'Wallet ID': wallet.id,
          Name: wallet.name || '',
          Type: wallet.type || '',
          'Starting Balance': Number(wallet.initialBalance) || 0,
          'Credit Limit': Number(wallet.creditLimit) || 0,
          Income: Number(computedWallet.income) || 0,
          Expenses: Number(computedWallet.expense) || 0,
          Balance: Number(computedWallet.balance) || 0,
          'Created At': safeDate(wallet.createdAt)
        }
      })
      const sheet = XLSX.utils.json_to_sheet(rows, {
        header: ['Wallet ID', 'Name', 'Type', 'Starting Balance', 'Credit Limit', 'Income', 'Expenses', 'Balance', 'Created At']
      })
      sheet['!cols'] = [30, 24, 14, 18, 16, 16, 16, 16, 25].map((wch) => ({ wch }))
      XLSX.utils.book_append_sheet(workbook, sheet, 'Wallets')
    }

    if (form.includeEntries) {
      const rows = store.entries.map((entry) => ({
        'Entry ID': entry.id,
        Type: entry.type || '',
        Name: entry.name || '',
        Amount: Number(entry.amount) || 0,
        Note: entry.note || '',
        'Created At': safeDate(entry.createdAt)
      }))
      const sheet = XLSX.utils.json_to_sheet(rows, {
        header: ['Entry ID', 'Type', 'Name', 'Amount', 'Note', 'Created At']
      })
      sheet['!cols'] = [30, 14, 28, 18, 42, 25].map((wch) => ({ wch }))
      XLSX.utils.book_append_sheet(workbook, sheet, 'Goals and Debts')
    }

    const now = new Date()
    const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
    XLSX.writeFile(workbook, `finance-backup-${stamp}.xlsx`, { compression: true })
    success.value = `Excel backup downloaded with ${selectedSheetCount.value} sheet${selectedSheetCount.value === 1 ? '' : 's'}.`
  } catch (error) {
    console.error('Exporting finance backup:', error)
    success.value = 'The Excel file could not be created. Please try again.'
  } finally {
    exporting.value = false
  }
}

onMounted(() => store.init())
onUnmounted(() => store.dispose())
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-5 pb-28 lg:pb-6">
    <div class="flex flex-col gap-4 anim-fade-up sm:flex-row sm:items-center sm:justify-between">
      <div class="flex min-w-0 items-center gap-3">
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-2xl shadow-lg shadow-sky-200/60">📤</span>
        <div class="min-w-0">
          <RouterLink to="/finance" class="text-xs font-semibold text-blue-500 hover:text-blue-700">← Finance</RouterLink>
          <h1 class="text-2xl font-extrabold text-gray-800 lg:text-3xl">Backup & Export</h1>
          <p class="text-sm text-gray-500">Choose the finance data you want in your Excel workbook.</p>
        </div>
      </div>
      <div class="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
        {{ store.loading || store.walletsLoading || store.entriesLoading ? 'Loading finance data…' : `${store.transactions.length} transactions · ${store.wallets.length} wallets · ${store.entries.length} goals & debts` }}
      </div>
    </div>

    <div v-if="!canManage" class="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
      Only family admins and parents can export finance data.
    </div>

    <template v-else>
      <div class="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <section class="rounded-2xl border border-gray-100 bg-white/90 p-5 shadow-sm sm:p-6">
          <h2 class="text-base font-extrabold text-gray-800">Transactions to include</h2>
          <p class="mt-1 text-xs text-gray-500">These filters apply to the Transactions sheet.</p>

          <div class="mt-5 grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-wide text-gray-400">Transaction type</span>
              <select v-model="form.transactionType" class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" @change="onTypeChange">
                <option value="all">All transactions</option>
                <option value="income">Income only</option>
                <option value="expense">Expenses only</option>
              </select>
            </label>
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-wide text-gray-400">Category</span>
              <select v-model="form.category" class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                <option value="all">All categories</option>
                <option v-for="category in categoryOptions" :key="category.value" :value="category.value">{{ category.label }}</option>
              </select>
            </label>
            <label class="block sm:col-span-2">
              <span class="text-xs font-bold uppercase tracking-wide text-gray-400">Wallet</span>
              <select v-model="form.walletId" class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                <option value="all">All wallets</option>
                <option v-for="wallet in store.wallets" :key="wallet.id" :value="wallet.id">{{ wallet.name }} ({{ wallet.type }})</option>
              </select>
            </label>
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-wide text-gray-400">From date</span>
              <input v-model="form.dateFrom" type="date" class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </label>
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-wide text-gray-400">To date</span>
              <input v-model="form.dateTo" type="date" class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </label>
          </div>
          <p class="mt-4 rounded-xl bg-gray-50 px-3 py-2.5 text-xs font-semibold text-gray-500">
            {{ filteredTransactions.length }} of {{ store.transactions.length }} transaction{{ filteredTransactions.length === 1 ? '' : 's' }} match the selected filters.
          </p>
        </section>

        <section class="rounded-2xl border border-gray-100 bg-white/90 p-5 shadow-sm sm:p-6">
          <h2 class="text-base font-extrabold text-gray-800">Workbook sheets</h2>
          <p class="mt-1 text-xs text-gray-500">Select which data tables to add to the Excel file.</p>
          <div class="mt-5 space-y-3">
            <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 p-3 transition-colors hover:bg-gray-50">
              <input v-model="form.includeTransactions" type="checkbox" class="mt-0.5 h-4 w-4 accent-blue-600" />
              <span><span class="block text-sm font-bold text-gray-700">Transactions</span><span class="text-xs text-gray-400">Income, expenses, categories, notes, wallets, and dates</span></span>
            </label>
            <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 p-3 transition-colors hover:bg-gray-50">
              <input v-model="form.includeWallets" type="checkbox" class="mt-0.5 h-4 w-4 accent-blue-600" />
              <span><span class="block text-sm font-bold text-gray-700">Wallets</span><span class="text-xs text-gray-400">Starting balance, credit limit, income, expenses, and balance</span></span>
            </label>
            <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 p-3 transition-colors hover:bg-gray-50">
              <input v-model="form.includeEntries" type="checkbox" class="mt-0.5 h-4 w-4 accent-blue-600" />
              <span><span class="block text-sm font-bold text-gray-700">Goals & debts</span><span class="text-xs text-gray-400">Goals, borrowed and lent records</span></span>
            </label>
          </div>
          <div class="mt-5 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
            The date, category, type, and wallet filters only narrow the Transactions sheet. Wallet and Goals & Debts sheets include all records.
          </div>
        </section>
      </div>

      <div class="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-sky-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p class="text-sm font-extrabold text-gray-800">Ready to export {{ selectedSheetCount }} sheet{{ selectedSheetCount === 1 ? '' : 's' }}</p>
          <p class="mt-0.5 text-xs text-gray-500">Creates an .xlsx workbook on this device.</p>
        </div>
        <button type="button" :disabled="exporting || !selectedSheetCount || store.loading || store.walletsLoading || store.entriesLoading" class="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-200/60 transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50" @click="exportWorkbook">
          <span>{{ exporting ? 'Preparing workbook…' : '⬇ Download Excel backup' }}</span>
        </button>
      </div>
      <p v-if="success" role="status" class="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{{ success }}</p>
    </template>
  </div>
</template>
