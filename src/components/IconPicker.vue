<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '🙂' },
  align: { type: String, default: 'left' }
})

const emit = defineEmits(['update:modelValue'])

const icons = [
  '👨', '👩', '👦', '👧', '👶', '🧑',
  '👴', '👵', '🧔', '👩‍🦰', '👨‍🦱', '👩‍🦱',
  '👱', '👨‍🦳', '👩‍🦳', '🧓', '👨‍🦲', '👩‍🦲',
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊',
  '🐻', '🐼', '🐨', '🦁', '🐯', '🐸',
  '🐵', '🦄', '🐧', '🦉', '🐢', '🐠'
]

const open = ref(false)
const trigger = ref(null)
const popover = ref(null)
const popoverStyle = ref({ top: '0px', left: '0px' })

const POPOVER_WIDTH = 256
const GAP = 8

function updatePosition() {
  if (!trigger.value) return
  const rect = trigger.value.getBoundingClientRect()
  const height = popover.value?.offsetHeight || 280
  const maxLeft = Math.max(GAP, window.innerWidth - POPOVER_WIDTH - GAP)
  let left = props.align === 'right' ? rect.right - POPOVER_WIDTH : rect.left
  left = Math.min(Math.max(GAP, left), maxLeft)

  let top = rect.bottom + GAP
  if (top + height > window.innerHeight - GAP) {
    top = Math.max(GAP, rect.top - height - GAP)
  }

  popoverStyle.value = { top: `${top}px`, left: `${left}px` }
}

async function toggle() {
  if (open.value) {
    open.value = false
    return
  }
  open.value = true
  await nextTick()
  updatePosition()
}

function select(icon) {
  emit('update:modelValue', icon)
  open.value = false
}

function handlePointerDown(event) {
  if (!open.value) return
  const target = event.target
  if (trigger.value?.contains(target) || popover.value?.contains(target)) return
  open.value = false
}

function handleViewportChange() {
  if (open.value) updatePosition()
}

onMounted(() => {
  document.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('scroll', handleViewportChange, true)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)
})
</script>

<template>
  <div class="relative">
    <button ref="trigger" type="button" :aria-expanded="open" aria-label="Choose family member icon"
            @click="toggle"
            class="flex h-[42px] w-full items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-2 text-lg outline-none transition-all duration-300 hover:border-blue-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
      <span>{{ modelValue }}</span>
      <span class="text-[9px] text-gray-400">▾</span>
    </button>

    <Teleport to="body">
      <div v-if="open" ref="popover"
           class="fixed z-[200] w-64 rounded-2xl border border-blue-100 bg-white p-3 shadow-2xl shadow-blue-200/60"
           :style="popoverStyle">
        <div class="grid grid-cols-6 gap-1.5">
          <button v-for="icon in icons" :key="icon" type="button"
                  class="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-all duration-200 hover:scale-110 hover:bg-blue-50"
                  :class="icon === modelValue ? 'bg-blue-100 ring-2 ring-blue-300' : ''"
                  @click="select(icon)">
            {{ icon }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
