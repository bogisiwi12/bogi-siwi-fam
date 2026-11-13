import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'
import { db } from '@/firebase/config'

const TRIP_STATUSES = ['planning', 'confirmed', 'completed']
const ACTIVITY_CATEGORIES = [
  'sightseeing',
  'food',
  'transport',
  'stay',
  'adventure',
  'shopping',
  'other'
]

const toText = (value) => (typeof value === 'string' ? value.trim() : '')

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeTrip(payload) {
  return {
    title: toText(payload.title).slice(0, 100),
    destination: toText(payload.destination).slice(0, 120),
    startDate: toText(payload.startDate),
    endDate: toText(payload.endDate),
    travelers: Math.min(50, Math.max(1, Math.round(toNumber(payload.travelers, 1)))),
    budget: Math.max(0, toNumber(payload.budget, 0)),
    currency: toText(payload.currency).slice(0, 8) || 'USD',
    status: TRIP_STATUSES.includes(payload.status) ? payload.status : 'planning',
    cover: toText(payload.cover).slice(0, 10) || '✈️',
    notes: toText(payload.notes).slice(0, 1000)
  }
}

function normalizeDay(payload) {
  return {
    date: toText(payload.date),
    title: toText(payload.title).slice(0, 100)
  }
}

function normalizeActivity(payload) {
  return {
    time: toText(payload.time).slice(0, 10),
    title: toText(payload.title).slice(0, 120),
    location: toText(payload.location).slice(0, 120),
    category: ACTIVITY_CATEGORIES.includes(payload.category) ? payload.category : 'other',
    cost: Math.max(0, toNumber(payload.cost, 0)),
    notes: toText(payload.notes).slice(0, 300)
  }
}

