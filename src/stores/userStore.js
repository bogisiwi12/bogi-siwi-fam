import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { ROLES } from '@/config/roles'

export const useUserStore = defineStore('users', () => {
  const users = ref([])
  const loading = ref(false)
  const error = ref('')
  let unsubscribe = null

  const sortedUsers = computed(() =>
    [...users.value].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  )

  function subscribe() {
    if (unsubscribe) return
    loading.value = true
    error.value = ''

    unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        users.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        loading.value = false
      },
      (err) => {
        console.error('Failed to load users:', err)
        error.value = err.message || 'Failed to load users.'
        loading.value = false
      }
    )
  }

  async function updateRole(uid, role) {
    error.value = ''
    if (!ROLES.includes(role)) {
      error.value = 'Invalid role.'
      return false
    }

    try {
      await updateDoc(doc(db, 'users', uid), { role })
      return true
    } catch (err) {
      console.error('Failed to update user role:', err)
      error.value = err.message || 'Failed to update user role.'
      return false
    }
  }

  function dispose() {
    if (unsubscribe) unsubscribe()
    unsubscribe = null
    users.value = []
    loading.value = false
    error.value = ''
  }

  return {
    users,
    sortedUsers,
    loading,
    error,
    subscribe,
    updateRole,
    dispose
  }
})
