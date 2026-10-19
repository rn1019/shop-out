<script setup>
import { computed, ref } from 'vue'
import { usePosStore } from '../stores/pos'
import { money, num } from '../utils/format'

const s = usePosStore()
const payments = ref(JSON.parse(JSON.stringify(s.summary?.payments || [])))
const variance = computed(() => {
  const c = payments.value.find((x) => x.mode === 'Cash')
  return c ? num(c.counted) - c.system : 0
})
function close() {
  s.flash('Shift summary (demo) ban gayi')
  s.panel = null
}
</script>

<template>
  <p class="mb-4 rounded-xl bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800">Demo numbers: day summary API connect hone par real figures aayenge.</p>
  <div class="grid gap-3 md:grid-cols-4">
    <div v-for="x in s.summary?.totals" :key="x.label" class="rounded-2xl bg-stone-50 p-4"><p class="text-xs font-bold text-black/40">{{ x.label }}</p><p class="mt-2 text-xl font-black">{{ x.value }}</p></div>
  </div>
  <div class="mt-5 rounded-2xl border border-black/10">
    <div class="grid grid-cols-3 bg-stone-50 px-4 py-3 text-xs font-bold text-black/40"><span>Mode</span><span class="text-right">System</span><span class="text-right">Counted</span></div>
    <div v-for="r in payments" :key="r.mode" class="grid grid-cols-3 items-center border-t px-4 py-3 text-sm">
      <b>{{ r.mode }}</b><span class="text-right">₹{{ money(r.system) }}</span>
      <input v-model.number="r.counted" type="number" :aria-label="r.mode + ' counted'" class="ml-auto h-10 w-28 rounded-xl border px-3 text-right font-black" />
    </div>
  </div>
  <div class="mt-4 flex items-center justify-between rounded-2xl p-4" :class="variance === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'">
    <span class="text-sm font-black">Cash variance</span><span class="text-xl font-black">₹{{ money(variance) }}</span>
  </div>
  <textarea class="mt-3 w-full rounded-2xl border border-black/10 p-4 text-sm" rows="3" placeholder="Shift notes / variance reason"></textarea>
  <button @click="close" class="mt-4 h-14 w-full rounded-2xl bg-black font-black text-white">Close shift</button>
</template>