export const useHolidayStore = defineStore('holiday', () => {
  const trips = ref([])
  const days = ref([])
  const activitiesByDay = ref({})

  const loading = ref(false)
  const error = ref('')

  let tripsUnbind = null
  let daysUnbind = null
  let initPromise = null
  let activeTripId = null
  const dayUnbinders = new Map()

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

  function init() {
    if (tripsUnbind) return Promise.resolve()
    if (initPromise) return initPromise

    loading.value = true
    initPromise = new Promise((resolve) => {
      const q = query(collection(db, 'itineraries'), orderBy('startDate'))
      tripsUnbind = onSnapshot(
        q,
        (snapshot) => {
          trips.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
          loading.value = false
          resolve()
        },
        (err) => {
          handleError('Loading trips', err)
          loading.value = false
          resolve()
        }
      )
    })

    return initPromise
  }

  function bindDayActivities(tripId, dayId) {
    if (dayUnbinders.has(dayId)) return
    const q = query(
      collection(db, 'itineraries', tripId, 'days', dayId, 'activities'),
      orderBy('time')
    )
    const unbind = onSnapshot(
      q,
      (snapshot) => {
        activitiesByDay.value = {
          ...activitiesByDay.value,
          [dayId]: snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        }
      },
      (err) => handleError('Loading activities', err)
    )
    dayUnbinders.set(dayId, unbind)
  }

  function syncDayBindings(tripId, dayDocs) {
    const current = new Set(dayDocs.map((d) => d.id))

    for (const [dayId, unbind] of dayUnbinders) {
      if (current.has(dayId)) continue
      unbind()
      dayUnbinders.delete(dayId)
      const next = { ...activitiesByDay.value }
      delete next[dayId]
      activitiesByDay.value = next
    }

    for (const dayDoc of dayDocs) bindDayActivities(tripId, dayDoc.id)
  }

  function watchTrip(tripId) {
    clearTrip()
    if (!tripId) return

    activeTripId = tripId
    const q = query(collection(db, 'itineraries', tripId, 'days'), orderBy('date'))
    daysUnbind = onSnapshot(
      q,
      (snapshot) => {
        days.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        syncDayBindings(tripId, days.value)
      },
      (err) => handleError('Loading trip days', err)
    )
  }

  function clearTrip() {
    if (daysUnbind) {
      daysUnbind()
      daysUnbind = null
    }
    for (const unbind of dayUnbinders.values()) unbind()
    dayUnbinders.clear()
    days.value = []
    activitiesByDay.value = {}
    activeTripId = null
  }

  async function addTrip(payload) {
    error.value = ''
    try {
      const ref = await addDoc(collection(db, 'itineraries'), {
        ...normalizeTrip(payload),
        createdAt: serverTimestamp()
      })
      return ref.id
    } catch (err) {
      handleError('Creating trip', err)
      return null
    }
  }

  function updateTrip(id, payload) {
    return persist(
      updateDoc(doc(db, 'itineraries', id), normalizeTrip(payload)),
      'Updating trip'
    )
  }

  async function removeTrip(id) {
    error.value = ''
    try {
      const daysSnap = await getDocs(collection(db, 'itineraries', id, 'days'))
      for (const dayDoc of daysSnap.docs) {
        const activitiesSnap = await getDocs(
          collection(db, 'itineraries', id, 'days', dayDoc.id, 'activities')
        )
        const batch = writeBatch(db)
        activitiesSnap.docs.forEach((activity) => batch.delete(activity.ref))
        batch.delete(dayDoc.ref)
        await batch.commit()
      }
      await deleteDoc(doc(db, 'itineraries', id))
      if (activeTripId === id) clearTrip()
      return true
    } catch (err) {
      handleError('Deleting trip', err)
      return false
    }
  }

  async function addDay(tripId, payload) {
    error.value = ''
    try {
      const ref = await addDoc(collection(db, 'itineraries', tripId, 'days'), {
        ...normalizeDay(payload),
        createdAt: serverTimestamp()
      })
      return ref.id
    } catch (err) {
      handleError('Adding day', err)
      return null
    }
  }

  function updateDay(tripId, dayId, payload) {
    return persist(
      updateDoc(doc(db, 'itineraries', tripId, 'days', dayId), normalizeDay(payload)),
      'Updating day'
    )
  }

  async function removeDay(tripId, dayId) {
    error.value = ''
    try {
      const activitiesSnap = await getDocs(
        collection(db, 'itineraries', tripId, 'days', dayId, 'activities')
      )
      const batch = writeBatch(db)
      activitiesSnap.docs.forEach((activity) => batch.delete(activity.ref))
      batch.delete(doc(db, 'itineraries', tripId, 'days', dayId))
      await batch.commit()
      return true
    } catch (err) {
      handleError('Deleting day', err)
      return false
    }
  }

  async function addActivity(tripId, dayId, payload) {
    error.value = ''
    try {
      const ref = await addDoc(
        collection(db, 'itineraries', tripId, 'days', dayId, 'activities'),
        {
          ...normalizeActivity(payload),
          createdAt: serverTimestamp()
        }
      )
      return ref.id
    } catch (err) {
      handleError('Adding activity', err)
      return null
    }
  }

  function updateActivity(tripId, dayId, activityId, payload) {
    return persist(
      updateDoc(
        doc(db, 'itineraries', tripId, 'days', dayId, 'activities', activityId),
        normalizeActivity(payload)
      ),
      'Updating activity'
    )
  }

  function removeActivity(tripId, dayId, activityId) {
    return persist(
      deleteDoc(doc(db, 'itineraries', tripId, 'days', dayId, 'activities', activityId)),
      'Removing activity'
    )
  }

  function dispose() {
    if (tripsUnbind) {
      tripsUnbind()
      tripsUnbind = null
    }
    clearTrip()
    trips.value = []
    initPromise = null
    loading.value = false
    error.value = ''
  }

  return {
    trips,
    days,
    activitiesByDay,
    loading,
    error,
    init,
    dispose,
    watchTrip,
    clearTrip,
    addTrip,
    updateTrip,
    removeTrip,
    addDay,
    updateDay,
    removeDay,
    addActivity,
    updateActivity,
    removeActivity
  }
})
