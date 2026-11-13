<script setup>
import { useFamilyStore } from '@/stores/familyStore'
import { useAuthStore } from '@/stores/authStore'
import { ref } from 'vue'
import IconPicker from '@/components/IconPicker.vue'
import { isDriveConfigured, uploadMemberPicture } from '@/services/googleDrive'

const store = useFamilyStore()
const auth = useAuthStore()

const editingMember = ref(null)
const editForm = ref({ name: '', avatar: '🙂', color: '#2563eb', photoURL: '' })
const photoInputEl = ref(null)
const uploadingPhoto = ref(false)
const photoError = ref('')
const driveReady = isDriveConfigured()

const newRuleTitle = ref('')
const newRuleDescription = ref('')
const newRuleIcon = ref('📌')

const ruleIcons = [
  '📌', '📋', '📝', '✅', '📱', '⏰',
  '🌙', '☀️', '🛏️', '🧹', '🧺', '🧼',
  '🚿', '🪥', '👕', '🎒', '📚', '✏️',
  '🍽️', '🍎', '💧', '🥗', '🚫', '📵',
  '🔇', '🤫', '🤝', '❤️', '🙏', '🗣️',
  '🚪', '🔑', '💡', '🌱', '♻️', '⭐'
]

function openEditMember(member) {
  if (!auth.isAdmin) return
  store.error = ''
  photoError.value = ''
  editingMember.value = member
  editForm.value = {
    name: member.name,
    avatar: member.avatar || '🙂',
    color: member.color || '#2563eb',
    photoURL: member.photoURL || ''
  }
}

function closeEditMember() {
  editingMember.value = null
  uploadingPhoto.value = false
  photoError.value = ''
}

async function saveEditMember() {
  if (!auth.isAdmin || !editingMember.value) return
  if (!editForm.value.name.trim()) return
  const ok = await store.updateMember(editingMember.value.id, {
    name: editForm.value.name.trim(),
    avatar: editForm.value.avatar,
    color: editForm.value.color,
    photoURL: editForm.value.photoURL
  })
  if (ok) closeEditMember()
}

function pickPhoto() {
  if (uploadingPhoto.value) return
  photoInputEl.value?.click()
}

async function handlePhotoChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  photoError.value = ''
  uploadingPhoto.value = true
  try {
    const result = await uploadMemberPicture(file, editForm.value.name)
    editForm.value.photoURL = result.url
  } catch (err) {
    photoError.value = err?.message || 'Could not upload the picture.'
  } finally {
    uploadingPhoto.value = false
  }
}

function removePhoto() {
  editForm.value.photoURL = ''
  photoError.value = ''
}

async function moveMember(member, direction) {
  if (!auth.isAdmin) return
  const list = [...store.members]
  const index = list.findIndex((item) => item.id === member.id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= list.length) return

  const [moved] = list.splice(index, 1)
  list.splice(target, 0, moved)
  await store.reorderMembers(list.map((item) => item.id))
}

function parseRuleDescription(description) {
  return (description || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
}

function isRuleList(description) {
  const text = (description || '').trim()
  if (!text) return false
  return /[\r\n]/.test(text) || /^\s*(?:[-*•]|\d+[.)])\s+/.test(text)
}

