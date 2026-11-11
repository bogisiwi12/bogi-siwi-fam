<script setup>
import { useFamilyStore } from '@/stores/familyStore'
import { ref, computed } from 'vue'

const store = useFamilyStore()
const newName = ref('')
const newQty = ref(1)
const newCat = ref('Produce')

const remaining = computed(() => store.shoppingProgress.total - store.shoppingProgress.done)
const progress = computed(() =>
  store.shoppingProgress.total
    ? (store.shoppingProgress.done / store.shoppingProgress.total) * 100
    : 0
)

function handleAdd() {
  if (!newName.value.trim()) return
  store.addShoppingItem(newName.value, newQty.value, newCat.value)
  newName.value = ''
  newQty.value = 1
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 anim-fade-up">
      <div>
        <h1 class="text-2xl lg:text-3xl font-extrabold text-gray-800">Shopping List 🛒</h1>
        <p class="text-gray-500 mt-1">Everything the family needs to buy.</p>
      </div>
      <span class="self-start sm:self-auto inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur px-4 py-2 text-xs font-semibold text-indigo-600 shadow-sm border border-indigo-100">
        <span class="w-2 h-2 rounded-full bg-pink-400 anim-pulse-ring" />
        {{ remaining }} item{{ remaining === 1 ? '' : 's' }} left
      </span>
    </div>

    <!-- Progress -->
    <div class="bg-white/80 backdrop-blur rounded-2xl p-5 shadow-sm border border-indigo-50 anim-fade-up" style="--delay: 60ms">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-semibold text-gray-600">Progress</span>
        <span class="text-sm font-bold text-indigo-600 tabular-nums">{{ store.shoppingProgress.done }}/{{ store.shoppingProgress.total }}</span>
      </div>
      <div class="bg-gray-100 rounded-full h-3 overflow-hidden">
        <div class="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-3 rounded-full transition-all duration-700 ease-out"
             :style="{ width: progress + '%' }" />
      </div>
    </div>

    <!-- Add Item -->
    <div class="bg-white/80 backdrop-blur rounded-2xl p-4 shadow-sm border border-indigo-50 anim-fade-up" style="--delay: 120ms">
      <div class="flex flex-col sm:flex-row gap-3">
        <input v-model="newName" placeholder="Item name"
               class="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-all duration-300"
               @keyup.enter="handleAdd" />
        <input v-model="newQty" type="number" min="1"
               class="w-full sm:w-20 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-all duration-300" />
        <select v-model="newCat"
                class="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm bg-white transition-all duration-300">
          <option>Produce</option>
          <option>Dairy</option>
          <option>Bakery</option>
          <option>Meat</option>
          <option>Frozen</option>
          <option>Other</option>
        </select>
        <button @click="handleAdd"
                class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-pink-500 text-white text-sm font-semibold shadow-md shadow-indigo-200/60 transition-all duration-300 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95">
          Add
        </button>
      </div>
    </div>

    <!-- List -->
    <TransitionGroup name="list" tag="div"
                     class="relative bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-indigo-50 divide-y divide-gray-50 overflow-hidden">
      <div v-for="item in store.shoppingList" :key="item.id"
           class="group flex items-center gap-4 p-4 hover:bg-gray-50/70 transition-all duration-300"
           :class="item.done ? 'opacity-50' : ''">
        <button @click="store.toggleShoppingItem(item.id)"
                class="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 hover:scale-110 active:scale-90"
                :class="item.done ? 'bg-green-500 border-green-500 text-white' : 'border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50'">
          <span v-if="item.done" class="text-xs anim-pop">✓</span>
        </button>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium transition-all duration-300" :class="item.done ? 'line-through text-gray-400' : 'text-gray-700'">
            {{ item.name }}
          </p>
          <p class="text-xs text-gray-400">{{ item.category }} · Qty: {{ item.quantity }}</p>
        </div>
        <button @click="store.removeShoppingItem(item.id)"
                class="text-xs font-semibold text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-all duration-300 active:scale-90">
          Remove
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
