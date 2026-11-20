import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  limitToLast,
  onValue,
  push,
  query,
  ref as databaseRef,
  remove,
  serverTimestamp,
  set
} from 'firebase/database'
import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { app, rtdb } from '@/firebase/config'

const MAX_HISTORY = 50
const MAX_TOASTS = 3
const TOAST_TTL = 8000
const PUSH_TOKEN_STORAGE_KEY = 'finance-push-token'
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

const browserSupported = typeof window !== 'undefined' && 'Notification' in window

export const useNotificationStore = defineStore('notifications', () => {
  const items = ref([])
  const toasts = ref([])
  const loading = ref(false)
  const error = ref('')
  const unreadCount = ref(0)
  const supported = ref(browserSupported)
  const permission = ref(browserSupported ? Notification.permission : 'unsupported')
  const pushSupported = ref(browserSupported)
  const pushRegistered = ref(false)
  const pushBusy = ref(false)
  const pushError = ref('')

  let unbind = null
  let currentUid = ''
  let initialized = false
  let messagingPromise = null
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
    if (pushRegistered.value) return
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

  async function getMessagingInstance() {
    if (messagingPromise) return messagingPromise

    messagingPromise = (async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null

      try {
        if (!(await isSupported())) return null
        return getMessaging(app)
      } catch (err) {
        console.error('Firebase Messaging is not supported:', err)
        return null
      }
    })()

    return messagingPromise
  }

  async function savePushToken(uid, token) {
    let previousToken = ''
    try {
      previousToken = localStorage.getItem(PUSH_TOKEN_STORAGE_KEY) || ''
    } catch {
      /* storage may be unavailable */
    }

    await set(databaseRef(rtdb, `pushTokens/${uid}/${token}`), {
      token,
      uid,
      ua: navigator.userAgent.slice(0, 200),
      platform: (navigator.platform || '').slice(0, 60),
      createdAt: Date.now(),
      updatedAt: Date.now()
    })

    if (previousToken && previousToken !== token) {
      try {
        await remove(databaseRef(rtdb, `pushTokens/${uid}/${previousToken}`))
      } catch (err) {
        console.error('Removing rotated push token failed:', err)
      }
    }

    try {
      localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token)
    } catch {
      /* storage may be unavailable */
    }
  }

  async function registerPushToken(uid, { silent = false } = {}) {
    if (!uid) return false

    if (!silent) {
      pushBusy.value = true
      pushError.value = ''
    }

    try {
      const messaging = await getMessagingInstance()
      if (!messaging) {
        pushSupported.value = false
        if (!silent) pushError.value = 'This browser does not support background push notifications.'
        return false
      }

      pushSupported.value = true

      if (permission.value !== 'granted') {
        if (silent) return false
        const result = await requestPermission()
        if (result !== 'granted') {
          pushError.value = 'Notification permission was not granted.'
          return false
        }
      }

      if (!VAPID_KEY) {
        if (!silent) pushError.value = 'Missing VAPID key (VITE_FIREBASE_VAPID_KEY).'
        return false
      }

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
      await navigator.serviceWorker.ready

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
      })

      if (!token) {
        if (!silent) pushError.value = 'Could not obtain a push token from Firebase.'
        return false
      }

      await savePushToken(uid, token)
      pushRegistered.value = true
      return true
    } catch (err) {
      console.error('Registering background push failed:', err)
      if (!silent) pushError.value = err?.message || 'Could not enable background push notifications.'
      return false
    } finally {
      if (!silent) pushBusy.value = false
    }
  }

  async function enablePush(uid) {
    return registerPushToken(uid || currentUid)
  }

  async function disablePush(uid) {
    const owner = uid || currentUid
    let token = ''

    try {
      token = localStorage.getItem(PUSH_TOKEN_STORAGE_KEY) || ''
    } catch {
      /* storage may be unavailable */
    }

    if (owner && token) {
      try {
        await remove(databaseRef(rtdb, `pushTokens/${owner}/${token}`))
      } catch (err) {
        console.error('Removing push token failed:', err)
      }
    }

    try {
      localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY)
    } catch {
      /* storage may be unavailable */
    }

    pushRegistered.value = false
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

    if (permission.value === 'granted') {
      void registerPushToken(actor.uid, { silent: true })
    }
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
    pushError.value = ''
    pushBusy.value = false
  }

  return {
    items,
    toasts,
    loading,
    error,
    unreadCount,
    supported,
    permission,
    pushSupported,
    pushRegistered,
    pushBusy,
    pushError,
    publish,
    subscribe,
    unsubscribe,
    dismissToast,
    markAllRead,
    requestPermission,
    enablePush,
    disablePush
  }
})
