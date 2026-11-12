<script setup>
import { useFamilyStore } from '@/stores/familyStore'
import { ref } from 'vue'

const store = useFamilyStore()

const newMemberName = ref('')
const newMemberRole = ref('Child')
const newMemberAvatar = ref('🙂')
const newMemberColor = ref('#2563eb')

const newRuleTitle = ref('')
const newRuleDescription = ref('')
const newRuleIcon = ref('📌')

function handleAddMember() {
  if (!newMemberName.value.trim()) return
  store.addMember(newMemberName.value, newMemberRole.value, newMemberAvatar.value, newMemberColor.value)
  newMemberName.value = ''
  newMemberAvatar.value = '🙂'
  newMemberColor.value = '#2563eb'
}

function handleAddRule() {
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

    <!-- Add Member -->
    <div class="bg-white/80 backdrop-blur rounded-2xl p-4 sm:p-5 shadow-sm border border-blue-50 anim-fade-up" style="--delay: 40ms">
      <div class="mb-3 flex items-center gap-2">
        <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-sm">➕</span>
        <h2 class="text-sm font-bold text-gray-700">Add family member</h2>
      </div>
      <form class="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_80px_72px_auto]"
            @submit.prevent="handleAddMember">
        <input v-model="newMemberName" placeholder="Name"
               class="col-span-2 sm:col-span-1 w-full min-w-0 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all duration-300" />
        <select v-model="newMemberRole"
                class="w-full min-w-0 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-white transition-all duration-300">
          <option>Parent</option>
          <option>Child</option>
        </select>
        <input v-model="newMemberAvatar" maxlength="2" placeholder="🙂" title="Avatar emoji"
               class="w-full px-2 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm text-center transition-all duration-300" />
        <input v-model="newMemberColor" type="color" title="Color"
               class="h-[42px] w-full cursor-pointer rounded-xl border border-gray-200 bg-white p-1 outline-none transition-all duration-300" />
        <button type="submit"
                class="col-span-2 sm:col-span-1 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold shadow-md shadow-blue-200/60 transition-all duration-300 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95">
          Add
        </button>
      </form>
    </div>

    <!-- Members -->
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="(member, i) in store.members" :key="member.id"
           class="group relative overflow-hidden bg-white/80 backdrop-blur rounded-2xl p-6 shadow-sm border border-blue-50 text-center hover-lift anim-fade-up"
           :style="{ '--delay': `${i * 90}ms` }">
        <button @click="store.removeMember(member.id)" title="Remove member"
                class="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full text-gray-300 text-sm opacity-0 transition-all duration-300 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 active:scale-90">
          ✕
        </button>
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
    <div class="bg-white/80 backdrop-blur rounded-2xl p-4 sm:p-5 shadow-sm border border-blue-50 anim-fade-up" style="--delay: 160ms">
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

    <!-- Rules -->
    <div class="bg-white/80 backdrop-blur rounded-2xl p-6 shadow-sm border border-blue-50 anim-fade-up" style="--delay: 220ms">
      <h2 class="font-bold text-gray-800 mb-4">📋 House Rules</h2>
      <div class="grid sm:grid-cols-2 gap-4">
        <div v-for="(rule, i) in store.rules" :key="rule.id"
             class="group relative flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-50/60 to-cyan-50/60 border border-blue-100/60 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 anim-fade-up"
             :style="{ '--delay': `${280 + i * 70}ms` }">
          <button @click="store.removeRule(rule.id)" title="Remove rule"
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
  </div>
</template>
