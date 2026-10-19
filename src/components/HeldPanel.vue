<script setup>
import { usePosStore } from '../stores/pos'
import { money } from '../utils/format'
const s = usePosStore()
</script>

<template>
  <div v-if="!s.held.length" class="rounded-3xl bg-stone-50 p-8 text-center">
    <p class="text-lg font-black">Koi held bill nahi</p>
    <p class="mt-1 text-sm text-black/45">Cart me Hold dabane par bill yahan aayega.</p>
  </div>
  <div v-for="h in s.held" :key="h.id" class="mb-3 flex flex-col gap-3 rounded-2xl border border-black/10 p-4 md:flex-row md:items-center">
    <div class="flex-1">
      <div class="flex items-center gap-2"><p class="font-black">{{ h.id }}</p><span class="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold">{{ h.time }}</span></div>
      <p class="mt-1 text-xs text-black/45">{{ h.items.length }} lines · {{ h.qty }} pcs · {{ h.customer?.name || 'Customer nahi joda' }}</p>
    </div>
    <p class="text-xl font-black">₹{{ money(h.total) }}</p>
    <div class="flex gap-2">
      <button @click="s.resumeHeld(h.id)" class="h-11 rounded-xl bg-black px-5 text-xs font-black text-white">Resume</button>
      <button @click="s.deleteHeld(h.id)" class="h-11 rounded-xl bg-stone-100 px-4 text-xs font-black text-red-600">Delete</button>
    </div>
  </div>
</template>
