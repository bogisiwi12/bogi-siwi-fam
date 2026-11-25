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
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import {
  FINANCE_TYPES,
  FINANCE_ENTRY_TYPES,
  WALLET_TYPES,
  TRANSFER_CATEGORY,
  ADMIN_FEE_CATEGORY,
  BORROWED_ADMIN_FEE_CATEGORY,
  categoryMeta
} from '@/config/finance'

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
    walletId: toText(payload.walletId).slice(0, 128),
    entryId: toText(payload.entryId).slice(0, 128)
  }
}

function normalizeEntry(payload) {
  return {
    type: FINANCE_ENTRY_TYPES.some((item) => item.value === payload.type)
      ? payload.type
      : 'goal',
    name: toText(payload.name).slice(0, 80),
    amount: Math.round(toNumber(payload.amount, 0) * 100) / 100,
    note: toText(payload.note).slice(0, 300)
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
  const auth = useAuthStore()
  const notifications = useNotificationStore()
  const transactions = ref([])
  const wallets = ref([])
  const entries = ref([])
  const loading = ref(false)
  const walletsLoading = ref(false)
  const entriesLoading = ref(false)
  const error = ref('')

  let transactionsUnbind = null
  let walletsUnbind = null
  let entriesUnbind = null
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
        const outstandingAmount = Math.max(0, initialBalance + expense - income)
        return {
          ...wallet,
          income,
          expense,
          creditLimit,
          outstandingAmount,
          availableCredit: Math.max(0, creditLimit - outstandingAmount),
          balance: -outstandingAmount
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

  function publishActivity(action, transaction) {
    if (!auth.user?.uid || !transaction) return

    const wallet = wallets.value.find((item) => item.id === transaction.walletId)
    const category = categoryMeta(transaction.type, transaction.category)

    void notifications.publish({
      kind: 'finance',
      action,
      actorId: auth.user.uid,
      actorName: (auth.displayName || 'A family member').slice(0, 60),
      transactionId: (transaction.id || '').slice(0, 128),
      type: transaction.type,
      amount: Math.max(0, Number(transaction.amount) || 0),
      category: (transaction.category || '').slice(0, 40),
      categoryLabel: category.label.slice(0, 60),
      walletName: (wallet?.name || '').slice(0, 60)
    })
  }

  function applyLocalTransaction(record) {
    const existing = transactions.value.find((item) => item.id === record.id)
    const merged = { ...existing, ...record }
    transactions.value = [
      merged,
      ...transactions.value.filter((item) => item.id !== record.id)
    ].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }

  function removeLocalTransaction(id) {
    transactions.value = transactions.value.filter((item) => item.id !== id)
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

  function validateEntry(payload) {
    if (!FINANCE_ENTRY_TYPES.some((item) => item.value === payload.type)) {
      error.value = 'Choose a valid entry type.'
      return false
    }
    if (!payload.name) {
      error.value = 'Enter a name.'
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
    return true
  }

  function init() {
    if (transactionsUnbind) return Promise.resolve()
    if (initPromise) return initPromise

    loading.value = true
    walletsLoading.value = true
    entriesLoading.value = true
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

    const entriesQuery = query(collection(db, 'financeEntries'), orderBy('createdAt'))
    entriesUnbind = onSnapshot(
      entriesQuery,
      (snapshot) => {
        entries.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        entriesLoading.value = false
      },
      (err) => {
        handleError('Loading finance entries', err)
        entriesLoading.value = false
      }
    )

    initPromise = Promise.resolve()
    return initPromise
  }

  async function addTransaction(payload) {
    error.value = ''
    const transaction = normalizeTransaction(payload)
    if (!validateTransaction(transaction)) return null

    const adminFee = Math.max(0, Math.round(toNumber(payload.adminFee, 0) * 100) / 100)
    if (adminFee > MAX_AMOUNT) {
      error.value = 'That admin fee is too large.'
      return null
    }
    const linkedEntry = transaction.entryId
      ? entries.value.find((entry) => entry.id === transaction.entryId)
      : null
    const applyAdminFee =
      adminFee > 0 && transaction.type === 'expense' && linkedEntry?.type === 'borrowed'

    try {
      const mainRef = doc(collection(db, 'transactions'))
      const batch = writeBatch(db)
      batch.set(mainRef, { ...transaction, createdAt: serverTimestamp() })

      let feeRef = null
      let feeRecord = null
      if (applyAdminFee) {
        feeRecord = {
          type: 'expense',
          amount: adminFee,
          category: BORROWED_ADMIN_FEE_CATEGORY.value,
          date: transaction.date,
          note: transaction.note,
          walletId: transaction.walletId
        }
        feeRef = doc(collection(db, 'transactions'))
        batch.set(feeRef, { ...feeRecord, createdAt: serverTimestamp() })
      }

      await batch.commit()
      applyLocalTransaction({ ...transaction, id: mainRef.id })
      publishActivity('added', { ...transaction, id: mainRef.id })
      if (feeRef && feeRecord) {
        applyLocalTransaction({ ...feeRecord, id: feeRef.id })
        publishActivity('added', { ...feeRecord, id: feeRef.id })
      }
      return mainRef.id
    } catch (err) {
      handleError('Adding transaction', err)
      return null
    }
  }

  async function updateTransaction(id, payload) {
    error.value = ''
    const transaction = normalizeTransaction(payload)
    if (!validateTransaction(transaction)) return false

    const ok = await persist(
      updateDoc(doc(db, 'transactions', id), transaction),
      'Updating transaction'
    )
    if (ok) {
      applyLocalTransaction({ ...transaction, id })
      publishActivity('updated', { ...transaction, id })
    }
    return ok
  }

  async function removeTransaction(id) {
    const transaction = transactions.value.find((item) => item.id === id)
    const ok = await persist(deleteDoc(doc(db, 'transactions', id)), 'Removing transaction')
    if (ok) {
      removeLocalTransaction(id)
      publishActivity('deleted', transaction)
    }
    return ok
  }

  async function transferBalance(payload) {
    error.value = ''
    const fromWalletId = toText(payload.fromWalletId).slice(0, 128)
    const toWalletId = toText(payload.toWalletId).slice(0, 128)
    const amount = Math.round(toNumber(payload.amount, 0) * 100) / 100
    const fee = Math.max(0, Math.round(toNumber(payload.fee, 0) * 100) / 100)
    const date = toText(payload.date).slice(0, 10)
    const note = toText(payload.note).slice(0, 300)

    if (!fromWalletId || !toWalletId) {
      error.value = 'Choose both the source and destination wallet.'
      return false
    }
    if (fromWalletId === toWalletId) {
      error.value = 'Choose two different wallets.'
      return false
    }
    if (!(amount > 0)) {
      error.value = 'Enter an amount greater than zero.'
      return false
    }
    if (amount > MAX_AMOUNT) {
      error.value = 'That amount is too large.'
      return false
    }
    if (!Number.isFinite(fee) || fee > MAX_AMOUNT) {
      error.value = 'Enter a valid admin fee.'
      return false
    }
    if (!ISO_DATE.test(date)) {
      error.value = 'Choose a valid date.'
      return false
    }

    const records = []
    const batch = writeBatch(db)
    const stage = (type, value, category) => {
      const transaction = {
        type,
        amount: value,
        category,
        date,
        note,
        walletId: type === 'expense' ? fromWalletId : toWalletId
      }
      const ref = doc(collection(db, 'transactions'))
      batch.set(ref, { ...transaction, createdAt: serverTimestamp() })
      records.push({ ...transaction, id: ref.id })
    }

    stage('expense', amount, TRANSFER_CATEGORY.value)
    stage('income', amount, TRANSFER_CATEGORY.value)
    if (fee > 0) stage('expense', fee, ADMIN_FEE_CATEGORY.value)

    try {
      await batch.commit()
      records.forEach((record) => {
        applyLocalTransaction(record)
        publishActivity('added', record)
      })
      return true
    } catch (err) {
      handleError('Transferring balance', err)
      return false
    }
  }

  async function addEntry(payload) {
    error.value = ''
    const entry = normalizeEntry(payload)
    if (!validateEntry(entry)) return null

    try {
      const ref = await addDoc(collection(db, 'financeEntries'), {
        ...entry,
        createdAt: serverTimestamp()
      })
      return ref.id
    } catch (err) {
      handleError('Adding finance entry', err)
      return null
    }
  }

  function updateEntry(id, payload) {
    error.value = ''
    const entry = normalizeEntry(payload)
    if (!validateEntry(entry)) return Promise.resolve(false)

    return persist(updateDoc(doc(db, 'financeEntries', id), entry), 'Updating finance entry')
  }

  function removeEntry(id) {
    return persist(deleteDoc(doc(db, 'financeEntries', id)), 'Removing finance entry')
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
    if (entriesUnbind) {
      entriesUnbind()
      entriesUnbind = null
    }
    transactions.value = []
    wallets.value = []
    entries.value = []
    initPromise = null
    loading.value = false
    walletsLoading.value = false
    entriesLoading.value = false
    error.value = ''
  }

  return {
    transactions,
    wallets,
    entries,
    walletsWithBalance,
    loading,
    walletsLoading,
    entriesLoading,
    error,
    init,
    addTransaction,
    updateTransaction,
    removeTransaction,
    transferBalance,
    addEntry,
    updateEntry,
    removeEntry,
    addWallet,
    updateWallet,
    removeWallet,
    dispose
  }
})
