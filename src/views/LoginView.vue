<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const username = ref('')
const password = ref('')
const showPass = ref(false)
const busy = ref(false)
const error = ref('')

async function submit() {
  if (busy.value) return
  error.value = ''
  if (!username.value.trim() || !password.value) {
    error.value = 'Username aur password dono daalo.'
    return
  }
  busy.value = true
  try {
    await auth.login(username.value, password.value)
    router.replace({ name: 'pos' })
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="relative flex min-h-screen flex-col overflow-hidden bg-cream text-ink">
    <!-- soft background blobs -->
    <div class="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-rose blur-3xl"></div>
    <div class="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-wine/15 blur-3xl"></div>

    <!-- top bar -->
    <header class="relative z-10 flex items-center gap-3 px-6 pt-6 md:px-10 md:pt-8">
      <div class="grid h-10 w-10 place-items-center rounded-xl border-2 border-ink bg-white text-[11px] font-black tracking-[.14em]">SSS</div>
      <span class="text-sm font-black tracking-tight">SSS POS</span>
    </header>

    <!-- main -->
    <main class="relative z-10 grid flex-1 place-items-center px-6 py-10">
      <form class="w-full max-w-md" @submit.prevent="submit" novalidate>
        <span class="login-sticker inline-block -rotate-3 rounded-full border-2 border-ink bg-white px-4 py-1.5 text-[11px] font-black uppercase tracking-[.18em]">
          shop counter ✦ v2
        </span>

        <h1 class="mt-5 text-5xl font-black leading-[0.95] tracking-tighter md:text-6xl">
          hey,<br />
          <span class="text-wine">counter</span> khol do.
        </h1>
        <p class="mt-4 text-base font-medium text-black/55">Login karo, bill banao. Bas itna hi.</p>

        <div class="mt-9 space-y-4">
          <div class="field group rounded-2xl border-2 border-ink bg-white px-4 pb-2 pt-3 transition focus-within:-translate-y-0.5 focus-within:shadow-[4px_4px_0_#6E1F2A]">
            <label for="u" class="block text-[10px] font-black uppercase tracking-[.16em] text-black/45">Username</label>
            <input
              id="u"
              v-model="username"
              autocomplete="username"
              autocapitalize="none"
              autofocus
              class="h-9 w-full bg-transparent text-lg font-black outline-none placeholder:text-black/20"
              placeholder="shop ka naam"
            />
          </div>

          <div class="field group rounded-2xl border-2 border-ink bg-white px-4 pb-2 pt-3 transition focus-within:-translate-y-0.5 focus-within:shadow-[4px_4px_0_#6E1F2A]">
            <label for="p" class="block text-[10px] font-black uppercase tracking-[.16em] text-black/45">Password</label>
            <div class="flex items-center gap-2">
              <input
                id="p"
                v-model="password"
                :type="showPass ? 'text' : 'password'"
                autocomplete="current-password"
                class="h-9 w-full bg-transparent text-lg font-black outline-none placeholder:text-black/20"
                placeholder="••••••••"
              />
              <button
                type="button"
                @click="showPass = !showPass"
                :aria-pressed="showPass"
                class="shrink-0 rounded-lg bg-stone-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider"
              >{{ showPass ? 'hide' : 'show' }}</button>
            </div>
          </div>
        </div>

        <p v-if="error" role="alert" class="mt-4 -rotate-1 rounded-2xl border-2 border-ink bg-rose px-4 py-3 text-sm font-black text-wine">
          oops — {{ error }}
        </p>

        <button
          type="submit"
          :disabled="busy"
          class="mt-6 flex h-16 w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-wine text-lg font-black text-white shadow-[4px_4px_0_#151515] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#151515] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-60"
        >
          <span>{{ busy ? 'ek second…' : "let's go" }}</span>
          <span v-if="!busy" aria-hidden="true">→</span>
        </button>

        <p class="mt-6 text-center text-xs font-bold text-black/35">Street Style Store · Shop POS</p>
      </form>
    </main>

    <!-- marquee strip -->
    <div class="relative z-10 overflow-hidden border-t-2 border-ink bg-wine py-2.5" aria-hidden="true">
      <div class="marquee flex w-max gap-8 text-xs font-black uppercase tracking-[.25em] text-white">
        <span v-for="n in 12" :key="n" class="shrink-0">scan ✦ bill ✦ pay ✦ repeat ✦</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.marquee {
  animation: slide 28s linear infinite;
}
@keyframes slide {
  to {
    transform: translateX(-50%);
  }
}
.login-sticker {
  animation: pop 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
@keyframes pop {
  from {
    opacity: 0;
    transform: rotate(-3deg) scale(0.8);
  }
}
</style>