<script setup>
import { computed, ref } from 'vue'
import { usePosStore } from '../stores/pos'
import { money, round2 } from '../utils/format'

const s = usePosStore()

// Backend ke payment ids. UPI ke 3 apps alag ids hain.
const UPI_IDS = ['GooglePay', 'PhonePe', 'Paytm']
const TABS = ['UPI', 'Cash', 'Card', 'Split']

const hasMethod = (id) => s.paymentMethods.some((m) => m.id === id)
const nameOf = (id) => s.paymentMethods.find((m) => m.id === id)?.name || id
const upiApps = UPI_IDS.filter(hasMethod)

const tab = ref('UPI')
const upiApp = ref(upiApps[0] || '')
const cashReceived = ref(s.total)
const cardRef = ref('')
const comments = ref('')
const busy = ref(false)
const error = ref('')

// Split: Cash + UPI
const splitCash = ref(Math.round(s.total / 2))
// Split me UPI app pata na ho to PhonePe default rehta hai
const splitUpiApp = ref(upiApps.includes('PhonePe') ? 'PhonePe' : upiApps[0] || '')
// UPI amount hamesha baaki rahta hai: ek badlo to doosra khud adjust ho jata hai
const splitUpi = computed({
  get: () => Math.max(0, round2(s.total - (Number(splitCash.value) || 0))),
  set: (v) => { splitCash.value = Math.max(0, round2(s.total - (Number(v) || 0))) }
})

const change = computed(() => Math.max(0, round2((Number(cashReceived.value) || 0) - s.total)))

// Tab ke hisaab se backend wali paymentType list banata hai (baaki sab unselected, value "0")
function buildMethods() {
  const list = JSON.parse(JSON.stringify(s.paymentMethods)).map((m) => ({ ...m, selected: false, value: '0' }))
  const set = (id, amount) => {
    const m = list.find((x) => x.id === id)
    if (!m) throw new Error('Ye payment option abhi available nahi hai.')
    m.selected = true
    m.value = String(amount)
  }
  const total = s.total

  if (tab.value === 'UPI') {
    set(upiApp.value, total)
  } else if (tab.value === 'Cash') {
    const received = Number(cashReceived.value) || 0
    if (received + 0.009 < total) throw new Error(`Cash kam hai: ₹${money(round2(total - received))} aur chahiye.`)
    set('Cash', received) // zyada ho to store change kaat kar bhejta hai
  } else if (tab.value === 'Card') {
    set('Credit-Debit Card', total)
  } else {
    const cash = Number(splitCash.value) || 0
    const upi = round2(total - cash)
    if (cash <= 0 || upi <= 0) throw new Error('Split me Cash aur UPI dono 0 se zyada hone chahiye.')
    set('Cash', round2(cash))
    set(splitUpiApp.value, upi)
  }
  return list
}

