<script setup>
import { ref, watch } from 'vue'
import { usePosStore } from '../stores/pos'
import * as customerApi from '../services/customer'
import * as products from '../services/products'
import { money } from '../utils/format'

const s = usePosStore()
const text = ref('')
const results = ref([])
const searching = ref(false)
const searched = ref(false)
const creating = ref(false)
const busy = ref(false)
const form = ref({ mobileNumber: '', firstName: '', lastName: '', email: '' })
const formError = ref('')

let timer = null
let seq = 0
watch(text, (v) => {
  clearTimeout(timer)
  searched.value = false
  if (v.trim().length < 3) { results.value = []; return }
  timer = setTimeout(async () => {
    const my = ++seq
    searching.value = true
    try {
      const r = await customerApi.searchCustomer(v.trim())
      if (my === seq) { results.value = r; searched.value = true }
    } catch (e) {
      s.flash(e.message, 'error')
    } finally {
      if (my === seq) searching.value = false
    }
  }, 350)
})

async function pick(c) {
  await s.selectCustomer(c)
}
function startCreate() {
  const t = text.value.trim()
  form.value = { mobileNumber: /^\d+$/.test(t) ? t : '', firstName: /^\d+$/.test(t) ? '' : t.split(' ')[0] || '', lastName: /^\d+$/.test(t) ? '' : t.split(' ')[1] || '', email: '' }
  formError.value = ''
  creating.value = true
}
async function saveNew() {
  if (!/^\d{10}$/.test(form.value.mobileNumber)) { formError.value = '10 digit ka mobile number daalo.'; return }
  busy.value = true
  try {
    await s.createCustomer(form.value)
    creating.value = false
  } catch (e) {
    formError.value = e.message
  } finally {
    busy.value = false
  }
}
async function voucherTap() {
  try { await products.applyVoucher() } catch (e) { s.flash(e.message, 'error') }
}
</script>

<template>
  <!-- Attached customer -->
  <section v-if="s.customer">
    <div class="rounded-3xl bg-rose p-5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-lg font-black">{{ s.customer.name }}</p>
          <p class="mt-1 text-sm text-black/60">{{ s.customer.mobile_number }} · {{ s.customer.email }}</p>
          <p v-if="s.customer.isDummy" class="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800">Demo customer: sale ke liye real customer chuno</p>
        </div>
        <div class="flex gap-2">
          <button @click="s.removeCustomer()" class="rounded-xl bg-white px-4 py-2 text-xs font-black text-red-600">Remove</button>
          <button @click="s.panel = null" class="rounded-xl bg-wine px-4 py-2 text-xs font-black text-white">Done</button>
        </div>
      </div>
      <p v-if="s.loadingDetails" class="mt-4 text-sm text-black/50">Details load ho rahi hain…</p>
      <div v-if="s.customerDetails" class="mt-5 grid gap-3 md:grid-cols-2">
        <div class="rounded-2xl bg-white p-4 text-sm">
          <p class="text-xs font-bold text-black/45">Address</p>
          <p class="mt-1 leading-6">{{ [s.customerDetails.customer_details?.address1, s.customerDetails.customer_details?.address2, s.customerDetails.customer_details?.city, s.customerDetails.customer_details?.state, s.customerDetails.customer_details?.postcode].filter(Boolean).join(', ') || 'Address nahi mila' }}</p>
        </div>
        <div class="rounded-2xl bg-white p-4 text-sm">
          <p class="text-xs font-bold text-black/45">Vouchers</p>
          <p v-if="!s.customerDetails.voucher_list?.length" class="mt-1 text-black/45">Koi voucher nahi</p>
          <div v-for="v in s.customerDetails.voucher_list" :key="v.code" class="mt-2 flex items-center justify-between gap-2">
            <div><b>{{ v.code }}</b> <span class="text-black/50">{{ v.amount }}</span><p class="text-[11px] text-black/40">{{ v.name }}</p></div>
            <button @click="voucherTap" :disabled="v.active === 'No'" class="rounded-lg bg-stone-100 px-3 py-1.5 text-[11px] font-black disabled:opacity-40">{{ v.active === 'No' ? 'Inactive' : 'Apply' }}</button>
          </div>
        </div>
        <div v-if="s.customerDetails.order_list?.length" class="rounded-2xl bg-white p-4 md:col-span-2">
          <p class="text-xs font-bold text-black/45">Recent orders</p>
          <div v-for="o in s.customerDetails.order_list.slice(0, 5)" :key="o.order" class="mt-2 flex items-center justify-between border-t pt-2 text-sm">
            <span><b>#{{ o.order }}</b> <span class="text-black/45">{{ o.order_date }}</span></span>
            <span class="text-black/55">{{ o.status }} · ₹{{ money(o.order_amount) }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Create form -->
  <section v-else-if="creating">
    <p class="text-sm font-black">Naya customer</p>
    <div class="mt-3 grid gap-3 md:grid-cols-2">
      <input v-model="form.mobileNumber" inputmode="numeric" maxlength="10" placeholder="Mobile (10 digit)" class="h-12 rounded-2xl border border-black/10 px-4 outline-none focus:border-black" />
      <input v-model="form.email" placeholder="Email (optional)" class="h-12 rounded-2xl border border-black/10 px-4 outline-none focus:border-black" />
      <input v-model="form.firstName" placeholder="First name" class="h-12 rounded-2xl border border-black/10 px-4 outline-none focus:border-black" />
      <input v-model="form.lastName" placeholder="Last name" class="h-12 rounded-2xl border border-black/10 px-4 outline-none focus:border-black" />
    </div>
    <p v-if="formError" role="alert" class="mt-3 text-sm font-semibold text-red-600">{{ formError }}</p>
    <div class="mt-4 flex gap-3">
      <button @click="creating = false" class="h-12 flex-1 rounded-2xl border border-black/10 font-bold">Back</button>
      <button @click="saveNew" :disabled="busy" class="h-12 flex-[1.6] rounded-2xl bg-black font-black text-white disabled:opacity-50">Save customer</button>
    </div>
    <p class="mt-3 text-xs text-black/40">Abhi demo mode: createAccount API connect hone tak ye customer sirf screen par rahega.</p>
  </section>

  <!-- Search -->
  <section v-else>
    <label for="cs" class="text-xs font-bold text-black/50">Mobile number ya naam</label>
    <input id="cs" v-model="text" autofocus class="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-stone-50 px-4 outline-none focus:border-black focus:bg-white" placeholder="Kam se kam 3 characters" />
    <p v-if="searching" class="mt-4 text-sm text-black/45">Dhundh rahe hain…</p>
    <div class="mt-4 space-y-2">
      <button v-for="c in results" :key="c.id_customer" @click="pick(c)" class="flex w-full items-center gap-3 rounded-2xl border border-black/10 p-3 text-left transition hover:bg-stone-50">
        <span class="grid h-11 w-11 place-items-center rounded-full bg-wine text-sm font-black text-white">{{ c.name_initial }}</span>
        <span class="flex-1"><b class="block text-sm">{{ c.name }}</b><span class="text-xs text-black/50">{{ c.mobile_number }}</span></span>
        <span class="text-xs font-black text-wine">Select</span>
      </button>
    </div>
    <div v-if="searched && !results.length" class="mt-4 rounded-2xl bg-stone-50 p-5 text-center text-sm text-black/55">Koi customer nahi mila.</div>
    <button @click="startCreate" class="mt-4 h-12 w-full rounded-2xl bg-rose text-sm font-black text-wine">+ Naya customer banao</button>
  </section>
</template>
