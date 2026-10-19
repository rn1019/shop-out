<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import * as products from '../services/products'

const input = ref(null)
const query = ref('')
const results = ref([])
const searching = ref(false)
const searched = ref(false)
const searchError = ref('')
const selected = ref(null)
const stock = ref(null)
const loadingStock = ref(false)
const stockError = ref('')
const pickedSize = ref('')

let timer = null
let searchSeq = 0
let stockSeq = 0

onMounted(() => input.value?.focus())
onBeforeUnmount(() => clearTimeout(timer))

function resetSelection() {
  stockSeq++
  selected.value = null
  stock.value = null
  loadingStock.value = false
  stockError.value = ''
  pickedSize.value = ''
}

function onInput(e) {
  query.value = e.target.value
  clearTimeout(timer)
  resetSelection()
  searchError.value = ''
  if (query.value.trim().length < 3) {
    searchSeq++
    results.value = []
    searched.value = false
    searching.value = false
    return
  }
  timer = setTimeout(runSearch, 300)
}

async function runSearch() {
  const seq = ++searchSeq
  searching.value = true
  try {
    const list = await products.searchAllProducts(query.value.trim())
    if (seq !== searchSeq) return
    results.value = list.slice(0, 20)
    searched.value = true
  } catch (e) {
    if (seq !== searchSeq) return
    results.value = []
    searched.value = false
    searchError.value = e.message || 'Search nahi ho paya.'
  } finally {
    if (seq === searchSeq) searching.value = false
  }
}

// Scanner ID type karke Enter dabata hai: ek hi match ho to seedha select
async function onEnter() {
  if (query.value.trim().length < 3 || selected.value) return
  clearTimeout(timer)
  await runSearch()
  if (results.value.length === 1) choose(results.value[0])
}

// Product select hote hi saare shops ka stock API se aata hai
async function choose(p) {
  selected.value = p
  query.value = p.name
  results.value = []
  searched.value = false
  searchError.value = ''
  await loadStock()
}

async function loadStock() {
  const p = selected.value
  if (!p) return
  const seq = ++stockSeq
  stock.value = null
  stockError.value = ''
  pickedSize.value = ''
  loadingStock.value = true
  try {
    const data = await products.getAllShopStock(p.id)
    if (seq === stockSeq) stock.value = data
  } catch (e) {
    if (seq === stockSeq) stockError.value = e.message || 'Stock nahi mil paya.'
  } finally {
    if (seq === stockSeq) loadingStock.value = false
  }
}

function clearAll() {
  resetSelection()
  query.value = ''
  results.value = []
  searched.value = false
  input.value?.focus()
}

const togglePick = (z) => (pickedSize.value = pickedSize.value === z ? '' : z)

// Customer ka size dabane par batata hai kin stores me hai
const reply = computed(() => {
  const z = pickedSize.value
  if (!z || !stock.value) return ''
  const i = stock.value.sizes.indexOf(z)
  const has = stock.value.rows.filter((r) => (r.qty[i] || 0) > 0)
  if (!has.length) return `Size ${z} is out of stock at every store right now.`
  return `Size ${z} is available at ${has.map((r) => `${r.location} (${r.qty[i]})`).join(', ')}.`
})

const qtyClass = (q) => (q === 0 ? 'text-red-500' : q >= 5 ? 'text-emerald-700' : '')
</script>

<template>
  <div>
    <input
      ref="input"
      :value="query"
      @input="onInput"
      @keyup.enter="onEnter"
      aria-label="Search product by ID or name"
      class="h-12 w-full rounded-2xl border border-black/10 bg-stone-50 px-4 outline-none focus:border-black focus:bg-white"
      placeholder="Scan SKU or search item"
    />

    <p v-if="searching" class="mt-3 text-sm text-black/45">Dhundh rahe hain…</p>
    <p v-if="searchError" role="alert" class="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{{ searchError }}</p>

    <ul v-if="results.length" class="mt-3 max-h-72 divide-y overflow-y-auto rounded-2xl border border-black/10">
      <li v-for="p in results" :key="p.id">
        <button @click="choose(p)" class="flex w-full items-center gap-3 p-3 text-left transition hover:bg-stone-50">
          <img v-if="p.img" :src="p.img" :alt="p.name" class="h-12 w-12 shrink-0 rounded-lg object-cover" />
          <span class="min-w-0 flex-1">
            <b class="line-clamp-1 block text-sm">{{ p.name }}</b>
            <span class="text-xs text-black/45">ID {{ p.id }}</span>
          </span>
          <span class="shrink-0 text-xs font-black text-wine">Check stock →</span>
        </button>
      </li>
    </ul>
    <p v-else-if="searched && !searching" class="mt-3 rounded-2xl bg-stone-50 p-5 text-center text-sm text-black/55">Koi product nahi mila.</p>

    <div v-if="selected" class="mt-4">
      <div class="flex items-center gap-3 rounded-2xl bg-stone-50 p-3">
        <img v-if="selected.img" :src="selected.img" :alt="selected.name" class="h-12 w-12 rounded-lg object-cover" />
        <div class="min-w-0 flex-1">
          <p class="line-clamp-1 text-sm font-black">{{ selected.name }}</p>
          <p class="text-xs text-black/45">ID {{ selected.id }}</p>
        </div>
        <button @click="clearAll" class="rounded-xl bg-white px-3 py-2 text-xs font-black">Change</button>
      </div>

      <p v-if="loadingStock" class="mt-4 rounded-2xl bg-stone-50 p-5 text-center text-sm font-bold text-black/45">Saare shops me stock check ho raha hai…</p>

      <div v-else-if="stockError" role="alert" class="mt-4 flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        <span>{{ stockError }}</span>
        <button @click="loadStock" class="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-black">Retry</button>
      </div>

      <template v-else-if="stock">
        <p v-if="!stock.rows.length || !stock.sizes.length" class="mt-4 rounded-2xl bg-stone-50 p-5 text-center text-sm text-black/55">Is product ka stock kisi shop me nahi mila.</p>
        <template v-else>
          <p class="mt-4 text-xs text-black/40"></p>
          <div class="mt-2 overflow-x-auto rounded-2xl border border-black/10">
            <table class="w-full min-w-[560px] text-left text-sm">
              <thead class="bg-stone-50 text-[10px] uppercase tracking-wider text-black/45">
                <tr>
                  <th class="px-4 py-3">Location</th>
                  <th v-for="z in stock.sizes" :key="z" class="p-1 text-center">
                    <button @click="togglePick(z)" :aria-pressed="pickedSize === z" class="w-full rounded-lg px-3 py-2 font-bold uppercase tracking-wider" :class="pickedSize === z ? 'bg-wine text-white' : ''">{{ z }}</button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, ri) in stock.rows" :key="ri" class="border-t">
                  <td class="px-4 py-4 font-black">
                    {{ r.location }}
                    <div v-if="r.note" class="text-[10px] font-medium text-black/35">{{ r.note }}</div>
                  </td>
                  <td v-for="(z, i) in stock.sizes" :key="z" class="px-4 py-4 text-center font-black" :class="[qtyClass(r.qty[i]), pickedSize === z ? 'bg-rose' : '']">
                    {{ r.qty[i] === null ? '–' : r.qty[i] }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </template>

      <div v-if="reply" class="mt-4 rounded-2xl bg-rose p-4 text-sm"><b>Suggested cashier reply:</b> “{{ reply }}”</div>
    </div>
  </div>
</template>