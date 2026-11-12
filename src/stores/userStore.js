import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { ROLES } from '@/config/roles'

const familyRoles = {
  parent: { label: 'Parent', avatar: '👨', color: '#2563eb' },
  child: { label: 'Child', avatar: '👦', color: '#06b6d4' }
}

export const useUserStore = defineStore('users', () => {
  const users = ref([])
  const loading = ref(false)
  const error = ref('')
  let unsubscribe = null

  const sortedUsers = computed(() =>
    [...users.value].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  )

  async function syncFamilyMember(user) {
    const memberRef = doc(db, 'members', user.id)
    const snapshot = await getDoc(memberRef)
    const familyRole = familyRoles[user.role]

    if (!familyRole) {
      if (snapshot.exists() && snapshot.data().userId === user.id) {
        await deleteDoc(memberRef)
      }
      return
    }

    if (!snapshot.exists()) {
      await setDoc(memberRef, {
        userId: user.id,
        name: (user.name || user.email?.split('@')[0] || 'Member').trim().slice(0, 60),
        role: familyRole.label,
        avatar: familyRole.avatar,
        color: familyRole.color,
        createdAt: serverTimestamp()
      })
      return
    }

    const member = snapshot.data()
    const updates = {}
    if (member.userId !== user.id) updates.userId = user.id
    if (member.role !== familyRole.label) updates.role = familyRole.label
    if (Object.keys(updates).length) await updateDoc(memberRef, updates)
  }

  function syncFamilyMembers(usersToSync) {
    return Promise.all(
      usersToSync.map(async (user) => {
        try {
          await syncFamilyMember(user)
        } catch (err) {
          console.error(`Failed to sync ${user.name || user.id} to family members:`, err)
          error.value = err.message || 'Failed to sync family members.'
        }
      })
    )
  }

  function subscribe() {
    if (unsubscribe) return
    loading.value = true
    error.value = ''

    unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        users.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        loading.value = false
        void syncFamilyMembers(snapshot.docChanges().map((change) => ({
          id: change.doc.id,
          ...change.doc.data()
        })))
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
      const user = users.value.find((item) => item.id === uid)
      if (user) await syncFamilyMembers([{ ...user, role }])
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
