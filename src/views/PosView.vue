<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { usePosStore } from '../stores/pos'
import { money } from '../utils/format'
import { printElement } from '../utils/print'
import Modal from '../components/Modal.vue'
import CartPanel from '../components/CartPanel.vue'
import PaymentModal from '../components/PaymentModal.vue'
import CustomerPanel from '../components/CustomerPanel.vue'
import HeldPanel from '../components/HeldPanel.vue'
import StockPanel from '../components/StockPanel.vue'
import ExchangePanel from '../components/ExchangePanel.vue'
import ReconcilePanel from '../components/ReconcilePanel.vue'
import ReceiptView from '../components/ReceiptView.vue'

const auth = useAuthStore()
const s = usePosStore()
const scanInput = ref(null)
const online = ref(navigator.onLine)

const panels = { customer: CustomerPanel, held: HeldPanel, stock: StockPanel, exchange: ExchangePanel, reconcile: ReconcilePanel, receipt: ReceiptView }
const titles = { customer: 'Customer', held: 'Held bills', stock: 'Stock lookup', exchange: 'Exchange / return', reconcile: 'End-of-shift', receipt: 'Receipt', more: 'More' }
const moreTools = [
  { label: 'Held bills', panel: 'held' },
  { label: 'Last receipt', panel: 'receipt' },
  { label: 'Shift summary', panel: 'reconcile' },
  { label: 'Stock lookup', panel: 'stock' }
]
const kpis = computed(() => s.summary?.kpis || [])

let timer = null
watch(() => s.query, () => { clearTimeout(timer); timer = setTimeout(s.runSearch, 250) })
watch(() => s.category, () => s.runSearch())

// ---------- size filter ----------
const selectedSize = ref('')
const APPAREL_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL', 'XS/S/M', 'L/XL']
const sizeRank = (z) => {
  if (/^\d+(\.\d+)?$/.test(z)) return [0, parseFloat(z)]
  const i = APPAREL_ORDER.indexOf(z)
  return i >= 0 ? [1, i] : [2, 0]
}
const qtyIn = (p, z) => p._rawSizes?.find((r) => r.label === z)?.qty ?? 0
const hasStockIn = (p, z) => (p._rawSizes ? qtyIn(p, z) > 0 : (p.sizes || []).includes(z))
// Sirf wahi sizes jinka stock hai (card ke chips ke liye)
const inStockSizes = (p) => (p._rawSizes ? p._rawSizes.filter((r) => r.qty > 0).map((r) => r.label) : p.sizes || [])

// Current search/category ki list me jin sizes ka stock hai (aur kitne products me)
const sizeOptions = computed(() => {
  const counts = new Map()
  for (const p of s.products) {
    for (const z of p.sizes || []) if (hasStockIn(p, z)) counts.set(z, (counts.get(z) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([size, count]) => ({ size, count }))
    .sort((a, b) => {
      const [ga, va] = sizeRank(a.size)
      const [gb, vb] = sizeRank(b.size)
      return ga - gb || va - vb || a.size.localeCompare(b.size)
    })
})
const filteredProducts = computed(() =>
  selectedSize.value ? s.products.filter((p) => hasStockIn(p, selectedSize.value)) : s.products
)
// Category/search badalne par wo size list me na rahe to filter hata do
watch(sizeOptions, (opts) => {
  if (selectedSize.value && !opts.some((o) => o.size === selectedSize.value)) selectedSize.value = ''
})
const toggleSize = (z) => (selectedSize.value = selectedSize.value === z ? '' : z)

// ---------- lazy load: pehle thode products, scroll karne par baaki ----------
const PAGE_SIZE = 24
const visibleCount = ref(PAGE_SIZE)
const visibleProducts = computed(() => filteredProducts.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < filteredProducts.value.length)
const sentinel = ref(null)
let observer = null

function loadMore() {
  if (!hasMore.value) return
  visibleCount.value += PAGE_SIZE
  // sentinel abhi bhi screen par ho (bada screen) to observer ko dubara trigger karao
  nextTick(() => {
    if (observer && sentinel.value) {
      observer.unobserve(sentinel.value)
      observer.observe(sentinel.value)
    }
  })
}
// Search / category / refresh par nayi list aati hai: wapas pehle page se shuru
watch([() => s.products, selectedSize], () => { visibleCount.value = PAGE_SIZE })
watch(sentinel, (el, prev) => {
  if (!observer) return
  if (prev) observer.unobserve(prev)
  if (el) observer.observe(el)
})

async function handleEnter() {
  clearTimeout(timer)
  const list = await s.runSearch()
  if (list.length === 1) {
    s.addProduct(list[0])
    s.query = ''
  }
}
function pick(p) {
  s.addProduct(p, selectedSize.value || undefined) // size filter laga ho to wahi size cart me jayega
  s.query = ''
  scanInput.value?.focus()
}
// Card ke size chip par tap: wahi size seedha cart me
function pickSize(p, z) {
  s.addProduct(p, z)
  s.query = ''
  scanInput.value?.focus()
}
const showSignOutModal = ref(false)

// Naya signOut function
function signOut() {
  if (s.cart.length) {
    showSignOutModal.value = true // Cart me items hain to modal open karein
  } else {
    confirmSignOut() // Cart khali hai to direct sign out kar dein
  }
}

// Jab user Modal mein 'Haan' par click kare
function confirmSignOut() {
  showSignOutModal.value = false
  auth.logout()
  // page reload se pinia state (cart, customer) bhi saaf ho jaata hai
  window.location.hash = '#/login'
  window.location.reload()
}

// Purane shortcuts: Alt+C cancel, Alt+S complete, Alt+N new sale, Alt+P print
function onKey(e) {
  if (!e.altKey) return
  const k = e.key.toLowerCase()
  if (k === 'c') { e.preventDefault(); if (s.cart.length && confirm('Poora bill clear karna hai?')) s.cancelSale() }
  else if (k === 's') { e.preventDefault(); s.openPayment() }
  else if (k === 'n') { e.preventDefault(); s.panel = null; scanInput.value?.focus() }
  else if (k === 'p' && s.panel === 'receipt') { e.preventDefault(); printElement('printSale') }
}
const setOnline = () => (online.value = navigator.onLine)

onMounted(() => {
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) loadMore() },
      { rootMargin: '600px 0px' } // list ke end se 600px pehle hi agla page load
    )
    if (sentinel.value) observer.observe(sentinel.value)
  }
  s.init()
  scanInput.value?.focus()
  window.addEventListener('keydown', onKey)
  window.addEventListener('online', setOnline)
  window.addEventListener('offline', setOnline)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('online', setOnline)
  window.removeEventListener('offline', setOnline)
})
</script>

