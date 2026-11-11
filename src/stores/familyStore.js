import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useFamilyStore = defineStore('family', () => {
  // --- Family Members & Rules ---
  const members = ref([
    { id: 1, name: 'Bogi', role: 'Parent', avatar: '👨', color: '#2563eb' },
    { id: 2, name: 'Siwi', role: 'Parent', avatar: '👩', color: '#06b6d4' },
    { id: 3, name: 'Alex', role: 'Child', avatar: '👦', color: '#0ea5e9' },
    { id: 4, name: 'Mia', role: 'Child', avatar: '👧', color: '#0284c7' }
  ])

  const rules = ref([
    { id: 1, title: 'Screen time limit', description: 'Max 2 hours on weekdays', icon: '📱' },
    { id: 2, title: 'Bedtime', description: 'Lights out by 9:30 PM', icon: '🌙' },
    { id: 3, title: 'Chores first', description: 'Complete chores before play', icon: '✅' },
    { id: 4, title: 'Family dinner', description: 'All together at 7 PM', icon: '🍽️' }
  ])

  // --- Calendar ---
  const events = ref([
    { id: 1, title: 'Soccer Practice', date: '2026-11-15', time: '16:00', member: 'Alex', color: '#0ea5e9' },
    { id: 2, title: 'Parent-Teacher Meeting', date: '2026-11-18', time: '14:00', member: 'Mia', color: '#06b6d4' },
    { id: 3, title: 'Family Movie Night', date: '2026-11-20', time: '19:00', member: 'All', color: '#2563eb' },
    { id: 4, title: 'Dentist Appointment', date: '2026-11-22', time: '10:00', member: 'Bogi', color: '#0284c7' }
  ])

  // --- Tasks & Chores ---
  const tasks = ref([
    { id: 1, title: 'Wash dishes', assignee: 'Alex', done: false, points: 5 },
    { id: 2, title: 'Take out trash', assignee: 'Mia', done: true, points: 3 },
    { id: 3, title: 'Vacuum living room', assignee: 'Bogi', done: false, points: 10 },
    { id: 4, title: 'Water plants', assignee: 'Siwi', done: false, points: 2 },
    { id: 5, title: 'Fold laundry', assignee: 'Alex', done: true, points: 5 }
  ])

  // --- Finance ---
  const transactions = ref([
    { id: 1, description: 'Grocery shopping', amount: -120.50, category: 'Food', date: '2026-11-10' },
    { id: 2, description: 'Monthly allowance', amount: 50.00, category: 'Income', date: '2026-11-01' },
    { id: 3, description: 'Electricity bill', amount: -85.00, category: 'Utilities', date: '2026-11-05' },
    { id: 4, description: 'School supplies', amount: -45.30, category: 'Education', date: '2026-11-08' }
  ])

  // --- Shopping List ---
  const shoppingList = ref([
    { id: 1, name: 'Milk', quantity: 2, category: 'Dairy', done: false },
    { id: 2, name: 'Eggs', quantity: 12, category: 'Dairy', done: true },
    { id: 3, name: 'Bread', quantity: 1, category: 'Bakery', done: false },
    { id: 4, name: 'Apples', quantity: 6, category: 'Produce', done: false },
    { id: 5, name: 'Chicken breast', quantity: 1, category: 'Meat', done: false }
  ])

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

  // --- Actions ---
  function toggleTask(id) {
    const task = tasks.value.find(t => t.id === id)
    if (task) task.done = !task.done
  }

  function addTask(title, assignee) {
    tasks.value.push({
      id: Date.now(),
      title,
      assignee,
      done: false,
      points: 5
    })
  }

  function addEvent(title, date, time, member) {
    events.value.push({
      id: Date.now(),
      title,
      date,
      time,
      member,
      color: '#2563eb'
    })
  }

  function addTransaction(description, amount, category) {
    transactions.value.push({
      id: Date.now(),
      description,
      amount: parseFloat(amount),
      category,
      date: new Date().toISOString().split('T')[0]
    })
  }

  function toggleShoppingItem(id) {
    const item = shoppingList.value.find(i => i.id === id)
    if (item) item.done = !item.done
  }

  function addShoppingItem(name, quantity, category) {
    shoppingList.value.push({
      id: Date.now(),
      name,
      quantity: parseInt(quantity),
      category,
      done: false
    })
  }

  function removeShoppingItem(id) {
    shoppingList.value = shoppingList.value.filter(i => i.id !== id)
  }

  return {
    members, rules, events, tasks, transactions, shoppingList,
    totalBalance, pendingTasks, shoppingProgress,
    toggleTask, addTask, addEvent, addTransaction,
    toggleShoppingItem, addShoppingItem, removeShoppingItem
  }
})
