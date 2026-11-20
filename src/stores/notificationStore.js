import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  limitToLast,
  onValue,
  push,
  query,
  ref as databaseRef,
  serverTimestamp
} from 'firebase/database'
import { rtdb } from '@/firebase/config'

const MAX_HISTORY = 50
const MAX_TOASTS = 3
const TOAST_TTL = 8000

const browserSupported = typeof window !== 'undefined' && 'Notification' in window

export const useNotificationStore = defineStore('notifications', () => {
  const items = ref([])
  const toasts = ref([])
  const loading = ref(false)
  const error = ref('')
  const unreadCount = ref(0)
  const supported = ref(browserSupported)
  const permission = ref(browserSupported ? Notification.permission : 'unsupported')

  let unbind = null
  let currentUid = ''
  let initialized = false
  const timers = new Map()

  function dismissToast(id) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
  }

  function showToast(entry) {
    if (toasts.value.some((toast) => toast.id === entry.id)) return

    toasts.value = [...toasts.value, entry].slice(-MAX_TOASTS)
    const timer = setTimeout(() => dismissToast(entry.id), TOAST_TTL)
    timers.set(entry.id, timer)
  }

  function showSystemNotification(entry) {
    if (!browserSupported || permission.value !== 'granted') return
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return

    const actionLabels = { added: 'added', updated: 'updated', deleted: 'deleted' }
    const action = actionLabels[entry.action] || 'changed'
    const amount = Number(entry.amount) || 0
    const sign = entry.type === 'income' ? '+' : '-'

    try {
      const notification = new Notification(
        `${entry.actorName || 'A family member'} ${action} a transaction`,
        {
          body: `${entry.categoryLabel || entry.category || 'Transaction'} · ${sign}${amount.toLocaleString()}${
            entry.walletName ? ` · ${entry.walletName}` : ''
          }`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: entry.id
        }
      )
      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    } catch (err) {
      console.error('Showing browser notification failed:', err)
    }
  }

  function markAllRead() {
    unreadCount.value = 0
  }

  async function requestPermission() {
    if (!browserSupported) return 'unsupported'

    try {
      const result = await Notification.requestPermission()
      permission.value = result
      return result
    } catch (err) {
      console.error('Requesting notification permission failed:', err)
      return permission.value
    }
  }

  async function publish(activity) {
    if (!activity?.actorId) return false

    try {
      await push(databaseRef(rtdb, 'notifications'), {
        ...activity,
        at: serverTimestamp()
      })
      return true
    } catch (err) {
      console.error('Publishing finance activity failed:', err)
      return false
    }
  }

  function subscribe(actor) {
    if (!actor?.uid) return
    if (unbind && currentUid === actor.uid) return

    unsubscribe()
    currentUid = actor.uid
    initialized = false
    loading.value = true
    error.value = ''

    const feedQuery = query(databaseRef(rtdb, 'notifications'), limitToLast(MAX_HISTORY))

    unbind = onValue(
      feedQuery,
      (snapshot) => {
        const next = []
        snapshot.forEach((child) => {
          next.push({ id: child.key, ...child.val() })
        })
        next.sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0))

        const previousIds = new Set(items.value.map((item) => item.id))
        items.value = next
        loading.value = false

        if (!initialized) {
          initialized = true
          return
        }

        for (const entry of next) {
          if (previousIds.has(entry.id)) continue
          if (entry.actorId === currentUid) continue
          if (entry.kind !== 'finance') continue
          unreadCount.value += 1
          showToast(entry)
          showSystemNotification(entry)
        }
      },
      (err) => {
        console.error('Finance activity subscription failed:', err)
        error.value = err?.message || 'Could not listen for finance notifications.'
        loading.value = false
      }
    )
  }

  function unsubscribe() {
    if (unbind) {
      unbind()
      unbind = null
    }
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    toasts.value = []
    items.value = []
    unreadCount.value = 0
    currentUid = ''
    initialized = false
    loading.value = false
    error.value = ''
  }

  return {
    items,
    toasts,
    loading,
    error,
    unreadCount,
    supported,
    permission,
    publish,
    subscribe,
    unsubscribe,
    dismissToast,
    markAllRead,
    requestPermission
  }
})
