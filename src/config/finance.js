export const FINANCE_TYPES = ['income', 'expense']

export const CURRENCIES = ['IDR', 'USD', 'EUR', 'GBP', 'SGD', 'MYR', 'AUD', 'JPY']

export const WALLET_TYPES = [
  { value: 'cash', label: 'Cash', icon: '💵', class: 'bg-emerald-100 text-emerald-700' },
  { value: 'bank', label: 'Bank Account', icon: '🏦', class: 'bg-blue-100 text-blue-700' },
  { value: 'ewallet', label: 'E-Wallet', icon: '📱', class: 'bg-violet-100 text-violet-700' },
  { value: 'savings', label: 'Savings', icon: '🏆', class: 'bg-amber-100 text-amber-700' },
  { value: 'credit', label: 'Credit Card', icon: '💳', class: 'bg-rose-100 text-rose-700' },
  { value: 'other', label: 'Other', icon: '👛', class: 'bg-gray-100 text-gray-600' }
]

export const CREDIT_CARD_PAYMENT_CATEGORY = {
  value: 'outstanding-payment',
  label: 'Outstanding amount payment',
  icon: '💳',
  class: 'bg-rose-100 text-rose-700'
}

export const TRANSFER_CATEGORY = {
  value: 'transfer',
  label: 'Wallet transfer',
  icon: '🔄',
  class: 'bg-sky-100 text-sky-700'
}

export const ADMIN_FEE_CATEGORY = {
  value: 'admin-fee',
  label: 'Transfer admin fee',
  icon: '🧾',
  class: 'bg-gray-100 text-gray-600'
}

export const BORROWED_ADMIN_FEE_CATEGORY = {
  value: 'borrowed-admin-fee',
  label: 'Borrowed admin fee',
  icon: '🧾',
  class: 'bg-gray-100 text-gray-600'
}

export const FINANCE_ENTRY_TYPES = [
  {
    value: 'goal',
    label: 'Goal',
    plural: 'Goals',
    icon: '🎯',
    class: 'bg-indigo-100 text-indigo-700',
    bar: 'from-indigo-500 to-violet-400'
  },
  {
    value: 'borrowed',
    label: 'Borrowed',
    plural: 'Borrowed',
    icon: '📥',
    class: 'bg-rose-100 text-rose-700',
    bar: 'from-rose-500 to-orange-400'
  },
  {
    value: 'lent',
    label: 'Lent',
    plural: 'Lent',
    icon: '📤',
    class: 'bg-emerald-100 text-emerald-700',
    bar: 'from-emerald-500 to-teal-400'
  }
]

const FALLBACK_ENTRY_TYPE = FINANCE_ENTRY_TYPES[0]

export function entryTypeMeta(value) {
  return FINANCE_ENTRY_TYPES.find((item) => item.value === value) || FALLBACK_ENTRY_TYPE
}

const FALLBACK_WALLET = WALLET_TYPES[WALLET_TYPES.length - 1]

export function walletMeta(value) {
  return WALLET_TYPES.find((item) => item.value === value) || FALLBACK_WALLET
}

export const FINANCE_CATEGORIES = {
  income: [
    { value: 'salary', label: 'Salary', icon: '💼', class: 'bg-emerald-100 text-emerald-700' },
    { value: 'business', label: 'Business', icon: '🏢', class: 'bg-teal-100 text-teal-700' },
    { value: 'freelance', label: 'Freelance', icon: '💻', class: 'bg-sky-100 text-sky-700' },
    { value: 'investment', label: 'Investment', icon: '📈', class: 'bg-indigo-100 text-indigo-700' },
    { value: 'gift', label: 'Gift', icon: '🎁', class: 'bg-pink-100 text-pink-700' },
    { value: 'allowance', label: 'Allowance', icon: '💰', class: 'bg-lime-100 text-lime-700' },
    { value: 'other-income', label: 'Other', icon: '📌', class: 'bg-gray-100 text-gray-600' }
  ],
  expense: [
    { value: 'food', label: 'Food & Dining', icon: '🍽️', class: 'bg-orange-100 text-orange-700' },
    { value: 'groceries', label: 'Groceries', icon: '🛒', class: 'bg-amber-100 text-amber-700' },
    { value: 'transport', label: 'Transport', icon: '🚗', class: 'bg-violet-100 text-violet-700' },
    { value: 'housing', label: 'Housing', icon: '🏠', class: 'bg-blue-100 text-blue-700' },
    { value: 'utilities', label: 'Utilities', icon: '💡', class: 'bg-yellow-100 text-yellow-700' },
    { value: 'health', label: 'Health', icon: '🏥', class: 'bg-rose-100 text-rose-700' },
    { value: 'education', label: 'Education', icon: '🎓', class: 'bg-cyan-100 text-cyan-700' },
    { value: 'shopping', label: 'Shopping', icon: '🛍️', class: 'bg-pink-100 text-pink-700' },
    { value: 'entertainment', label: 'Entertainment', icon: '🎬', class: 'bg-purple-100 text-purple-700' },
    { value: 'travel', label: 'Travel', icon: '✈️', class: 'bg-sky-100 text-sky-700' },
    { value: 'bills', label: 'Bills', icon: '📄', class: 'bg-slate-100 text-slate-700' },
    { value: 'family', label: 'Family', icon: '👨‍👩‍👧', class: 'bg-emerald-100 text-emerald-700' },
    { value: 'other-expense', label: 'Other', icon: '📌', class: 'bg-gray-100 text-gray-600' }
  ]
}

const FALLBACK_CATEGORY = {
  value: 'other',
  label: 'Other',
  icon: '📌',
  class: 'bg-gray-100 text-gray-600'
}

export function categoryMeta(type, value) {
  if (type === 'income' && value === CREDIT_CARD_PAYMENT_CATEGORY.value) {
    return CREDIT_CARD_PAYMENT_CATEGORY
  }
  if (value === TRANSFER_CATEGORY.value) {
    return TRANSFER_CATEGORY
  }
  if (value === ADMIN_FEE_CATEGORY.value) {
    return ADMIN_FEE_CATEGORY
  }
  if (value === BORROWED_ADMIN_FEE_CATEGORY.value) {
    return BORROWED_ADMIN_FEE_CATEGORY
  }
  const list = FINANCE_CATEGORIES[type] || FINANCE_CATEGORIES.expense
  return list.find((item) => item.value === value) || FALLBACK_CATEGORY
}

export function transactionCreatedAtMs(record) {
  const value = record?.createdAt
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.seconds === 'number') return value.seconds * 1000
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function compareTransactionsByDateAndCreated(a, b) {
  const dateDiff = (b.date || '').localeCompare(a.date || '')
  if (dateDiff) return dateDiff
  return transactionCreatedAtMs(b) - transactionCreatedAtMs(a)
}
