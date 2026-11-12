<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const mode = ref('login')
const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const localError = ref('')
const success = ref('')

const isRegister = computed(() => mode.value === 'register')

const features = [
  { icon: '✅', label: 'Chores and rewards' },
  { icon: '🛒', label: 'Smart shopping lists' }
]

const avatars = ['👨', '👩', '👦', '👧']

function switchMode(next) {
  mode.value = next
  localError.value = ''
  success.value = ''
}

function redirectTarget() {
  const target = route.query.redirect
  return typeof target === 'string' && target.startsWith('/') ? target : '/'
}

function validate() {
  if (isRegister.value && !name.value.trim()) return 'Please enter your name.'
  if (!email.value.trim()) return 'Please enter your email address.'
  if (password.value.length < 6) return 'Your password must be at least 6 characters.'
  if (isRegister.value && password.value !== confirmPassword.value) {
    return 'Passwords do not match.'
  }
  return ''
}

async function handleSubmit() {
  localError.value = ''
  success.value = ''

  const validationError = validate()
  if (validationError) {
    localError.value = validationError
    return
  }

  submitting.value = true

  try {
    if (isRegister.value) {
      await auth.register(name.value.trim(), email.value.trim(), password.value)
      success.value = 'Your account is ready!'
    } else {
      await auth.login(email.value.trim(), password.value)
    }

    await router.push(redirectTarget())
  } catch {
    localError.value = auth.error
  } finally {
    submitting.value = false
  }
}

async function handleGoogle() {
  localError.value = ''
  success.value = ''
  submitting.value = true

  try {
    await auth.loginWithGoogle()
    await router.push(redirectTarget())
  } catch {
    localError.value = auth.error
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen w-full items-center justify-center px-4 py-8">
    <div class="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-2xl shadow-blue-200/50 backdrop-blur-xl anim-scale-in lg:grid-cols-2">
      <!-- Brand panel -->
      <div class="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 p-10 text-white lg:flex">
        <div class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div class="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />

        <div class="relative">
          <div class="flex items-center gap-3">
            <span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur">🏡</span>
            <span class="text-lg font-extrabold tracking-tight">Bogi-Siwi Fam</span>
          </div>

          <h2 class="mt-12 text-3xl font-extrabold leading-tight">
            One home for your<br />whole family.
          </h2>
          <p class="mt-3 max-w-xs text-sm text-white/80">
            Coordinate schedules, chores, budgets, and shopping in one beautiful place.
          </p>

          <ul class="mt-8 space-y-3 text-sm font-medium">
            <li v-for="feature in features" :key="feature.label" class="flex items-center gap-3">
              <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">{{ feature.icon }}</span>
              {{ feature.label }}
            </li>
          </ul>
        </div>

        <div class="relative mt-10">
          <div class="flex -space-x-2">
            <div v-for="(avatar, i) in avatars" :key="avatar"
                 class="anim-float flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/70 bg-white/20 text-lg backdrop-blur"
                 :style="{ animationDelay: `${i * 250}ms` }">
              {{ avatar }}
            </div>
          </div>
          <p class="mt-3 text-xs text-white/70">Loved by busy families everywhere.</p>
        </div>
      </div>

      <!-- Form panel -->
      <div class="p-6 sm:p-10">
        <div class="mb-6 flex items-center gap-3 lg:hidden">
          <span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-xl text-white shadow-md">🏡</span>
          <span class="text-gradient text-lg font-extrabold">Bogi-Siwi Fam</span>
        </div>

        <h1 class="text-2xl font-extrabold text-gray-800">
          {{ isRegister ? 'Create your account' : 'Welcome back' }}
        </h1>
        <p class="mt-1 text-sm text-gray-500">
          {{ isRegister ? 'Join the family hub in a few seconds.' : 'Sign in to continue to your family hub.' }}
        </p>

        <!-- Mode tabs -->
        <div class="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
          <button type="button" @click="switchMode('login')"
                  class="rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-300"
                  :class="!isRegister ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'">
            Sign in
          </button>
          <button type="button" @click="switchMode('register')"
                  class="rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-300"
                  :class="isRegister ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'">
            Create account
          </button>
        </div>

        <form class="mt-6 space-y-4" @submit.prevent="handleSubmit">
          <div v-if="isRegister" class="anim-fade-up">
            <label for="name" class="mb-1.5 block text-xs font-semibold text-gray-600">Full name</label>
            <input id="name" v-model="name" type="text" autocomplete="name" placeholder="Alex Siwi"
                   class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all duration-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </div>

          <div>
            <label for="email" class="mb-1.5 block text-xs font-semibold text-gray-600">Email address</label>
            <input id="email" v-model="email" type="email" autocomplete="email" placeholder="you@example.com"
                   class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all duration-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </div>

          <div>
            <label for="password" class="mb-1.5 block text-xs font-semibold text-gray-600">Password</label>
            <div class="relative">
              <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'"
                     :autocomplete="isRegister ? 'new-password' : 'current-password'" placeholder="At least 6 characters"
                     class="w-full rounded-xl border border-gray-200 px-4 py-2.5 pr-12 text-sm outline-none transition-all duration-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              <button type="button" @click="showPassword = !showPassword"
                      class="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-sm text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                      :aria-label="showPassword ? 'Hide password' : 'Show password'">
                {{ showPassword ? '🙈' : '👁️' }}
              </button>
            </div>
          </div>

          <div v-if="isRegister" class="anim-fade-up">
            <label for="confirm-password" class="mb-1.5 block text-xs font-semibold text-gray-600">Confirm password</label>
            <input id="confirm-password" v-model="confirmPassword" :type="showPassword ? 'text' : 'password'"
                   autocomplete="new-password" placeholder="Repeat your password"
                   class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all duration-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </div>

          <Transition name="page">
            <div v-if="localError" class="anim-pop rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-medium text-red-600">
              {{ localError }}
            </div>
          </Transition>

          <Transition name="page">
            <div v-if="success" class="anim-pop rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-600">
              {{ success }}
            </div>
          </Transition>

          <button type="submit" :disabled="submitting"
                  class="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-200/70 transition-all duration-300 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70">
            <span v-if="submitting" class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            {{ submitting ? 'Please wait...' : isRegister ? 'Create account' : 'Sign in' }}
          </button>
        </form>

        <div class="my-5 flex items-center gap-3 text-xs font-medium text-gray-400">
          <span class="h-px flex-1 bg-gray-200" />
          or continue with
          <span class="h-px flex-1 bg-gray-200" />
        </div>

        <button type="button" @click="handleGoogle" :disabled="submitting"
                class="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition-all duration-300 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70">
          <svg class="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Continue with Google
        </button>

        <p class="mt-6 text-center text-xs text-gray-400">
          New accounts start as a <span class="font-semibold text-blue-500">member</span>.
        </p>
      </div>
    </div>
  </div>
</template>
