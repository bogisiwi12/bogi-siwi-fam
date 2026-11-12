<script setup>
import { useFamilyStore } from '@/stores/familyStore'
import { useAuthStore } from '@/stores/authStore'
import { ref } from 'vue'
import IconPicker from '@/components/IconPicker.vue'

const store = useFamilyStore()
const auth = useAuthStore()

const newMemberName = ref('')
const newMemberRole = ref('Child')
const newMemberAvatar = ref('🙂')
const newMemberColor = ref('#2563eb')

const editingMember = ref(null)
const editForm = ref({ name: '', role: 'Child', avatar: '🙂', color: '#2563eb' })
const memberToDelete = ref(null)

const newRuleTitle = ref('')
const newRuleDescription = ref('')
const newRuleIcon = ref('📌')

async function handleAddMember() {
  if (!auth.isAdmin) return
  if (!newMemberName.value.trim()) return
  const ok = await store.addMember(
    newMemberName.value,
    newMemberRole.value,
    newMemberAvatar.value,
    newMemberColor.value
  )
  if (!ok) return
  newMemberName.value = ''
  newMemberAvatar.value = '🙂'
  newMemberColor.value = '#2563eb'
}

function openEditMember(member) {
  if (!auth.isAdmin) return
  store.error = ''
  editingMember.value = member
  editForm.value = {
    name: member.name,
    role: member.role,
    avatar: member.avatar || '🙂',
    color: member.color || '#2563eb'
  }
}

function closeEditMember() {
  editingMember.value = null
}

async function saveEditMember() {
  if (!auth.isAdmin || !editingMember.value) return
  if (!editForm.value.name.trim()) return
  const ok = await store.updateMember(editingMember.value.id, {
    name: editForm.value.name.trim(),
    role: editForm.value.role,
    avatar: editForm.value.avatar,
    color: editForm.value.color
  })
  if (ok) closeEditMember()
}

function askRemoveMember(member) {
  if (!auth.isAdmin) return
  memberToDelete.value = member
}

function cancelRemoveMember() {
  memberToDelete.value = null
}

async function confirmRemoveMember() {
  if (!memberToDelete.value) return
  const target = memberToDelete.value
  memberToDelete.value = null
  await store.removeMember(target.id)
}

