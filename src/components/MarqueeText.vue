<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  text: { type: String, default: '' },
  speed: { type: Number, default: 55 }
})

const container = ref(null)
const textEl = ref(null)
const overflowing = ref(false)
const duration = ref(12)
let observer = null

function measure() {
  const box = container.value
  const inner = textEl.value
  if (!box || !inner) return

  const width = inner.getBoundingClientRect().width
  const overflow = width > box.clientWidth + 1
  overflowing.value = overflow
  if (overflow) duration.value = Math.max(6, width / props.speed)
}

function handleResize() {
  nextTick(measure)
}

onMounted(() => {
  nextTick(measure)
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure)
    if (container.value) observer.observe(container.value)
  } else {
    window.addEventListener('resize', handleResize)
  }
})

watch(
  () => props.text,
  () => nextTick(measure)
)

onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <span
    ref="container"
    class="marquee"
    :class="{ 'is-overflowing': overflowing }"
    :title="overflowing ? text : undefined"
  >
    <span
      class="marquee-track"
      :style="overflowing ? { '--marquee-duration': `${duration}s` } : null"
    >
      <span class="marquee-item">
        <span ref="textEl" class="marquee-text">{{ text }}</span>
      </span>
      <span v-if="overflowing" class="marquee-item" aria-hidden="true">
        <span class="marquee-text">{{ text }}</span>
      </span>
    </span>
  </span>
</template>

<style scoped>
.marquee {
  display: block;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
}

.marquee-track {
  display: inline-flex;
  min-width: 100%;
  vertical-align: top;
}

.marquee-item {
  flex: none;
  padding-right: 3rem;
}

.marquee.is-overflowing .marquee-track {
  will-change: transform;
  animation: marquee-scroll var(--marquee-duration, 12s) linear infinite;
}

.marquee:hover .marquee-track {
  animation-play-state: paused;
}

@keyframes marquee-scroll {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

@media print {
  .marquee-track {
    animation: none !important;
    transform: none !important;
  }

  .marquee-item[aria-hidden='true'] {
    display: none;
  }
}
</style>
