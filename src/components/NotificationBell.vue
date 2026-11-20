<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notificationStore'

const store = useNotificationStore()
const router = useRouter()

const root = ref(null)
const trigger = ref(null)
const panel = ref(null)
const open = ref(false)
const panelPosition = ref({})

const recent = computed(() => store.items.slice(0, 8))

const ACTION_META = {
  added: { label: 'added', icon: '➕', tone: 'bg-emerald-100 text-emerald-700' },
  updated: { label: 'updated', icon: '✏️', tone: 'bg-blue-100 text-blue-700' },
  deleted: { label: 'deleted', icon: '🗑️', tone: 'bg-rose-100 text-rose-700' },
}

function actionMeta(action) {
  return ACTION_META[action] || ACTION_META.updated
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
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${loadCurrency()} ${amount.toLocaleString()}`
  }
}

function timeAgo(value) {
  const timestamp = Number(value) || 0
  if (!timestamp) return 'just now'
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 45) return 'just now'
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`
  return `${Math.round(seconds / 86400)}d ago`
}

function toggle() {
  if (!open.value) updatePanelPosition()
  open.value = !open.value
}

function close() {
  open.value = false
}

function updatePanelPosition() {
  const bounds = trigger.value?.getBoundingClientRect()
  if (!bounds) return

  const panelWidth = Math.min(320, window.innerWidth - 32)
  const right = Math.max(
    16,
    Math.min(window.innerWidth - bounds.right, window.innerWidth - panelWidth - 16),
  )
  const top = Math.max(16, Math.min(bounds.bottom + 8, window.innerHeight - 220))
  panelPosition.value = {
    '--panel-top': `${top}px`,
    '--panel-right': `${right}px`,
  }
}

function openFinance() {
  close()
  router.push({ name: 'finance' })
}

function handleOutsideClick(event) {
  if (!open.value) return
  if (root.value?.contains(event.target) || panel.value?.contains(event.target)) return
  close()
}

function handleKeydown(event) {
  if (event.key === 'Escape') close()
}

watch(open, (value) => {
  if (value) store.markAllRead()
})

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', updatePanelPosition)
  window.addEventListener('scroll', updatePanelPosition, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', updatePanelPosition)
  window.removeEventListener('scroll', updatePanelPosition, true)
})
</script>

<template>
  <div ref="root" class="relative">
    <button
      ref="trigger"
      type="button"
      class="relative flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm transition-all hover:border-blue-200 hover:text-blue-600 active:scale-95"
      :aria-label="`Finance notifications${store.unreadCount ? ` (${store.unreadCount} unread)` : ''}`"
      aria-controls="finance-notification-panel"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="toggle"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0"
        />
      </svg>
      <span
        v-if="store.unreadCount"
        class="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-red-500 px-1 text-[10px] font-bold text-white shadow-sm"
      >
        {{ store.unreadCount > 9 ? '9+' : store.unreadCount }}
      </span>
    </button>

    <Teleport to="body">
      <Transition name="panel">
        <div
          v-if="open"
          class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/30 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pointer-events-none sm:items-start sm:justify-end sm:bg-transparent sm:p-0"
          @click.self="close"
        >
          <section
            id="finance-notification-panel"
            ref="panel"
            role="dialog"
            aria-label="Finance activity"
            :style="panelPosition"
            class="pointer-events-auto flex h-full max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-xl shadow-blue-900/10 sm:fixed sm:top-[var(--panel-top)] sm:right-[var(--panel-right)] sm:h-auto sm:max-h-[calc(100dvh-var(--panel-top)-1rem)] sm:w-80 sm:max-w-none"
          >
            <div
              class="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3"
            >
              <div>
                <p class="text-sm font-bold text-gray-800">Finance activity</p>
                <p class="text-[11px] text-gray-400">Updates from other family members</p>
              </div>
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Live" />
            </div>

            <div class="shrink-0 border-b border-gray-100 px-4 py-2.5">
              <button
                v-if="store.supported && store.permission === 'default'"
                type="button"
                class="w-full rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-blue-200/70 transition-all hover:opacity-90 active:scale-95"
                @click="store.requestPermission()"
              >
                🔔 Enable browser notifications
              </button>
              <div
                v-if="store.supported && store.permission === 'default'"
                class="mt-2 text-[11px] font-medium text-gray-500"
              >
                Allow alerts when this app is in the background.
              </div>
              <div
                v-else-if="store.supported && store.permission === 'granted'"
                class="flex items-center gap-2 text-[11px] font-semibold text-emerald-600"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Browser notifications are enabled.
              </div>
              <p
                v-else-if="store.supported && store.permission === 'denied'"
                class="text-[11px] font-medium text-amber-600"
              >
                Notifications are blocked. Allow them in your browser's site settings.
              </p>
              <p v-else class="text-[11px] font-medium text-gray-400">
                This browser does not support notifications.
              </p>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <p
                v-if="!recent.length"
                class="px-4 py-6 text-center text-xs font-medium text-gray-400"
              >
                No finance activity yet.
              </p>
              <button
                v-for="entry in recent"
                :key="entry.id"
                type="button"
                class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50/60"
                @click="openFinance"
              >
                <span
                  class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
                  :class="actionMeta(entry.action).tone"
                >
                  {{ actionMeta(entry.action).icon }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-xs font-bold text-gray-700">
                    {{ entry.actorName || 'A family member' }}
                    {{ actionMeta(entry.action).label }} a transaction
                  </span>
                  <span class="mt-0.5 block truncate text-[11px] font-medium text-gray-500">
                    {{ entry.categoryLabel || entry.category }}
                    <span v-if="entry.walletName">· {{ entry.walletName }}</span>
                  </span>
                  <span class="mt-0.5 flex items-center gap-2 text-[10px] text-gray-400">
                    <span
                      class="font-bold tabular-nums"
                      :class="entry.type === 'income' ? 'text-emerald-600' : 'text-rose-500'"
                    >
                      {{ entry.type === 'income' ? '+' : '−' }}{{ formatMoney(entry.amount) }}
                    </span>
                    <span>·</span>
                    <span>{{ timeAgo(entry.at) }}</span>
                  </span>
                </span>
              </button>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.panel-enter-active,
.panel-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>
