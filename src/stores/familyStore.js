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
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'
import { db } from '@/firebase/config'

const defaultRules = [
  { id: 'screen-time', title: 'Screen time limit', description: 'Max 2 hours on weekdays', icon: '📱' },
  { id: 'bedtime', title: 'Bedtime', description: 'Lights out by 9:30 PM', icon: '🌙' },
  { id: 'chores-first', title: 'Chores first', description: 'Complete chores before play', icon: '✅' },
  { id: 'family-dinner', title: 'Family dinner', description: 'All together at 7 PM', icon: '🍽️' }
]

const defaultTasks = [
  { id: 'wash-dishes', title: 'Wash dishes', assignee: 'Alex', done: false, points: 5 },
  { id: 'take-out-trash', title: 'Take out trash', assignee: 'Mia', done: true, points: 3 },
  { id: 'vacuum-living-room', title: 'Vacuum living room', assignee: 'Bogi', done: false, points: 10 },
  { id: 'water-plants', title: 'Water plants', assignee: 'Siwi', done: false, points: 2 },
  { id: 'fold-laundry', title: 'Fold laundry', assignee: 'Alex', done: true, points: 5 }
]

const defaultShoppingItems = [
  { id: 'milk', name: 'Milk', quantity: 2, category: 'Dairy', done: false },
  { id: 'eggs', name: 'Eggs', quantity: 12, category: 'Dairy', done: true },
  { id: 'bread', name: 'Bread', quantity: 1, category: 'Bakery', done: false },
  { id: 'apples', name: 'Apples', quantity: 6, category: 'Produce', done: false },
  { id: 'chicken-breast', name: 'Chicken breast', quantity: 1, category: 'Meat', done: false }
]

const seedData = [
  ['rules', defaultRules],
  ['tasks', defaultTasks],
  ['shoppingItems', defaultShoppingItems]
]

export const useFamilyStore = defineStore('family', () => {
  // --- Family Members & Rules ---
  const members = ref([])
  const rules = ref([])

  // --- Tasks & Chores ---
  const tasks = ref([])

  // --- Shopping List ---
  const shoppingList = ref([])

  const loading = ref(false)
  const error = ref('')

  let initPromise = null
  const unbinders = []
  const loaded = new Set()
  const bindings = [
    ['members', members],
    ['rules', rules],
    ['tasks', tasks],
    ['shoppingItems', shoppingList]
  ]

  // --- Computed ---
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
    if (loaded.size >= bindings.length) loading.value = false
  }

  function bindCollection(name, target) {
    const q = query(collection(db, name), orderBy('createdAt'))
    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        if (name === 'members') {
          const filtered = items.filter((member) => member.userId === member.id)
          target.value = sortMembers(filtered)
        } else {
          target.value = items
        }
        markLoaded(name)
      },
      (err) => {
        console.error(`Failed to load ${name} from Firestore:`, err)
        error.value = err.message
        markLoaded(name)
      }
    )
  }

  function sortMembers(items) {
    return [...items].sort((a, b) => {
      const aOrder = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER
      const bOrder = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) return aOrder - bOrder
      const aCreated = a.createdAt?.toMillis?.() ?? 0
      const bCreated = b.createdAt?.toMillis?.() ?? 0
      return aCreated - bCreated
    })
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
      return true
    } catch (err) {
      console.error(`${label} failed:`, err)
      error.value = err.message || `${label} failed.`
      return false
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
    tasks.value = []
    shoppingList.value = []
  }

  // --- Family member presentation ---
  function updateMember(id, data) {
    return persist(updateDoc(doc(db, 'members', id), data), 'Updating member')
  }

  function reorderMembers(orderedIds) {
    if (!orderedIds.length) return Promise.resolve(false)
    const batch = writeBatch(db)
    orderedIds.forEach((id, index) => {
      batch.update(doc(db, 'members', id), { order: index })
    })
    return persist(batch.commit(), 'Updating member order')
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
    members, rules, tasks, shoppingList,
    loading, error,
    pendingTasks, shoppingProgress,
    init, dispose,
    updateMember, reorderMembers,
    addRule, updateRule, removeRule,
    addTask, toggleTask, updateTask, removeTask,
    addShoppingItem, toggleShoppingItem, updateShoppingItem, removeShoppingItem
  }
})
