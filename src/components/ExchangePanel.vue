<script setup>
import { computed, onMounted, ref } from 'vue'
import * as products from '../services/products'
import { usePosStore } from '../stores/pos'
import { money } from '../utils/format'

const s = usePosStore()
const step = ref(1)
const source = ref('Store')
const lookup = ref('')
const purchase = ref(null)
const reason = ref('Need bigger size')
const options = ref([])
const replacement = ref(null)
const busy = ref(false)
const error = ref('')

onMounted(async () => { options.value = (await products.searchProducts('', 'All')).slice(0, 4) })
const diff = computed(() => (replacement.value?.price || 0) - (purchase.value?.item.price || 0))

async function find() {
  error.value = ''
  busy.value = true
  try { purchase.value = await products.findPurchase(source.value, lookup.value.trim()); step.value = 2 }
  catch (e) { error.value = e.message } finally { busy.value = false }
}
async function done() {
  busy.value = true
  await products.completeExchange()
  busy.value = false
  s.flash(diff.value >= 0 ? 'Exchange complete (demo): amount collect karo' : 'Exchange complete (demo): refund do')
  s.panel = null
}
</script>

<template>
  <p class="mb-4 rounded-xl bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800">Demo flow: exchange API connect hone tak ye sirf screen par chalta hai.</p>
  <div class="mb-5 flex items-center gap-2">
    <template v-for="n in 4" :key="n">
      <div class="grid h-8 w-8 place-items-center rounded-full text-xs font-black" :class="step >= n ? 'bg-wine text-white' : 'bg-stone-100 text-black/35'">{{ n }}</div>
      <div v-if="n < 4" class="h-0.5 flex-1" :class="step > n ? 'bg-wine' : 'bg-stone-200'"></div>
    </template>
  </div>

  <div v-if="step === 1">
    <p class="text-sm font-black">Original purchase dhundo</p>
    <div class="mt-3 grid gap-3 md:grid-cols-2">
      <button v-for="o in ['Store', 'Online']" :key="o" @click="source = o" class="rounded-2xl border-2 p-5 text-left" :class="source === o ? 'border-wine bg-rose' : 'border-black/10'">
        <p class="font-black">{{ o }} purchase</p><p class="mt-1 text-xs text-black/45">{{ o === 'Store' ? 'Bill number' : 'Order ID' }}</p>
      </button>
    </div>
    <input v-model="lookup" @keyup.enter="find" class="mt-4 h-12 w-full rounded-2xl border border-black/10 px-4 outline-none focus:border-black" placeholder="Bill / order ID" />
    <p v-if="error" role="alert" class="mt-2 text-sm font-semibold text-red-600">{{ error }}</p>
    <button @click="find" :disabled="busy" class="mt-4 h-12 w-full rounded-2xl bg-black font-black text-white disabled:opacity-50">Find purchase</button>
  </div>

  <div v-if="step === 2 && purchase">
    <p class="text-sm font-black">Wapas aane wala item</p>
    <div class="mt-3 flex gap-4 rounded-2xl border p-4">
      <img :src="purchase.item.img" :alt="purchase.item.name" class="h-20 w-20 rounded-xl object-cover" />
      <div class="flex-1"><p class="font-black">{{ purchase.item.name }}</p><p class="mt-1 text-xs text-black/45">{{ purchase.item.sku }} · Size {{ purchase.item.size }} · Qty {{ purchase.item.qty }}</p><p class="mt-2 font-black">₹{{ money(purchase.item.price) }}</p></div>
    </div>
    <select v-model="reason" class="mt-3 h-12 w-full rounded-xl border px-3"><option>Need bigger size</option><option>Need smaller size</option><option>Style change</option><option>Defective</option><option>Other</option></select>
    <button @click="step = 3" class="mt-4 h-12 w-full rounded-2xl bg-black font-black text-white">Replacement chuno</button>
  </div>

  <div v-if="step === 3">
    <p class="text-sm font-black">Replacement</p>
    <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
      <button v-for="p in options" :key="p.id" @click="replacement = p" class="overflow-hidden rounded-2xl border text-left" :class="replacement?.id === p.id ? 'border-2 border-wine' : 'border-black/10'">
        <img :src="p.img" :alt="p.name" class="aspect-square w-full object-cover" />
        <div class="p-2"><p class="line-clamp-2 text-[11px] font-black">{{ p.name }}</p><p class="mt-1 text-xs font-black">₹{{ money(p.price) }}</p></div>
      </button>
    </div>
    <button :disabled="!replacement" @click="step = 4" class="mt-4 h-12 w-full rounded-2xl bg-black font-black text-white disabled:opacity-30">Difference dekho</button>
  </div>

  <div v-if="step === 4">
    <div class="rounded-2xl bg-stone-50 p-4">
      <div class="flex justify-between text-sm"><span>Return credit</span><b>₹{{ money(purchase.item.price) }}</b></div>
      <div class="mt-2 flex justify-between text-sm"><span>Replacement</span><b>₹{{ money(replacement.price) }}</b></div>
      <div class="my-3 border-t border-dashed"></div>
      <div class="flex justify-between text-lg font-black"><span>{{ diff >= 0 ? 'Collect' : 'Refund' }}</span><span>₹{{ money(Math.abs(diff)) }}</span></div>
    </div>
    <button @click="done" :disabled="busy" class="mt-4 h-12 w-full rounded-2xl bg-wine font-black text-white disabled:opacity-50">Complete exchange</button>
  </div>
</template>
