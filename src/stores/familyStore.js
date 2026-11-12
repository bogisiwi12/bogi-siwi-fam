import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '@/firebase/config'

// Default demo data, seeded into Firestore once on first run
const defaultMembers = [
  { id: 'bogi', name: 'Bogi', role: 'Parent', avatar: '👨', color: '#2563eb' },
  { id: 'siwi', name: 'Siwi', role: 'Parent', avatar: '👩', color: '#06b6d4' },
  { id: 'alex', name: 'Alex', role: 'Child', avatar: '👦', color: '#0ea5e9' },
  { id: 'mia', name: 'Mia', role: 'Child', avatar: '👧', color: '#0284c7' }
]

const defaultRules = [
  { id: 'screen-time', title: 'Screen time limit', description: 'Max 2 hours on weekdays', icon: '📱' },
  { id: 'bedtime', title: 'Bedtime', description: 'Lights out by 9:30 PM', icon: '🌙' },
  { id: 'chores-first', title: 'Chores first', description: 'Complete chores before play', icon: '✅' },
  { id: 'family-dinner', title: 'Family dinner', description: 'All together at 7 PM', icon: '🍽️' }
]

const defaultEvents = [
  { id: 'soccer-practice', title: 'Soccer Practice', date: '2026-11-15', time: '16:00', member: 'Alex', color: '#0ea5e9' },
  { id: 'parent-teacher', title: 'Parent-Teacher Meeting', date: '2026-11-18', time: '14:00', member: 'Mia', color: '#06b6d4' },
  { id: 'movie-night', title: 'Family Movie Night', date: '2026-11-20', time: '19:00', member: 'All', color: '#2563eb' },
  { id: 'dentist', title: 'Dentist Appointment', date: '2026-11-22', time: '10:00', member: 'Bogi', color: '#0284c7' }
]

const defaultTasks = [
  { id: 'wash-dishes', title: 'Wash dishes', assignee: 'Alex', done: false, points: 5 },
  { id: 'take-out-trash', title: 'Take out trash', assignee: 'Mia', done: true, points: 3 },
  { id: 'vacuum-living-room', title: 'Vacuum living room', assignee: 'Bogi', done: false, points: 10 },
  { id: 'water-plants', title: 'Water plants', assignee: 'Siwi', done: false, points: 2 },
  { id: 'fold-laundry', title: 'Fold laundry', assignee: 'Alex', done: true, points: 5 }
]

const defaultTransactions = [
  { id: 'grocery-shopping', description: 'Grocery shopping', amount: -120.5, category: 'Food', date: '2026-11-10' },
  { id: 'monthly-allowance', description: 'Monthly allowance', amount: 50, category: 'Income', date: '2026-11-01' },
  { id: 'electricity-bill', description: 'Electricity bill', amount: -85, category: 'Utilities', date: '2026-11-05' },
  { id: 'school-supplies', description: 'School supplies', amount: -45.3, category: 'Education', date: '2026-11-08' }
]

const defaultShoppingItems = [
  { id: 'milk', name: 'Milk', quantity: 2, category: 'Dairy', done: false },
  { id: 'eggs', name: 'Eggs', quantity: 12, category: 'Dairy', done: true },
  { id: 'bread', name: 'Bread', quantity: 1, category: 'Bakery', done: false },
  { id: 'apples', name: 'Apples', quantity: 6, category: 'Produce', done: false },
  { id: 'chicken-breast', name: 'Chicken breast', quantity: 1, category: 'Meat', done: false }
]

const seedData = [
  ['members', defaultMembers],
  ['rules', defaultRules],
  ['events', defaultEvents],
  ['tasks', defaultTasks],
  ['transactions', defaultTransactions],
  ['shoppingItems', defaultShoppingItems]
]