async function confirm() {
  error.value = ''
  let methods
  try {
    methods = buildMethods()
  } catch (e) {
    error.value = e.message
    return
  }
  const cardNote = tab.value === 'Card' && cardRef.value.trim() ? `Card ref: ${cardRef.value.trim()}` : ''
  const text = [cardNote, comments.value.trim()].filter(Boolean).join(' | ')
  busy.value = true
  try {
    await s.completeSale(methods, text)
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4">
    <div class="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-[32px] bg-white p-5 shadow-2xl md:p-7" role="dialog" aria-modal="true">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-black uppercase tracking-[.2em] text-wine">Payment</p>
          <h3 class="mt-1 text-2xl font-black">Collect ₹{{ money(s.total) }}</h3>
        </div>
        <button @click="s.showPayment = false" aria-label="Close" class="grid h-10 w-10 place-items-center rounded-full bg-stone-100 text-lg">×</button>
      </div>

      <div class="mt-5 grid grid-cols-4 gap-2">
        <button
          v-for="t in TABS"
          :key="t"
          @click="tab = t; error = ''"
          class="h-16 rounded-2xl border text-sm font-black"
          :class="tab === t ? 'border-wine bg-rose text-wine' : 'border-black/10'"
        >{{ t }}</button>
      </div>

      <!-- UPI -->
      <div v-if="tab === 'UPI'" class="mt-4 rounded-2xl bg-stone-50 p-4">
        <p class="text-xs font-black">UPI payment</p>
        <p class="mt-1 text-xs text-black/50">Customer ke phone par payment success dikhe, tabhi Complete dabao.</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="id in upiApps"
            :key="id"
            @click="upiApp = id"
            class="h-11 rounded-xl border px-4 text-xs font-black"
            :class="upiApp === id ? 'border-wine bg-rose text-wine' : 'border-black/10 bg-white'"
          >{{ nameOf(id) }}</button>
        </div>
        <div class="mt-3 grid place-items-center rounded-2xl border border-dashed border-black/20 bg-white py-6">
          <p class="text-xs font-bold text-black/45">Collect via {{ nameOf(upiApp) }}</p>
          <p class="mt-1 text-3xl font-black tracking-tight">₹{{ money(s.total) }}</p>
        </div>
      </div>

      <!-- Cash -->
      <div v-if="tab === 'Cash'" class="mt-4 rounded-2xl bg-stone-50 p-4">
        <label for="cashReceived" class="text-xs font-bold text-black/50">Cash received</label>
        <input id="cashReceived" v-model.number="cashReceived" type="number" inputmode="decimal" class="mt-2 h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-lg font-black outline-none focus:border-black" />
        <p class="mt-2 text-sm font-bold">Change: ₹{{ money(change) }}</p>
      </div>

      <!-- Card -->
      <div v-if="tab === 'Card'" class="mt-4 rounded-2xl bg-stone-50 p-4">
        <p class="text-xs font-black">Card terminal</p>
        <p class="mt-1 text-xs text-black/50">Card payment successful hone ke baad terminal ka approval / reference daalo.</p>
        <input v-model="cardRef" aria-label="Approval or RRN" class="mt-3 h-12 w-full rounded-xl border border-black/10 bg-white px-4 outline-none focus:border-black" placeholder="Approval / RRN" />
      </div>

      <!-- Split: Cash + UPI -->
      <div v-if="tab === 'Split'" class="mt-4 space-y-4 rounded-2xl bg-stone-50 p-4">
        <div>
          <label for="splitCash" class="text-xs font-bold text-black/50">Cash</label>
          <input id="splitCash" v-model.number="splitCash" type="number" min="0" inputmode="decimal" class="mt-1 h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-lg font-black outline-none focus:border-black" />
        </div>
        <div>
          <label for="splitUpi" class="text-xs font-bold text-black/50">UPI amount</label>
          <fieldset class="mt-2">
            <legend class="sr-only">UPI app</legend>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="id in upiApps"
                :key="id"
                class="flex h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs font-black"
                :class="splitUpiApp === id ? 'border-wine bg-rose text-wine' : 'border-black/10 bg-white'"
              >
                <input type="radio" name="splitUpiApp" :value="id" v-model="splitUpiApp" class="h-4 w-4 accent-wine" />
                {{ nameOf(id) }}
              </label>
            </div>
          </fieldset>
          <input id="splitUpi" v-model.number="splitUpi" type="number" min="0" inputmode="decimal" class="mt-2 h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-lg font-black outline-none focus:border-black" />
        </div>
        <p class="text-xs text-black/50">Cash + UPI = ₹{{ money(s.total) }}. Ek amount badlo to doosra apne aap adjust ho jayega.</p>
      </div>

      <textarea v-model="comments" rows="2" aria-label="Comments" placeholder="Comments (optional)" class="mt-4 w-full rounded-2xl border border-black/10 p-3 text-sm outline-none focus:border-black"></textarea>

      <p v-if="error" role="alert" class="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{{ error }}</p>

      <div class="mt-6 flex gap-3">
        <button @click="s.showPayment = false" class="h-14 flex-1 rounded-2xl border border-black/10 font-bold">Back</button>
        <button @click="confirm" :disabled="busy" class="h-14 flex-[1.8] rounded-2xl bg-black font-black text-white disabled:opacity-50">
          {{ busy ? 'Saving order…' : 'Complete & invoice →' }}
        </button>
      </div>
    </div>
  </div>
</template>