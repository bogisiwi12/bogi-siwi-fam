<script setup>
import { useFamilyStore } from '@/stores/familyStore'
const store = useFamilyStore()
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

    <!-- Members -->
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="(member, i) in store.members" :key="member.id"
           class="group relative overflow-hidden bg-white/80 backdrop-blur rounded-2xl p-6 shadow-sm border border-blue-50 text-center hover-lift anim-fade-up"
           :style="{ '--delay': `${i * 90}ms` }">
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

    <!-- Rules -->
    <div class="bg-white/80 backdrop-blur rounded-2xl p-6 shadow-sm border border-blue-50 anim-fade-up" style="--delay: 220ms">
      <h2 class="font-bold text-gray-800 mb-4">📋 House Rules</h2>
      <div class="grid sm:grid-cols-2 gap-4">
        <div v-for="(rule, i) in store.rules" :key="rule.id"
             class="group flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-50/60 to-cyan-50/60 border border-blue-100/60 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 anim-fade-up"
             :style="{ '--delay': `${280 + i * 70}ms` }">
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