export const useFamilyStore = defineStore('family', () => {
  // --- Family Members & Rules ---
  const members = ref([])
  const rules = ref([])

  // --- Calendar ---
  const events = ref([])

  // --- Tasks & Chores ---
  const tasks = ref([])

  // --- Finance ---
  const transactions = ref([])

  // --- Shopping List ---
  const shoppingList = ref([])

  const loading = ref(false)
  const error = ref('')

  let initPromise = null
  const unbinders = []
  const loaded = new Set()

  // --- Computed ---
  const totalBalance = computed(() =>
    transactions.value.reduce((sum, t) => sum + t.amount, 0)
  )

  const pendingTasks = computed(() =>
    tasks.value.filter(t => !t.done)
  )

  const shoppingProgress = computed(() => {
    const done = shoppingList.value.filter(i => i.done).length
    return { done, total: shoppingList.value.length }
  })

  // --- Real-time Firestore sync ---
  function markLoaded(name) {
    loaded.add(name)
    if (loaded.size >= seedData.length) loading.value = false
  }

  function bindCollection(name, target) {
    const q = query(collection(db, name), orderBy('createdAt'))
    return onSnapshot(
      q,
      (snapshot) => {
        target.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        markLoaded(name)
      },
      (err) => {
        console.error(`Failed to load ${name} from Firestore:`, err)
        error.value = err.message
        markLoaded(name)
      }
    )
  }

  async function seedFamilyDefaults() {
    const metaRef = doc(db, 'family', 'meta')
    const meta = await getDoc(metaRef)
    if (meta.exists()) return

    await Promise.all(
      seedData.flatMap(([name, items]) =>
        items.map(({ id, ...data }) =>
          setDoc(doc(db, name, id), { ...data, createdAt: serverTimestamp() })
        )
      )
    )

    await setDoc(metaRef, { seeded: true, seededAt: serverTimestamp() })
  }

  async function persist(operation, label) {
    error.value = ''
    try {
      await operation
    } catch (err) {
      console.error(`${label} failed:`, err)
      error.value = err.message || `${label} failed.`
    }
  }

  async function init() {
    if (initPromise) return initPromise

    initPromise = (async () => {
      loading.value = true

      try {
        await seedFamilyDefaults()
      } catch (err) {
        console.error('Failed to seed default family data:', err)
      }

      const bindings = [
        ['members', members],
        ['rules', rules],
        ['events', events],
        ['tasks', tasks],
        ['transactions', transactions],
        ['shoppingItems', shoppingList]
      ]

      for (const [name, target] of bindings) {
        unbinders.push(bindCollection(name, target))
      }
    })()

    return initPromise
  }

  function dispose() {
    unbinders.forEach((unbind) => unbind())
    unbinders.length = 0
    loaded.clear()
    initPromise = null
    loading.value = false
    error.value = ''
    members.value = []
    rules.value = []
    events.value = []
    tasks.value = []
    transactions.value = []
    shoppingList.value = []
  }

  // --- Members ---
  function addMember(name, role, avatar = '🙂', color = '#2563eb') {
    return persist(
      addDoc(collection(db, 'members'), {
        name: name.trim(),
        role,
        avatar,
        color,
        createdAt: serverTimestamp()
      }),
      'Adding member'
    )
  }

  function updateMember(id, data) {
    return persist(updateDoc(doc(db, 'members', id), data), 'Updating member')
  }

  function removeMember(id) {
    return persist(deleteDoc(doc(db, 'members', id)), 'Removing member')
  }

  // --- Rules ---
  function addRule(title, description, icon = '📌') {
    return persist(
      addDoc(collection(db, 'rules'), {
        title: title.trim(),
        description: description.trim(),
        icon,
        createdAt: serverTimestamp()
      }),
      'Adding rule'
    )
  }

  function updateRule(id, data) {
    return persist(updateDoc(doc(db, 'rules', id), data), 'Updating rule')
  }

  function removeRule(id) {
    return persist(deleteDoc(doc(db, 'rules', id)), 'Removing rule')
  }

  // --- Events ---
  function addEvent(title, date, time, member, color = '#2563eb') {
    return persist(
      addDoc(collection(db, 'events'), {
        title: title.trim(),
        date,
        time,
        member,
        color,
        createdAt: serverTimestamp()
      }),
      'Adding event'
    )
  }

  function updateEvent(id, data) {
    return persist(updateDoc(doc(db, 'events', id), data), 'Updating event')
  }

  function removeEvent(id) {
    return persist(deleteDoc(doc(db, 'events', id)), 'Removing event')
  }

  // --- Tasks ---
  function addTask(title, assignee, points = 5) {
    return persist(
      addDoc(collection(db, 'tasks'), {
        title: title.trim(),
        assignee,
        done: false,
        points,
        createdAt: serverTimestamp()
      }),
      'Adding task'
    )
  }

  function toggleTask(id) {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return
    return persist(updateDoc(doc(db, 'tasks', id), { done: !task.done }), 'Updating task')
  }

  function updateTask(id, data) {
    return persist(updateDoc(doc(db, 'tasks', id), data), 'Updating task')
  }

  function removeTask(id) {
    return persist(deleteDoc(doc(db, 'tasks', id)), 'Removing task')
  }

  // --- Transactions ---
  function addTransaction(description, amount, category) {
    return persist(
      addDoc(collection(db, 'transactions'), {
        description: description.trim(),
        amount: parseFloat(amount),
        category,
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp()
      }),
      'Adding transaction'
    )
  }

  function updateTransaction(id, data) {
    return persist(updateDoc(doc(db, 'transactions', id), data), 'Updating transaction')
  }

  function removeTransaction(id) {
    return persist(deleteDoc(doc(db, 'transactions', id)), 'Removing transaction')
  }

  // --- Shopping List ---
  function addShoppingItem(name, quantity, category) {
    return persist(
      addDoc(collection(db, 'shoppingItems'), {
        name: name.trim(),
        quantity: parseInt(quantity, 10),
        category,
        done: false,
        createdAt: serverTimestamp()
      }),
      'Adding shopping item'
    )
  }

  function toggleShoppingItem(id) {
    const item = shoppingList.value.find(i => i.id === id)
    if (!item) return
    return persist(
      updateDoc(doc(db, 'shoppingItems', id), { done: !item.done }),
      'Updating shopping item'
    )
  }

  function updateShoppingItem(id, data) {
    return persist(updateDoc(doc(db, 'shoppingItems', id), data), 'Updating shopping item')
  }

  function removeShoppingItem(id) {
    return persist(deleteDoc(doc(db, 'shoppingItems', id)), 'Removing shopping item')
  }

  return {
    members, rules, events, tasks, transactions, shoppingList,
    loading, error,
    totalBalance, pendingTasks, shoppingProgress,
    init, dispose,
    addMember, updateMember, removeMember,
    addRule, updateRule, removeRule,
    addEvent, updateEvent, removeEvent,
    addTask, toggleTask, updateTask, removeTask,
    addTransaction, updateTransaction, removeTransaction,
    addShoppingItem, toggleShoppingItem, updateShoppingItem, removeShoppingItem
  }
})
