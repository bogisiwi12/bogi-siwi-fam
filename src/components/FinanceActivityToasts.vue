<script setup>
import { useNotificationStore } from '@/stores/notificationStore'
import { categoryMeta } from '@/config/finance'

const store = useNotificationStore()

const ACTION_META = {
  added: { label: 'added', icon: '➕', tone: 'emerald' },
  updated: { label: 'updated', icon: '✏️', tone: 'blue' },
  deleted: { label: 'deleted', icon: '🗑️', tone: 'rose' }
}

const TONE_CLASS = {
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  blue: 'border-blue-100 bg-blue-50 text-blue-700',
  rose: 'border-rose-100 bg-rose-50 text-rose-700'
}

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
      currency: loadCurrency(),
      maximumFractionDigits: 0
    }).format(amount)
  } catch {
    return `${loadCurrency()} ${amount.toLocaleString()}`
  }
}

function actionMeta(action) {
  return ACTION_META[action] || ACTION_META.updated
}

function categoryIcon(toast) {
  return categoryMeta(toast.type, toast.category).icon || '💸'
}
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-stretch gap-2 px-4 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-full lg:max-w-sm lg:items-end"
      role="status"
      aria-live="polite"
    >
      <TransitionGroup name="toast">
        <div
          v-for="toast in store.toasts"
          :key="toast.id"
          class="pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-white/70 bg-white/95 p-3 shadow-xl shadow-blue-900/10 backdrop-blur"
        >
          <span
            class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
            :class="TONE_CLASS[actionMeta(toast.action).tone]"
          >
            {{ categoryIcon(toast) }}
          </span>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-bold text-gray-800">
              {{ toast.actorName || 'A family member' }}
              {{ actionMeta(toast.action).label }} a transaction
            </p>
            <p class="mt-0.5 truncate text-xs font-medium text-gray-500">
              {{ toast.categoryLabel || toast.category }}
              <span v-if="toast.walletName">· {{ toast.walletName }}</span>
            </p>
            <p
              class="mt-1 text-sm font-extrabold tabular-nums"
              :class="toast.type === 'income' ? 'text-emerald-600' : 'text-rose-500'"
            >
              {{ toast.type === 'income' ? '+' : '−' }}{{ formatMoney(toast.amount) }}
            </p>
          </div>

          <button
            type="button"
            title="Dismiss"
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:scale-90"
            @click="store.dismissToast(toast.id)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.97);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(24px) scale(0.97);
}
</style>
