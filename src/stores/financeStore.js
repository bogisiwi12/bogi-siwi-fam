import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { FINANCE_TYPES, WALLET_TYPES } from '@/config/finance'

const MAX_AMOUNT = 1000000000000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const toText = (value) => (typeof value === 'string' ? value.trim() : '')
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeTransaction(payload) {
  return {
    type: FINANCE_TYPES.includes(payload.type) ? payload.type : 'expense',
    amount: Math.round(toNumber(payload.amount, 0) * 100) / 100,
    category: toText(payload.category).slice(0, 40),
    date: toText(payload.date).slice(0, 10),
    note: toText(payload.note).slice(0, 300),
    walletId: toText(payload.walletId).slice(0, 128)
  }
}

function normalizeWallet(payload) {
  const type = WALLET_TYPES.some((item) => item.value === payload.type) ? payload.type : 'cash'
  return {
    name: toText(payload.name).slice(0, 60),
    type,
    initialBalance: Math.round(toNumber(payload.initialBalance, 0) * 100) / 100,
    creditLimit:
      type === 'credit' ? Math.max(0, Math.round(toNumber(payload.creditLimit, 0) * 100) / 100) : 0
  }
}

export const useFinanceStore = defineStore('finance', () => {
  const transactions = ref([])
  const wallets = ref([])
  const loading = ref(false)
  const walletsLoading = ref(false)
  const error = ref('')

  let transactionsUnbind = null
  let walletsUnbind = null
  let initPromise = null

  const walletsWithBalance = computed(() =>
    wallets.value.map((wallet) => {
      const initialBalance = Number(wallet.initialBalance) || 0
      const creditLimit = Number(wallet.creditLimit) || 0
      let income = 0
      let expense = 0
      for (const transaction of transactions.value) {
        if (transaction.walletId !== wallet.id) continue
        const amount = Number(transaction.amount) || 0
        if (transaction.type === 'income') income += amount
        else expense += amount
      }

      if (wallet.type === 'credit') {
        const usedAmount = Math.max(0, initialBalance + expense - income)
        return {
          ...wallet,
          income,
          expense,
          creditLimit,
          usedAmount,
          availableCredit: Math.max(0, creditLimit - usedAmount),
          balance: -usedAmount
        }
      }

      return {
        ...wallet,
        income,
        expense,
        creditLimit: 0,
        balance: initialBalance + income - expense
      }
    })
  )

  function handleError(label, err) {
    console.error(`${label}:`, err)
    error.value = err?.message || `${label} failed.`
  }

  async function persist(operation, label) {
    error.value = ''
    try {
      await operation
      return true
    } catch (err) {
      handleError(label, err)
      return false
    }
  }

  function validateTransaction(payload) {
    if (!FINANCE_TYPES.includes(payload.type)) {
      error.value = 'Choose income or expense.'
      return false
    }
    if (!(payload.amount > 0)) {
      error.value = 'Enter an amount greater than zero.'
      return false
    }
    if (payload.amount > MAX_AMOUNT) {
      error.value = 'That amount is too large.'
      return false
    }
    if (!payload.category) {
      error.value = 'Choose a category.'
      return false
    }
    if (!ISO_DATE.test(payload.date)) {
      error.value = 'Choose a valid date.'
      return false
    }
    if (!payload.walletId) {
      error.value = 'Choose a wallet.'
      return false
    }
    return true
  }

  function validateWallet(payload) {
    if (!payload.name) {
      error.value = 'Enter a wallet name.'
      return false
    }
    if (!WALLET_TYPES.some((item) => item.value === payload.type)) {
      error.value = 'Choose a wallet type.'
      return false
    }
    if (!Number.isFinite(payload.initialBalance) || Math.abs(payload.initialBalance) > MAX_AMOUNT) {
      error.value = 'Enter a valid starting balance.'
      return false
    }
    if (payload.type === 'credit' && !(payload.creditLimit > 0)) {
      error.value = 'Enter a credit limit greater than zero.'
      return false
    }
    if (payload.type === 'credit' && payload.initialBalance < 0) {
      error.value = 'Outstanding amount cannot be negative.'
      return false
    }
    if (!Number.isFinite(payload.creditLimit) || payload.creditLimit > MAX_AMOUNT) {
      error.value = 'Enter a valid credit limit.'
      return false
    }
    return true
  }

  function init() {
    if (transactionsUnbind) return Promise.resolve()
    if (initPromise) return initPromise

    loading.value = true
    walletsLoading.value = true
    error.value = ''

    const transactionsQuery = query(collection(db, 'transactions'), orderBy('date', 'desc'))
    transactionsUnbind = onSnapshot(
      transactionsQuery,
      (snapshot) => {
        transactions.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        loading.value = false
      },
      (err) => {
        handleError('Loading transactions', err)
        loading.value = false
      }
    )

    const walletsQuery = query(collection(db, 'wallets'), orderBy('createdAt'))
    walletsUnbind = onSnapshot(
      walletsQuery,
      (snapshot) => {
        wallets.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        walletsLoading.value = false
      },
      (err) => {
        handleError('Loading wallets', err)
        walletsLoading.value = false
      }
    )

    initPromise = Promise.resolve()
    return initPromise
  }

  async function addTransaction(payload) {
    error.value = ''
    const transaction = normalizeTransaction(payload)
    if (!validateTransaction(transaction)) return null

    try {
      const ref = await addDoc(collection(db, 'transactions'), {
        ...transaction,
        createdAt: serverTimestamp()
      })
      return ref.id
    } catch (err) {
      handleError('Adding transaction', err)
      return null
    }
  }

  function updateTransaction(id, payload) {
    error.value = ''
    const transaction = normalizeTransaction(payload)
    if (!validateTransaction(transaction)) return Promise.resolve(false)

    return persist(
      updateDoc(doc(db, 'transactions', id), transaction),
      'Updating transaction'
    )
  }

  function removeTransaction(id) {
    return persist(deleteDoc(doc(db, 'transactions', id)), 'Removing transaction')
  }

  async function addWallet(payload) {
    error.value = ''
    const wallet = normalizeWallet(payload)
    if (!validateWallet(wallet)) return null

    try {
      const ref = await addDoc(collection(db, 'wallets'), {
        ...wallet,
        createdAt: serverTimestamp()
      })
      return ref.id
    } catch (err) {
      handleError('Adding wallet', err)
      return null
    }
  }

  function updateWallet(id, payload) {
    error.value = ''
    const wallet = normalizeWallet(payload)
    if (!validateWallet(wallet)) return Promise.resolve(false)

    return persist(updateDoc(doc(db, 'wallets', id), wallet), 'Updating wallet')
  }

  function removeWallet(id) {
    return persist(deleteDoc(doc(db, 'wallets', id)), 'Removing wallet')
  }

  function dispose() {
    if (transactionsUnbind) {
      transactionsUnbind()
      transactionsUnbind = null
    }
    if (walletsUnbind) {
      walletsUnbind()
      walletsUnbind = null
    }
    transactions.value = []
    wallets.value = []
    initPromise = null
    loading.value = false
    walletsLoading.value = false
    error.value = ''
  }

  return {
    transactions,
    wallets,
    walletsWithBalance,
    loading,
    walletsLoading,
    error,
    init,
    addTransaction,
    updateTransaction,
    removeTransaction,
    addWallet,
    updateWallet,
    removeWallet,
    dispose
  }
})