<template>
  <div class="min-h-screen">
    <header class="sticky top-0 z-40 border-b border-black/5 bg-white/95 backdrop-blur">
      <div class="flex h-16 items-center gap-3 px-3 md:px-5">
        <div class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-ink text-xs font-black tracking-[.16em] text-white">SSS</div>
        <div class="min-w-0">
          <h1 class="truncate text-sm font-black md:text-base">SSS POS</h1>
          <p class="truncate text-[11px] text-black/45">Shop #{{ auth.idWarehouse }} · {{ auth.session?.username }}</p>
        </div>
        <div class="ml-auto hidden items-center gap-2 md:flex">
          <span class="rounded-xl border px-3 py-2.5 text-xs font-bold" :class="online ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-800'">
            <span class="mr-1.5 inline-block h-2 w-2 rounded-full" :class="online ? 'bg-emerald-500' : 'bg-amber-500'"></span>{{ online ? 'Online' : 'Offline' }}
          </span>
          <button @click="s.panel = 'held'" class="touch rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold">Held {{ s.held.length }}</button>
          <button @click="s.panel = 'reconcile'" class="touch rounded-xl bg-black px-3 text-xs font-bold text-white">End shift</button>
          <button @click="signOut" class="touch rounded-xl border border-black/10 px-3 text-xs font-semibold">Sign out</button>
        </div>
        <button @click="s.mobileCartOpen = true" class="relative ml-auto rounded-xl bg-wine px-4 py-2 text-sm font-black text-white lg:hidden">
          Cart ₹{{ money(s.total) }}
          <span class="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-[11px] font-black text-wine shadow">{{ s.cartQty }}</span>
        </button>
      </div>
      <p v-if="!online" class="bg-amber-50 px-4 py-1.5 text-center text-xs font-bold text-amber-800">Internet nahi hai. Sale complete karne ke liye connection chahiye.</p>
    </header>

    <main class="grid min-h-[calc(100vh-64px)] grid-cols-1 lg:grid-cols-[1fr_430px]">
      <section class="min-w-0 border-r border-black/5 bg-stone-50 p-3 pb-28 md:p-5 lg:pb-5">
        <div class="rounded-3xl bg-white p-3 shadow-soft md:p-4">
          <div class="relative">
            <svg class="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black/35" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="11" cy="11" r="8" stroke-width="2" /><path d="m21 21-4.35-4.35" stroke-width="2" /></svg>
            <input ref="scanInput" v-model.trim="s.query" @keyup.enter="handleEnter" aria-label="Scan or search" class="h-14 w-full rounded-2xl border border-black/10 bg-stone-50 pl-12 pr-4 text-base font-semibold outline-none transition focus:border-black focus:bg-white" placeholder="Barcode scan karo ya SKU / naam se dhundo…" />
          </div>
          <div class="mt-3 flex items-center justify-between gap-3">
            <div class="hide-scrollbar flex gap-2 overflow-x-auto">
              <button v-for="c in s.categories" :key="c" @click="s.category = c" class="touch shrink-0 rounded-xl px-3 text-xs font-bold transition" :class="s.category === c ? 'bg-wine text-white' : 'bg-stone-100 text-black/60'">{{ c }}</button>
            </div>
            <button @click="s.panel = 'stock'" class="hidden shrink-0 text-xs font-bold text-wine md:block">Store stock dekho</button>
          </div>
          <div v-if="sizeOptions.length" class="mt-3 flex items-center gap-3 border-t border-black/5 pt-3">
            <span class="shrink-0 text-[11px] font-black uppercase tracking-wider text-black/40">Size</span>
            <div class="hide-scrollbar flex gap-2 overflow-x-auto" role="group" aria-label="Size se filter karo">
              <button @click="selectedSize = ''" :aria-pressed="!selectedSize" class="h-10 min-w-[44px] shrink-0 rounded-full border px-4 text-sm font-semibold transition" :class="!selectedSize ? 'border-ink bg-ink text-white' : 'border-black/15 bg-white text-black/70 hover:border-black/40'">All</button>
              <button v-for="o in sizeOptions" :key="o.size" @click="toggleSize(o.size)" :aria-pressed="selectedSize === o.size" :aria-label="'Size ' + o.size + ', ' + o.count + ' products'" class="h-10 min-w-[44px] shrink-0 rounded-full border px-4 text-sm font-semibold transition" :class="selectedSize === o.size ? 'border-ink bg-ink text-white' : 'border-black/15 bg-white text-black/70 hover:border-black/40'">
                {{ o.size }}<span class="ml-1 text-[10px] opacity-50">{{ o.count }}</span>
              </button>
            </div>
          </div>
        </div>

        <div v-if="kpis.length" class="mt-4">
          <div class="grid grid-cols-3 gap-2 md:grid-cols-5">
            <div v-for="(k, i) in kpis" :key="k.label" class="rounded-2xl bg-white p-3" :class="i > 2 ? 'hidden md:block' : ''">
              <p class="text-[11px] font-bold text-black/40">{{ k.label }}</p>
              <p class="mt-1 text-lg font-black">{{ k.value }}</p>
            </div>
          </div>
        </div>
        <hr>
        <div class="mt-5 flex items-end justify-between">
          <h2 class="text-lg font-black uppercase tracking-tight">{{ s.query ? 'Search results' : 'Products' }} <span class="text-black/30">{{ filteredProducts.length }}</span></h2>
          <p class="text-xs text-black/40">Tap karke bill me add karo</p>
        </div>
        <hr>
        <div v-if="s.loadingProducts && !s.products.length" class="mt-6 text-sm text-black/45">Products load ho rahe hain…</div>
        <div v-else-if="!filteredProducts.length" class="mt-4 rounded-3xl bg-white p-8 text-center"><p class="font-black">Kuch nahi mila</p><p class="mt-1 text-sm text-black/45">{{ selectedSize ? 'Size ' + selectedSize + ' ka stock nahi hai.' : 'Doosra naam ya SKU try karo.' }}</p></div>
        <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <article v-for="p in visibleProducts" :key="p.id" class="group flex flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm transition hover:shadow-soft" :class="inStockSizes(p).length ? '' : 'opacity-60'">
            <button @click="pick(p)" class="block w-full text-left" :aria-label="'Add ' + p.name">
              <div class="relative aspect-[5/6] overflow-hidden bg-stone-100">
                <img :src="p.img" :alt="p.name" loading="lazy" class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                <span v-if="p.badge" class="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold shadow tracking-wide text-red-700">{{ p.badge }}</span>
                <span v-if="!inStockSizes(p).length" class="absolute inset-x-0 bottom-0 bg-red-600/90 py-1 text-center text-[11px] font-black uppercase tracking-wider text-white">Out of stock</span>
              </div>
              <div class="px-3 pt-3">
                <p class="mt-2 line-clamp-2 min-h-10 text-sm font-bold leading-5">{{ p.name }}</p>
                <div class="mt-1 flex items-baseline justify-between gap-2">
                  <p class="text-lg font-black">₹{{ money(p.price) }}</p>
                  <span class="text-[10px] text-black/35">#{{ p.id }}</span>
                </div>
              </div>
            </button>
            <div class="mt-auto px-3 pb-3 pt-2">
              <div v-if="inStockSizes(p).length" class="flex flex-wrap gap-1.5">
                <button
                  v-for="z in inStockSizes(p)"
                  :key="z"
                  @click="pickSize(p, z)"
                  :aria-label="'Add size ' + z + ', ' + qtyIn(p, z) + ' left'"
                  :title="qtyIn(p, z) + ' left'"
                  class="h-8 min-w-8 rounded-full border px-2 text-[11px] font-bold transition"
                  :class="selectedSize === z ? 'border-ink bg-ink text-white' : 'border-black/15 text-black/70 hover:border-wine hover:bg-rose hover:text-wine'"
                >{{ z }}</button>
              </div>
              <p v-else class="text-[11px] font-bold text-red-600">Kisi size me stock nahi</p>
            </div>
          </article>
        </div>
        <div v-if="hasMore" ref="sentinel" class="mt-4 flex justify-center pb-2">
          <button @click="loadMore" class="rounded-xl bg-white px-5 py-3 text-xs font-black text-black/55 shadow-sm">Aur dikhao · {{ filteredProducts.length - visibleCount }} baaki</button>
        </div>
        <p v-else-if="filteredProducts.length > PAGE_SIZE" class="mt-4 text-center text-xs text-black/35">Saare {{ filteredProducts.length }} products dikh gaye.</p>
      </section>

      <aside class="desktop-only sticky top-16 h-[calc(100vh-64px)] bg-white"><CartPanel /></aside>
    </main>

    <nav class="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-black/10 bg-white p-2 lg:hidden">
      <button @click="s.panel = null; s.mobileCartOpen = false" class="touch rounded-xl bg-rose text-[11px] font-black text-wine">Sell</button>
      <button @click="s.panel = 'exchange'" class="touch rounded-xl text-[11px] font-bold text-black/55">Exchange</button>
      <button @click="s.panel = 'customer'" class="touch rounded-xl text-[11px] font-bold text-black/55">Customer</button>
      <button @click="s.panel = 'stock'" class="touch rounded-xl text-[11px] font-bold text-black/55">Stock</button>
      <button @click="s.panel = 'more'" class="touch rounded-xl text-[11px] font-bold text-black/55">More</button>
    </nav>

    <div v-if="s.mobileCartOpen" class="fixed inset-0 z-50 lg:hidden">
      <button @click="s.mobileCartOpen = false" aria-label="Close cart" class="absolute inset-0 bg-black/35"></button>
      <div class="absolute bottom-0 left-0 right-0 max-h-[92vh] overflow-hidden rounded-t-[32px] bg-white shadow-2xl">
        <div class="mx-auto mt-2 h-1.5 w-12 rounded-full bg-black/15"></div>
        <div class="h-[calc(92vh-12px)]"><CartPanel /></div>
      </div>
    </div>

    <PaymentModal v-if="s.showPayment" />

    <Modal v-if="s.panel" :title="titles[s.panel]" :size="s.panel === 'more' ? 'max-w-xl' : 'max-w-4xl'" @close="s.panel = null">
      <component :is="panels[s.panel]" v-if="panels[s.panel]" />
      <div v-else class="grid grid-cols-2 gap-3">
        <button v-for="t in moreTools" :key="t.label" @click="s.panel = t.panel" class="h-24 rounded-2xl border border-black/10 bg-stone-50 text-sm font-black hover:bg-white">{{ t.label }}</button>
        <button @click="signOut" class="col-span-2 h-14 rounded-2xl bg-black text-sm font-black text-white">Sign out</button>
      </div>
    </Modal>

    <div v-if="s.toast" role="status" class="fixed bottom-24 left-1/2 z-[90] max-w-[90vw] -translate-x-1/2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-xl lg:bottom-6" :class="s.toast.type === 'error' ? 'bg-red-700' : 'bg-black'">{{ s.toast.text }}</div>
  </div>
  <!-- Sign Out Confirmation Modal -->
  <Transition name="fade">
      <div v-if="showSignOutModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
        
        <!-- Modal Card -->
        <div class="w-full max-w-sm scale-100 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl transition-transform">
          <div class="mb-6 text-center">
            <!-- Warning Icon (Amber/Yellow for sign out warning) -->
            <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h3 class="text-lg font-bold text-white">Bill adhura hai!</h3>
            <p class="mt-2 text-sm text-zinc-400">Cart mein items hain. Agar aap abhi sign out karenge, toh current bill clear ho jayega.</p>
          </div>
          
          <!-- Buttons -->
          <div class="flex gap-3">
            <button 
              @click="showSignOutModal = false" 
              class="flex-1 rounded-xl border border-zinc-800 bg-transparent py-3 text-sm font-bold text-zinc-300 transition-all hover:bg-zinc-900 active:scale-[0.98]"
            >
              Cancel
            </button>
            <button 
              @click="confirmSignOut" 
              class="flex-1 rounded-xl bg-amber-600 py-3 text-sm font-bold text-white transition-all hover:bg-amber-700 active:scale-[0.98] shadow-lg shadow-amber-900/20"
            >
              Haan, Sign Out
            </button>
          </div>
        </div>
        
      </div>
    </Transition>
</template>