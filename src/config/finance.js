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
  const list = FINANCE_CATEGORIES[type] || FINANCE_CATEGORIES.expense
  return list.find((item) => item.value === value) || FALLBACK_CATEGORY
}