async function handleAddRule() {
  if (!auth.canManageRules) return
  if (!newRuleTitle.value.trim()) return
  const ok = await store.addRule(newRuleTitle.value, newRuleDescription.value, newRuleIcon.value)
  if (!ok) return
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

    <div class="rounded-2xl border border-blue-100/70 bg-blue-50/60 px-4 py-3 text-xs font-medium text-blue-700 anim-fade-up" style="--delay: 40ms">
      Family members are added automatically when their user role is set to Parent or Child. Admins can edit their name, photo, icon, and color, and reorder them here.
    </div>

    <!-- Members -->
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-if="store.members.length === 0"
           class="col-span-full rounded-2xl border border-dashed border-blue-200 bg-white/60 px-6 py-10 text-center text-sm text-gray-500">
        No family members yet. Assign a user the Parent or Child role in User Management to add them.
      </div>
      <div v-for="(member, i) in store.members" :key="member.id"
           class="group relative overflow-hidden bg-white/80 backdrop-blur rounded-2xl p-6 shadow-sm border border-blue-50 text-center hover-lift anim-fade-up"
           :style="{ '--delay': `${i * 90}ms` }">
        <template v-if="member.photoURL">
          <div class="pointer-events-none absolute inset-0 bg-cover bg-center opacity-20"
               :style="{ backgroundImage: `url('${member.photoURL}')` }" />
          <div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/60 via-white/80 to-white/95" />
        </template>
        <div v-if="auth.isAdmin" class="absolute top-3 right-3 z-20 flex items-center gap-1">
          <button @click="moveMember(member, -1)" :disabled="i === 0" title="Move earlier"
                  class="flex h-7 w-7 items-center justify-center rounded-full border border-blue-100 bg-white/90 text-xs font-bold text-blue-500 shadow-sm backdrop-blur transition-all duration-300 hover:scale-110 hover:bg-blue-50 active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100">
            ↑
          </button>
          <button @click="moveMember(member, 1)" :disabled="i === store.members.length - 1" title="Move later"
                  class="flex h-7 w-7 items-center justify-center rounded-full border border-blue-100 bg-white/90 text-xs font-bold text-blue-500 shadow-sm backdrop-blur transition-all duration-300 hover:scale-110 hover:bg-blue-50 active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100">
            ↓
          </button>
          <button @click="openEditMember(member)" title="Edit member"
                  class="flex h-8 w-8 items-center justify-center rounded-full border border-blue-100 bg-white/90 text-blue-500 shadow-sm backdrop-blur transition-all duration-300 hover:scale-110 hover:bg-blue-50 active:scale-90">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487a2.06 2.06 0 1 1 2.914 2.914L8.5 18.677l-4.2 1.1 1.1-4.2L16.862 4.487Z" />
            </svg>
          </button>
        </div>
        <div class="pointer-events-none absolute inset-x-0 top-0 h-1.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
             :style="{ background: `linear-gradient(90deg, ${member.color}, transparent)` }" />
        <div class="relative z-10">
          <div class="anim-float mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-3xl shadow-md ring-4 ring-white transition-transform duration-300 group-hover:scale-110"
               :style="member.photoURL
                 ? { backgroundImage: `url('${member.photoURL}')`, backgroundSize: 'cover', backgroundPosition: 'center', animationDelay: `${i * 300}ms` }
                 : { backgroundColor: member.color + '20', animationDelay: `${i * 300}ms` }">
            <span v-if="!member.photoURL">{{ member.avatar }}</span>
          </div>
          <h3 class="font-bold text-gray-800">{{ member.name }}</h3>
          <span class="inline-block mt-2 text-xs px-3 py-1 rounded-full font-semibold transition-transform duration-300 group-hover:scale-105"
                :style="{ backgroundColor: member.color + '20', color: member.color }">
            {{ member.role }}
          </span>
        </div>
      </div>
    </div>

    <!-- Add Rule -->
    <div v-if="auth.canManageRules" class="bg-white/80 backdrop-blur rounded-2xl p-4 sm:p-5 shadow-sm border border-blue-50 anim-fade-up" style="--delay: 160ms">
      <div class="mb-3 flex items-center gap-2">
        <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-sm">➕</span>
        <h2 class="text-sm font-bold text-gray-700">Add house rule</h2>
      </div>
      <form class="space-y-3" @submit.prevent="handleAddRule">
        <div class="flex flex-col gap-3 sm:flex-row">
          <IconPicker v-model="newRuleIcon" :icons="ruleIcons" align="right" label="Choose rule icon" class="sm:w-[72px]" />
          <input v-model="newRuleTitle" maxlength="80" placeholder="Rule title"
                 class="w-full min-w-0 flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all duration-300" />
          <button type="submit"
                  class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold shadow-md shadow-blue-200/60 transition-all duration-300 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95">
            Add
          </button>
        </div>
        <div>
          <textarea v-model="newRuleDescription" rows="3" maxlength="1000"
                    placeholder="Details — add one item per line, e.g. - Brush teeth before bed"
                    class="w-full resize-y px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all duration-300" />
          <p class="mt-1 text-[11px] text-gray-400">One item per line will display as a list.</p>
        </div>
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
            <ul v-if="isRuleList(rule.description)"
                class="mt-1 list-disc space-y-0.5 pl-4 text-xs text-gray-500 marker:text-blue-400">
              <li v-for="(line, lineIndex) in parseRuleDescription(rule.description)" :key="lineIndex">{{ line }}</li>
            </ul>
            <p v-else-if="rule.description" class="text-xs text-gray-500 mt-0.5">{{ rule.description }}</p>
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
                <p class="mt-1 text-xs text-gray-400">Update their name, photo, icon, or color.</p>
              </div>
              <button type="button" @click="closeEditMember" title="Close"
                      class="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                ✕
              </button>
            </div>

            <form class="space-y-4" @submit.prevent="saveEditMember">
              <div class="flex items-center gap-4">
                <div class="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-3xl shadow-md ring-4 ring-white"
                     :style="editForm.photoURL
                       ? { backgroundImage: `url('${editForm.photoURL}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
                       : { backgroundColor: editForm.color + '20' }">
                  <span v-if="!editForm.photoURL">{{ editForm.avatar }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <label class="mb-1.5 block text-xs font-semibold text-gray-600">Icon</label>
                  <IconPicker v-model="editForm.avatar" align="right" />
                </div>
              </div>

              <div>
                <label class="mb-1.5 block text-xs font-semibold text-gray-600">Profile picture</label>
                <div class="flex flex-wrap items-center gap-2">
                  <button type="button" :disabled="uploadingPhoto || !driveReady" @click="pickPhoto"
                          class="inline-flex items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-600 transition-all duration-300 hover:bg-blue-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
                    <span v-if="uploadingPhoto" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
                    {{ uploadingPhoto ? 'Uploading…' : editForm.photoURL ? 'Replace photo' : 'Upload photo' }}
                  </button>
                  <button v-if="editForm.photoURL && !uploadingPhoto" type="button" @click="removePhoto"
                          class="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-500 transition-all duration-300 hover:bg-gray-50 active:scale-95">
                    Remove
                  </button>
                </div>
                <input ref="photoInputEl" type="file" accept="image/*" class="hidden" @change="handlePhotoChange" />
                <p class="mt-1.5 text-[11px] text-gray-400">
                  Uploads to Google Drive and shows as this member’s background picture.
                </p>
                <p v-if="!driveReady" class="mt-1 text-[11px] font-medium text-amber-600">
                  Google Drive is not configured. Add VITE_CLIENT_ID and the picture folder ID to .env.
                </p>
                <p v-if="photoError" class="mt-1 text-[11px] font-medium text-red-500">{{ photoError }}</p>
              </div>

              <div>
                <label class="mb-1.5 block text-xs font-semibold text-gray-600">Name</label>
                <input v-model="editForm.name" maxlength="60" placeholder="Name"
                       class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all duration-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>

              <div>
                <label class="mb-1.5 block text-xs font-semibold text-gray-600">Color</label>
                <input v-model="editForm.color" type="color"
                       class="h-[42px] w-full cursor-pointer rounded-xl border border-gray-200 bg-white p-1 outline-none transition-all duration-300" />
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
                <button type="submit" :disabled="uploadingPhoto"
                        class="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-200/60 transition-all duration-300 hover:opacity-90 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>