function handleAddRule() {
  if (!auth.canManageRules) return
  if (!newRuleTitle.value.trim()) return
  store.addRule(newRuleTitle.value, newRuleDescription.value, newRuleIcon.value)
  newRuleTitle.value = ''
  newRuleDescription.value = ''
  newRuleIcon.value = '📌'
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 anim-fade-up">
      <div>
        <h1 class="text-2xl lg:text-3xl font-extrabold text-gray-800">Family Members & Rules 👨‍👩‍👧‍👦</h1>
        <p class="text-gray-500 mt-1">Meet the family and our house rules.</p>
      </div>
      <span class="self-start sm:self-auto inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur px-4 py-2 text-xs font-semibold text-blue-600 shadow-sm border border-blue-100">
        <span class="w-2 h-2 rounded-full bg-blue-400 anim-pulse-ring" />
        {{ store.members.length }} members · {{ store.rules.length }} rules
      </span>
    </div>

    <Transition name="page">
      <div v-if="store.error"
           class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
        {{ store.error }}
      </div>
    </Transition>

    <!-- Add Member -->
    <div v-if="auth.isAdmin" class="bg-white/80 backdrop-blur rounded-2xl p-4 sm:p-5 shadow-sm border border-blue-50 anim-fade-up" style="--delay: 40ms">
      <div class="mb-3 flex items-center gap-2">
        <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-sm">➕</span>
        <h2 class="text-sm font-bold text-gray-700">Add family member</h2>
      </div>
      <form class="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_80px_72px_auto]"
            @submit.prevent="handleAddMember">
        <input v-model="newMemberName" maxlength="60" placeholder="Name"
               class="col-span-2 sm:col-span-1 w-full min-w-0 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all duration-300" />
        <select v-model="newMemberRole"
                class="w-full min-w-0 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-white transition-all duration-300">
          <option>Parent</option>
          <option>Child</option>
        </select>
        <IconPicker v-model="newMemberAvatar" align="right" />
        <input v-model="newMemberColor" type="color" title="Color"
               class="h-[42px] w-full cursor-pointer rounded-xl border border-gray-200 bg-white p-1 outline-none transition-all duration-300" />
        <button type="submit"
                class="col-span-2 sm:col-span-1 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold shadow-md shadow-blue-200/60 transition-all duration-300 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95">
          Add
        </button>
      </form>
    </div>

    <div v-else class="rounded-2xl border border-blue-100/70 bg-blue-50/60 px-4 py-3 text-xs font-medium text-blue-700 anim-fade-up" style="--delay: 40ms">
      🔒 Only admins can add or remove family members.
    </div>

    <!-- Members -->
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="(member, i) in store.members" :key="member.id"
           class="group relative overflow-hidden bg-white/80 backdrop-blur rounded-2xl p-6 shadow-sm border border-blue-50 text-center hover-lift anim-fade-up"
           :style="{ '--delay': `${i * 90}ms` }">
        <div v-if="auth.isAdmin" class="absolute top-3 right-3 z-20 flex items-center gap-1">
          <button @click="openEditMember(member)" title="Edit member"
                  class="flex h-8 w-8 items-center justify-center rounded-full border border-blue-100 bg-white/90 text-blue-500 shadow-sm backdrop-blur transition-all duration-300 hover:scale-110 hover:bg-blue-50 active:scale-90">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487a2.06 2.06 0 1 1 2.914 2.914L8.5 18.677l-4.2 1.1 1.1-4.2L16.862 4.487Z" />
            </svg>
          </button>
          <button @click="askRemoveMember(member)" title="Remove member"
                  class="flex h-8 w-8 items-center justify-center rounded-full border border-red-100 bg-white/90 text-red-400 shadow-sm backdrop-blur transition-all duration-300 hover:scale-110 hover:bg-red-50 active:scale-90">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 .93h6a1 1 0 0 0 1-.93l1-13M10 11v6m4-6v6" />
            </svg>
          </button>
        </div>
        <div class="pointer-events-none absolute inset-x-0 top-0 h-1.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
             :style="{ background: `linear-gradient(90deg, ${member.color}, transparent)` }" />
        <div class="anim-float mx-auto w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-3 ring-4 ring-white shadow-md transition-transform duration-300 group-hover:scale-110"
             :style="{ backgroundColor: member.color + '20', animationDelay: `${i * 300}ms` }">
          {{ member.avatar }}
        </div>
        <h3 class="font-bold text-gray-800">{{ member.name }}</h3>
        <span class="inline-block mt-2 text-xs px-3 py-1 rounded-full font-semibold transition-transform duration-300 group-hover:scale-105"
              :style="{ backgroundColor: member.color + '20', color: member.color }">
          {{ member.role }}
        </span>
      </div>
    </div>

    <!-- Add Rule -->
    <div v-if="auth.canManageRules" class="bg-white/80 backdrop-blur rounded-2xl p-4 sm:p-5 shadow-sm border border-blue-50 anim-fade-up" style="--delay: 160ms">
      <div class="mb-3 flex items-center gap-2">
        <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-sm">➕</span>
        <h2 class="text-sm font-bold text-gray-700">Add house rule</h2>
      </div>
      <form class="grid grid-cols-1 gap-3 sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1.2fr)_auto]"
            @submit.prevent="handleAddRule">
        <input v-model="newRuleIcon" maxlength="2" placeholder="📌" title="Icon emoji"
               class="w-full px-2 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm text-center transition-all duration-300" />
        <input v-model="newRuleTitle" placeholder="Rule title"
               class="w-full min-w-0 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all duration-300" />
        <input v-model="newRuleDescription" placeholder="Short description"
               class="w-full min-w-0 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all duration-300" />
        <button type="submit"
                class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold shadow-md shadow-blue-200/60 transition-all duration-300 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95">
          Add
        </button>
      </form>
    </div>

    <div v-else class="rounded-2xl border border-blue-100/70 bg-blue-50/60 px-4 py-3 text-xs font-medium text-blue-700 anim-fade-up" style="--delay: 160ms">
      🔒 Only admins and parents can add or remove house rules.
    </div>

    <!-- Rules -->
    <div class="bg-white/80 backdrop-blur rounded-2xl p-6 shadow-sm border border-blue-50 anim-fade-up" style="--delay: 220ms">
      <h2 class="font-bold text-gray-800 mb-4">📋 House Rules</h2>
      <div class="grid sm:grid-cols-2 gap-4">
        <div v-for="(rule, i) in store.rules" :key="rule.id"
             class="group relative flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-50/60 to-cyan-50/60 border border-blue-100/60 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 anim-fade-up"
             :style="{ '--delay': `${280 + i * 70}ms` }">
          <button v-if="auth.canManageRules" @click="store.removeRule(rule.id)" title="Remove rule"
                  class="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full text-gray-300 text-sm opacity-0 transition-all duration-300 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 active:scale-90">
            ✕
          </button>
          <span class="text-2xl transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-6">{{ rule.icon }}</span>
          <div>
            <h3 class="font-semibold text-gray-800 text-sm">{{ rule.title }}</h3>
            <p class="text-xs text-gray-500 mt-0.5">{{ rule.description }}</p>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="page">
        <div v-if="editingMember" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="closeEditMember" />
          <div class="relative w-full max-w-md rounded-3xl border border-blue-100 bg-white p-6 shadow-2xl">
            <div class="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-extrabold text-gray-800">Edit family member</h2>
                <p class="mt-1 text-xs text-gray-400">Update their name, role, icon, or color.</p>
              </div>
              <button type="button" @click="closeEditMember" title="Close"
                      class="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                ✕
              </button>
            </div>

            <form class="space-y-4" @submit.prevent="saveEditMember">
              <div class="flex items-center gap-4">
                <div class="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full text-3xl ring-4 ring-white shadow-md"
                     :style="{ backgroundColor: editForm.color + '20' }">
                  {{ editForm.avatar }}
                </div>
                <div class="min-w-0 flex-1">
                  <label class="mb-1.5 block text-xs font-semibold text-gray-600">Icon</label>
                  <IconPicker v-model="editForm.avatar" align="right" />
                </div>
              </div>

              <div>
                <label class="mb-1.5 block text-xs font-semibold text-gray-600">Name</label>
                <input v-model="editForm.name" maxlength="60" placeholder="Name"
                       class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all duration-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="mb-1.5 block text-xs font-semibold text-gray-600">Role</label>
                  <select v-model="editForm.role"
                          class="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-all duration-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                    <option>Parent</option>
                    <option>Child</option>
                  </select>
                </div>
                <div>
                  <label class="mb-1.5 block text-xs font-semibold text-gray-600">Color</label>
                  <input v-model="editForm.color" type="color"
                         class="h-[42px] w-full cursor-pointer rounded-xl border border-gray-200 bg-white p-1 outline-none transition-all duration-300" />
                </div>
              </div>

              <div v-if="store.error"
                   class="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                {{ store.error }}
              </div>

              <div class="flex justify-end gap-2 pt-2">
                <button type="button" @click="closeEditMember"
                        class="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition-all duration-300 hover:bg-gray-50 active:scale-95">
                  Cancel
                </button>
                <button type="submit"
                        class="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-200/60 transition-all duration-300 hover:opacity-90 hover:shadow-lg active:scale-95">
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="page">
        <div v-if="memberToDelete" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="cancelRemoveMember" />
          <div class="relative w-full max-w-sm rounded-3xl border border-red-100 bg-white p-6 text-center shadow-2xl">
            <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">🗑️</div>
            <h2 class="mt-4 text-lg font-extrabold text-gray-800">Remove member?</h2>
            <p class="mt-1 text-sm text-gray-500">
              <span class="font-semibold text-gray-700">{{ memberToDelete.name }}</span> will be removed from the family list.
            </p>
            <div class="mt-6 flex justify-center gap-2">
              <button type="button" @click="cancelRemoveMember"
                      class="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 transition-all duration-300 hover:bg-gray-50 active:scale-95">
                Cancel
              </button>
              <button type="button" @click="confirmRemoveMember"
                      class="rounded-xl bg-gradient-to-r from-red-500 to-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-200/60 transition-all duration-300 hover:opacity-90 hover:shadow-lg active:scale-95">
                Remove
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
