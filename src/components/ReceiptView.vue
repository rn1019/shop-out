<script setup>
import { computed } from 'vue'
import { usePosStore } from '../stores/pos'
import { money } from '../utils/format'
import { printElement } from '../utils/print'

const s = usePosStore()
const inv = computed(() => s.lastInvoice)
const o = computed(() => inv.value?.order || {})
const isBuzz = computed(() => inv.value?.warehouse === '25')
const showTax = computed(() => !isBuzz.value && o.value.isApplyTax === 'Yes')
</script>

<template>
  <div v-if="inv">
    <p class="mb-4 text-center text-sm font-black text-emerald-700">Order #{{ inv.idOrder }} save ho gaya.</p>
    <div id="printSale" class="mx-auto max-w-sm rounded-2xl border border-black/10 bg-white p-5 text-[13px]" style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace">
      <div class="text-center">
        <p class="text-base font-black">{{ isBuzz ? 'Buzzstreet Indirapuram' : o.ownShop === '1' ? 'Street Style Store (' + o.shopName + ')' : o.shopName }}</p>
        <p v-if="o.shopRemark" class="mt-1 text-xs font-bold">{{ o.shopRemark }}</p>
        <p v-if="o.shopAddress" class="mt-2 whitespace-pre-line text-xs">{{ o.shopAddress }}</p>
        <p v-if="o.shopContactNumber" class="text-xs">Contact # {{ o.shopContactNumber }}</p>
        <p v-if="o.shopGST" class="mt-1 text-xs"><b>GST:</b> {{ o.shopGST }}</p>
        <p class="mt-3 font-black">{{ o.shopGST ? 'Tax Invoice' : 'Sale Receipt' }}</p>
        <p class="text-xs">{{ o.date }}</p>
        <p class="text-xs"><b>Sale ID:</b> {{ inv.idOrder }}</p>
      </div>
      <div class="my-3 border-t border-dashed"></div>
      <table class="w-full text-xs">
        <thead><tr class="text-left font-black"><th class="pb-1">Product</th><th class="pb-1">Qty</th><th v-if="showTax" class="pb-1">Tax</th><th class="pb-1 text-right">Total</th></tr></thead>
        <tbody>
          <tr v-for="(p, i) in o.products" :key="i" class="align-top">
            <td class="py-1 pr-2">{{ p.name }}</td><td class="py-1">{{ p.qty }}</td><td v-if="showTax" class="py-1">{{ p.tax }}</td><td class="py-1 text-right">₹{{ money(p.total) }}</td>
          </tr>
        </tbody>
      </table>
      <div class="my-3 border-t border-dashed"></div>
      <div class="space-y-1">
        <div class="flex justify-between"><span>Sub Total</span><b>₹{{ money(o.subtotal) }}</b></div>
        <div class="flex justify-between"><span>Discount</span><b>₹{{ money(o.discount) }}</b></div>
        <template v-if="showTax">
          <div class="flex justify-between"><span>SGST</span><b>₹{{ money(o.sgst) }}</b></div>
          <div class="flex justify-between"><span>CGST</span><b>₹{{ money(o.cgst) }}</b></div>
        </template>
        <div class="flex justify-between pt-1 text-sm font-black"><span>Total Payable</span><span>₹{{ money(o.total) }}</span></div>
        <div v-if="!isBuzz" class="flex justify-between"><span>Paid By</span><span>{{ o.paymentMethod || inv.paidBy }}</span></div>
      </div>
      <p v-if="o.policy" class="mt-4 text-xs"><b>Exchange Policy:</b> {{ o.policy }}</p>
    </div>
    <div class="mx-auto mt-4 grid max-w-sm grid-cols-2 gap-2">
      <button @click="s.panel = null" class="h-11 rounded-xl bg-rose text-xs font-black text-wine">New sale</button>
      <button @click="printElement('printSale')" class="h-11 rounded-xl bg-black text-xs font-black text-white">Print</button>
    </div>
  </div>
  <p v-else class="text-center text-sm text-black/45">Abhi koi receipt nahi hai.</p>
</template>
