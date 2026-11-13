<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  src: { type: String, default: '' },
  name: { type: String, default: '' },
  seed: { type: String, default: '' }
})

const palettes = [
  ['#60a5fa', '#22d3ee'],
  ['#a78bfa', '#f472b6'],
  ['#34d399', '#22d3ee'],
  ['#fbbf24', '#fb7185'],
  ['#818cf8', '#60a5fa'],
  ['#f472b6', '#fb923c'],
  ['#2dd4bf', '#a3e635'],
  ['#38bdf8', '#818cf8']
]

const skins = ['#f6d3b2', '#eab38a', '#d08b5b', '#a8663d', '#7c4a2d', '#f1c27d']
const hairs = ['#1f2937', '#4b2e1e', '#7c3aed', '#b91c1c', '#b45309', '#0f766e', '#9ca3af']
const shirts = ['#2563eb', '#0d9488', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#4f46e5', '#16a34a']

const failed = ref(false)

watch(
  () => props.src,
  () => {
    failed.value = false
  }
)

function hash(value) {
  let result = 2166136261
  for (let i = 0; i < value.length; i++) {
    result ^= value.charCodeAt(i)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

const seedKey = computed(() => props.seed || props.name || props.src || 'family-member')

const fallbackSrc = computed(() => {
  const key = seedKey.value
  const first = hash(key)
  const second = hash(`${key}:skin`)
  const third = hash(`${key}:hair`)

  const palette = palettes[first % palettes.length]
  const skin = skins[second % skins.length]
  const hair = hairs[third % hairs.length]
  const shirt = shirts[(first >>> 3) % shirts.length]
  const hairStyle = (first >>> 7) % 4
  const glasses = (first >>> 11) % 3 === 0

  const hairMarkup = [
    '',
    `<path d="M17 28c0-9 6.7-15 15-15s15 6 15 15v14c0 2-2 3-3.5 2-2.5-1.5-6.5-2.3-11.5-2.3s-9 .8-11.5 2.3C18.9 45 17 44 17 42z" fill="${hair}"/>`,
    `<circle cx="32" cy="13" r="6" fill="${hair}"/>`,
    `<circle cx="32" cy="27" r="14.5" fill="${hair}"/>`
  ][hairStyle]

  const fringeMarkup = `<path d="M20 26.5C20 19 25 14 32 14s12 5 12 12.5c0 1.6-1.4 2.5-2.8 2-2.4-.9-5.3-1.4-9.2-1.4s-6.8.5-9.2 1.4C21.4 29 20 28.1 20 26.5z" fill="${hair}"/>`

  const glassesMarkup = glasses
    ? `<g fill="none" stroke="#1f2937" stroke-width="1.2" opacity="0.75"><circle cx="27.5" cy="29.5" r="3.2"/><circle cx="36.5" cy="29.5" r="3.2"/><path d="M30.7 29.5h2.6"/></g>`
    : ''

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${palette[0]}"/><stop offset="100%" stop-color="${palette[1]}"/></linearGradient><clipPath id="clip"><circle cx="32" cy="32" r="32"/></clipPath></defs><g clip-path="url(#clip)"><rect width="64" height="64" fill="url(#bg)"/><circle cx="14" cy="12" r="10" fill="#ffffff" opacity="0.08"/><circle cx="52" cy="50" r="16" fill="#ffffff" opacity="0.06"/><path d="M4 64c1.6-12 12-20 28-20s26.4 8 28 20z" fill="${shirt}"/><path d="M20 45c3.4 2.6 7.4 4 12 4s8.6-1.4 12-4l4 3.6c-4.8 4.4-10.2 6.4-16 6.4s-11.2-2-16-6.4z" fill="#000000" opacity="0.12"/><rect x="28" y="36" width="8" height="9" rx="4" fill="${skin}"/>${hairMarkup}<circle cx="32" cy="27" r="11.5" fill="${skin}"/>${fringeMarkup}<circle cx="27.5" cy="29.5" r="1.4" fill="#1f2937"/><circle cx="36.5" cy="29.5" r="1.4" fill="#1f2937"/>${glassesMarkup}<path d="M28.5 34.2c1.7 1.5 5.3 1.5 7 0" stroke="#1f2937" stroke-width="1.5" stroke-linecap="round" fill="none"/><circle cx="23.5" cy="32.5" r="1.6" fill="#fda4af" opacity="0.45"/><circle cx="40.5" cy="32.5" r="1.6" fill="#fda4af" opacity="0.45"/></g></svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
})

const imageSrc = computed(() => {
  if (props.src && !failed.value) return props.src
  return fallbackSrc.value
})
</script>

<template>
  <img
    :src="imageSrc"
    :alt="name ? `${name}'s avatar` : 'User avatar'"
    class="shrink-0 rounded-full object-cover"
    @error="failed = true"
  />
</template>
