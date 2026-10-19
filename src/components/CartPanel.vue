<script setup>
import { ref } from 'vue'
import { usePosStore } from '../stores/pos'
import { money } from '../utils/format'

// Ek hi baar declare karna hai
const showConfirmModal = ref(false)
const s = usePosStore()

// Dropdown me sirf in-stock sizes; cart item ka current size hamesha dikhe
const sizeList = (item) => (item.sizes?.includes(item.size) ? item.sizes : [item.size, ...(item.sizes || [])])

// Aapka naya clear function
function clear() {
  if (s.cart.length) {
    showConfirmModal.value = true // Browser alert ki jagah apna modal open karega
  }
}

// Jab user 'Yes' pe click kare
function confirmClear() {
  s.cancelSale()
  showConfirmModal.value = false // Cart clear karke modal band kar dega
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between border-b border-black/5 px-5 py-4">
      <div>
        <p class="text-xs font-bold text-wine">Current bill</p>
        <h2 class="text-xl font-black">Cart <span class="text-black/30">{{ s.cartQty }}</span></h2>
      </div>
      <div class="flex gap-2">
        <button @click="s.holdCart()" class="rounded-xl bg-stone-100 px-3 py-2 text-xs font-black">Hold</button>
        <button @click="clear" :disabled="!s.cart.length" class="rounded-xl bg-stone-100 px-3 py-2 text-xs font-black text-red-600 disabled:opacity-30">Clear</button>
      </div>
    </div>

    <div v-if="!s.cart.length" class="grid flex-1 place-items-center px-8 text-center">
      <div>
        <div class="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-stone-100 text-2xl">⌁</div>
        <h3 class="mt-4 text-lg font-black">Ready to scan</h3>
        <p class="mt-1 text-sm leading-6 text-black/45">Barcode scan karo ya product par tap karke bill shuru karo.</p>
      </div>
    </div>

    <div v-else class="hide-scrollbar flex-1 overflow-y-auto px-4 py-3">
      <div v-for="(item, i) in s.cart" :key="item.lineId" class="mb-3 rounded-2xl border bg-stone-50 p-3" :class="s.issueIds.includes(String(item.id)) ? 'border-red-300' : 'border-black/5'">
        <div class="flex gap-3">
          <img :src="item.img" :alt="item.name" class="h-16 w-16 rounded-xl object-cover" />
          <div class="min-w-0 flex-1">
            <div class="flex gap-2">
              <p class="line-clamp-2 flex-1 text-xs font-black leading-5">{{ item.name }}</p>
              <p class="text-sm font-black">₹{{ money(item.price * item.qty) }}</p>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <select :value="item.size" @change="s.changeSize(i, $event.target.value)" :aria-label="'Size ' + item.name" class="h-8 rounded-lg border border-black/10 bg-white px-2 text-[11px] font-bold">
                <option v-for="z in sizeList(item)" :key="z" :value="z">{{ z }}{{ item.stock?.[z] != null ? ' · ' + item.stock[z] + ' left' : '' }}</option>
              </select>
              <span class="text-[10px] text-black/40">{{ item.sku }}</span>
              <span v-if="s.issueIds.includes(String(item.id))" class="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Unavailable</span>
            </div>
          </div>
        </div>
        <div class="mt-3 flex items-center justify-between">
          <div class="flex items-center overflow-hidden rounded-xl border border-black/10 bg-white">
            <button @click="s.changeQty(i, -1)" aria-label="Decrease" class="h-9 w-9 font-black">−</button>
            <span class="grid h-9 min-w-9 place-items-center border-x text-xs font-black">{{ item.qty }}</span>
            <button @click="s.changeQty(i, 1)" aria-label="Increase" class="h-9 w-9 font-black">+</button>
          </div>
          <button @click="s.removeItem(i)" class="text-[11px] font-bold text-red-500">Remove</button>
        </div>
      </div>
    </div>

    <div class="border-t border-black/5 bg-white p-4">
      <button @click="s.panel = 'customer'" class="mb-3 flex h-11 w-full items-center justify-between rounded-xl px-3 text-xs font-black" :class="s.customer ? 'bg-emerald-50 text-emerald-800' : 'bg-rose text-wine'">
        <span class="truncate">{{ s.customer ? s.customer.name : '+ Add customer' }}</span>
        <span>{{ s.customer ? s.customer.mobile_number : 'Mobile se dhundo' }}</span>
      </button>

      <p v-if="s.cartIssue" role="alert" class="mb-3 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">{{ s.cartIssue }}</p>

      <div class="space-y-2 text-sm" :class="s.syncing ? 'opacity-50' : ''">
        <div class="flex justify-between text-black/55"><span>Subtotal (GST se pehle)</span><b class="text-black">₹{{ money(s.totals.subtotal) }}</b></div>
        <div v-for="(r, i) in s.cartRules" :key="i" class="flex justify-between text-emerald-700"><span>{{ r.code || r.name || 'Discount' }}</span><b>-₹{{ money(r.reduction_amount) }}</b></div>
        <div v-if="!s.cartRules.length && s.totals.discount" class="flex justify-between text-emerald-700"><span>Discount</span><b>-₹{{ money(s.totals.discount) }}</b></div>
        <div class="flex justify-between text-black/55"><span>GST</span><b class="text-black">₹{{ money(s.totals.gst) }}</b></div>
        <div class="my-3 border-t border-dashed border-black/10"></div>
        <div class="flex items-end justify-between"><span class="text-sm font-black">Total</span><span class="text-3xl font-black tracking-tight">₹{{ money(s.total) }}</span></div>
      </div>

      <button :disabled="!s.cart.length || s.syncing" @click="s.openPayment()" class="mt-4 h-14 w-full rounded-2xl bg-wine text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-30">
        {{ s.syncing ? 'Updating…' : 'Pay ₹' + money(s.total) }}
      </button>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <button @click="s.panel = 'exchange'" class="h-10 rounded-xl bg-stone-100 text-[11px] font-black">Exchange</button>
        <button @click="s.panel = 'receipt'" :disabled="!s.lastInvoice" class="h-10 rounded-xl bg-stone-100 text-[11px] font-black disabled:opacity-30">Last receipt</button>
      </div>
    </div>
    <!-- Custom Confirmation Modal -->
<Transition name="fade">
  <div v-if="showConfirmModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
    
    <!-- Modal Card -->
    <div class="w-full max-w-sm scale-100 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl transition-transform">
      <div class="mb-6 text-center">
        <!-- Warning Icon -->
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h3 class="text-lg font-bold text-white">Poora bill clear karna hai?</h3>
        <p class="mt-2 text-sm text-zinc-400">Ye action wapas undo nahi hoga. Cart ke saare items delete ho jayenge.</p>
      </div>
      
      <!-- Buttons -->
      <div class="flex gap-3">
        <button 
          @click="showConfirmModal = false" 
          class="flex-1 rounded-xl border border-zinc-800 bg-transparent py-3 text-sm font-bold text-zinc-300 transition-all hover:bg-zinc-900 active:scale-[0.98]"
        >
          Cancel
        </button>
        <button 
          @click="confirmClear" 
          class="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition-all hover:bg-red-700 active:scale-[0.98] shadow-lg shadow-red-900/20"
        >
          Haan, Clear Karo
        </button>
      </div>
    </div>
    
  </div>
</Transition>
  </div>
</template>