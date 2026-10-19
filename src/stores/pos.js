import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useAuthStore } from './auth'
import * as posApi from '../services/pos'
import * as customerApi from '../services/customer'
import * as productApi from '../services/products'
import { num, round2, money, uid } from '../utils/format'

export const usePosStore = defineStore('pos', () => {
  const auth = useAuthStore()

  // ---------- catalog ----------
  const products = ref([])
  const query = ref('')
  const category = ref('All')
  const categories = ['All', 'Shoes', 'Clothing', 'Offers', 'Recent']
  const loadingProducts = ref(false)
  let searchSeq = 0
  async function runSearch() {
    const seq = ++searchSeq
    loadingProducts.value = true
    try {
      const list = await productApi.searchProducts(query.value, category.value)
      if (seq === searchSeq) products.value = list
    } catch (e) {
      flash(e.message, 'error')
    } finally {
      if (seq === searchSeq) loadingProducts.value = false
    }
    return products.value
  }

  // ---------- cart ----------
  const cart = ref([])
  const idCart = ref('')
  const totals = ref({ subtotal: 0, gst: 0, discount: 0 })
  const cartRules = ref([])
  const issueIds = ref([])
  const cartIssue = ref('')
  const syncing = ref(false)
  const total = computed(() => round2(totals.value.subtotal + totals.value.gst - totals.value.discount))
  const cartQty = computed(() => cart.value.reduce((s, x) => s + num(x.qty), 0))

  let syncTimer = null
  let syncSeq = 0
  function scheduleSync() {
    clearTimeout(syncTimer)
    syncing.value = cart.value.length > 0
    syncTimer = setTimeout(syncCart, 250)
  }
  function clearTotals() {
    totals.value = { subtotal: 0, gst: 0, discount: 0 }
    cartRules.value = []
    issueIds.value = []
    cartIssue.value = ''
  }
  async function syncCart() {
    if (!cart.value.length) {
      syncing.value = false
      clearTotals()
      return
    }
    const seq = ++syncSeq
    syncing.value = true
    try {
      const d = await posApi.buyNow({ items: cart.value, idCart: idCart.value, idWarehouse: auth.idWarehouse })
      if (seq !== syncSeq) return
      if (d.cart_id) idCart.value = String(d.cart_id)
      totals.value = { subtotal: num(d.cartProductTotal), gst: num(d.totalGST), discount: num(d.cartDiscount) }
      cartRules.value = Array.isArray(d.cartRules) ? d.cartRules : []
      issueIds.value = [...(d.out_of_stock_ids || []), ...(d.unpublished_ids || [])].map(String)
      const hasListErr = Object.values(d.errors || {}).some((a) => Array.isArray(a) && a.length)
      cartIssue.value = (d.out_of_stock_ids || []).length
        ? 'Kuch items out of stock hain. Unhe cart se hata do.'
        : (d.unpublished_ids || []).length
          ? 'Kuch items ab available nahi hain. Unhe hata do.'
          : hasListErr ? 'Cart me kuch items me problem hai.' : ''
    } catch (e) {
      if (seq === syncSeq) flash(e.message, 'error')
    } finally {
      if (seq === syncSeq) syncing.value = false
    }
  }
  const inStockSizes = (p) => (p._rawSizes ? p._rawSizes.filter((r) => r.qty > 0).map((r) => r.label) : p.sizes || [])
  const stockMap = (p) => Object.fromEntries((p._rawSizes || []).map((r) => [r.label, r.qty]))

  function addProduct(p, preferredSize) {
    const avail = inStockSizes(p)
    const size = preferredSize && avail.includes(preferredSize) ? preferredSize : (avail[0] ?? '')
    if (!size) return flash(`${p.name}: stock khatam`, 'error')
    const ex = cart.value.find((x) => x.id === p.id && x.size === size)
    if (ex) ex.qty++
    else {
      cart.value.push({
        lineId: uid(), id: p.id, sku: p.sku, name: p.name, price: p.price, img: p.img,
        sizes: avail,
        stock: stockMap(p),
        size, qty: 1
      })
    }
    flash(`${p.name} (${size}) added`)
    scheduleSync()
  }

  // Cart ke purane/restore hue items ki size list ko current inventory se theek karta hai
  async function refreshCartStock() {
    if (!cart.value.length) return
    try {
      const byId = new Map((await productApi.searchProducts('', 'All')).map((p) => [String(p.id), p]))
      for (const item of cart.value) {
        const p = byId.get(String(item.id))
        if (!p) continue
        item.sizes = inStockSizes(p)
        item.stock = stockMap(p)
      }
    } catch { /* inventory na aaye to purani list rahe */ }
  }
  function changeQty(i, d) {
    const item = cart.value[i]
    if (!item) return
    item.qty += d
    if (item.qty <= 0) cart.value.splice(i, 1)
    scheduleSync()
  }
  function removeItem(i) {
    cart.value.splice(i, 1)
    scheduleSync()
  }
  function changeSize(i, size) {
    const item = cart.value[i]
    if (!item) return
    const dup = cart.value.find((x, k) => k !== i && x.id === item.id && x.size === size)
    if (dup) {
      dup.qty += item.qty
      cart.value.splice(i, 1)
    } else item.size = size
    scheduleSync()
  }
  function resetState() {
    clearTimeout(syncTimer)
    syncSeq++
    syncing.value = false
    cart.value = []
    idCart.value = ''
    customer.value = null
    customerDetails.value = null
    clearTotals()
  }
  async function safeReset(customerId) {
    if (!idCart.value) return
    try {
      await posApi.resetCookie({ idCart: idCart.value, customerId, idWarehouse: auth.idWarehouse })
    } catch (e) {
      flash(e.message, 'error')
    }
  }
  async function cancelSale() {
    const rc = { cid: customer.value?.id_customer }
    await safeReset(rc.cid)
    resetState()
    flash('Bill cleared')
  }

  // ---------- customer ----------
  const customer = ref(null)
  const customerDetails = ref(null)
  const loadingDetails = ref(false)
  async function selectCustomer(c) {
    await safeReset(customer.value?.id_customer)
    customer.value = c
    customerDetails.value = null
    scheduleSync()
    if (c.isDummy) return
    loadingDetails.value = true
    try {
      customerDetails.value = await customerApi.getCustomerDetails(c.id_customer)
    } catch (e) {
      flash(e.message, 'error')
    } finally {
      loadingDetails.value = false
    }
  }
  async function removeCustomer() {
    await safeReset(customer.value?.id_customer)
    customer.value = null
    customerDetails.value = null
    scheduleSync()
  }
  async function createCustomer(form) {
    const c = await productApi.createCustomer(form)
    await selectCustomer(c)
    flash('Customer created (demo)')
  }

  // ---------- hold / resume ----------
  const held = ref([])
  const heldKey = () => `sss_pos_held_${auth.idWarehouse}`
  const persistHeld = () => localStorage.setItem(heldKey(), JSON.stringify(held.value))
  function holdCart() {
    if (!cart.value.length) return flash('Cart khaali hai', 'error')
    held.value.unshift({
      id: 'HC-' + String(Date.now()).slice(-5),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customer: customer.value,
      idCart: idCart.value,
      qty: cartQty.value,
      total: total.value,
      items: JSON.parse(JSON.stringify(cart.value))
    })
    persistHeld()
    const id = held.value[0].id
    clearTimeout(syncTimer)
    syncSeq++
    cart.value = []
    idCart.value = ''
    customer.value = null
    customerDetails.value = null
    clearTotals()
    mobileCartOpen.value = false
    flash(`Bill held: ${id}`)
  }
  function resumeHeld(id) {
    if (cart.value.length) return flash('Pehle current bill hold ya clear karo', 'error')
    const h = held.value.find((x) => x.id === id)
    if (!h) return
    cart.value = h.items
    idCart.value = h.idCart || ''
    customer.value = h.customer
    held.value = held.value.filter((x) => x.id !== id)
    persistHeld()
    panel.value = null
    scheduleSync()
    flash(`${id} resumed`)
  }
  function deleteHeld(id) {
    held.value = held.value.filter((x) => x.id !== id)
    persistHeld()
  }

  // ---------- payment / sale ----------
  const paymentMethods = ref([])
  const lastInvoice = ref(null)
  const showPayment = ref(false)

  function openPayment() {
    if (!cart.value.length) return flash('Pehle products add karo', 'error')
    if (!customer.value) {
      flash('Customer select ya create karo', 'error')
      panel.value = 'customer'
      return
    }
    if (syncing.value) return flash('Cart update ho raha hai, ek second ruko', 'error')
    if (cartIssue.value) return flash(cartIssue.value, 'error')
    mobileCartOpen.value = false
    showPayment.value = true
  }
  function paidAmount(methods) {
    return methods.filter((m) => m.selected && m.id !== 'E-Voucher').reduce((t, m) => t + num(m.value), 0)
  }
  function validatePayment(methods) {
    const sel = methods.filter((m) => m.selected)
    if (!sel.length) return 'Payment option select karo.'
    const paid = paidAmount(methods)
    if (paid + 0.009 < total.value) return `₹${money(round2(total.value - paid))} abhi baaki hai.`
    const excess = round2(paid - total.value)
    if (excess > 0) {
      const cash = sel.find((m) => m.id === 'Cash')
      if (!cash || num(cash.value) < excess) return 'Zyada amount sirf Cash me return ho sakta hai.'
    }
    return ''
  }
  async function completeSale(methods, comments) {
    if (!navigator.onLine) throw new Error('Internet nahi hai. Connection aane ke baad sale complete karo.')
    const err = validatePayment(methods)
    if (err) throw new Error(err)
    if (customer.value?.isDummy) {
      throw new Error('Ye customer demo hai (createAccount API connect nahi hui). Search se real customer chuno.')
    }
    let excess = round2(paidAmount(methods) - total.value)
    const paymentType = methods.map((m) => {
      let value = m.selected ? num(m.value) : 0
      if (m.selected && m.id === 'Cash' && excess > 0) {
        value = round2(value - excess) // change wapas diya, bill me sirf utna hi
        excess = 0
      }
      return { id: m.id, name: m.name, selected: !!m.selected, value: String(value) }
    })
    const data = await posApi.setOrder({
      customerId: customer.value.id_customer,
      idCart: idCart.value,
      paymentType,
      idWarehouse: auth.idWarehouse,
      userId: auth.userId,
      comments,
      barCodes: [] // TODO: barcode scan flow jab products API aayegi
    })
    lastInvoice.value = {
      idOrder: data.id_order,
      order: data.order || {},
      paidBy: methods.filter((m) => m.selected).map((m) => m.name).join(' + '),
      warehouse: auth.idWarehouse
    }
    const rc = { idCart: idCart.value, customerId: customer.value.id_customer }
    resetState()
    showPayment.value = false
    panel.value = 'receipt'
    posApi.resetCookie({ ...rc, idWarehouse: auth.idWarehouse }).catch(() => {})
    productApi.clearInventoryCache?.() // sale ke baad stock purana na dikhe
    runSearch() // grid me naya stock aa jaye
  }

  // ---------- demo summary ----------
  const summary = ref(null)

  // ---------- ui ----------
  const panel = ref(null)
  const mobileCartOpen = ref(false)
  const toast = ref(null)
  let toastTimer = null
  function flash(text, type = 'info') {
    toast.value = { text, type }
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast.value = null), type === 'error' ? 3800 : 2200)
  }

  // ---------- cart save/restore (refresh par bill na jaye) ----------
  const CART_TTL_MS = 12 * 60 * 60 * 1000 // 12 ghante se purana bill wapas nahi aayega
  const cartKey = () => `sss_pos_cart_${auth.idWarehouse}_${auth.userId}`

  function saveCart() {
    try {
      if (!cart.value.length && !customer.value) {
        localStorage.removeItem(cartKey())
        return
      }
      localStorage.setItem(
        cartKey(),
        JSON.stringify({ cart: cart.value, idCart: idCart.value, customer: customer.value, savedAt: Date.now() })
      )
    } catch { /* storage full / private mode: ignore */ }
  }
  // Cart, id_cart ya customer badalte hi save hota hai
  watch([cart, idCart, customer], saveCart, { deep: true })

  function restoreCart() {
    if (cart.value.length || customer.value) return
    try {
      const saved = JSON.parse(localStorage.getItem(cartKey()) || 'null')
      if (!saved) return
      if (Date.now() - saved.savedAt > CART_TTL_MS) {
        localStorage.removeItem(cartKey())
        return
      }
      if (!Array.isArray(saved.cart) || (!saved.cart.length && !saved.customer)) return
      cart.value = saved.cart
      idCart.value = saved.idCart || ''
      customer.value = saved.customer || null
      if (customer.value && !customer.value.isDummy) {
        customerApi.getCustomerDetails(customer.value.id_customer).then((d) => (customerDetails.value = d)).catch(() => {})
      }
      if (cart.value.length) {
        scheduleSync()
        refreshCartStock()
        flash('Pichla bill wapas aa gaya')
      }
    } catch {
      localStorage.removeItem(cartKey())
    }
  }

  async function init() {
    restoreCart() // sabse pehle: refresh se pehle ka bill wapas
    try { held.value = JSON.parse(localStorage.getItem(heldKey()) || '[]') } catch { held.value = [] }
    productApi.getPaymentMethods().then((m) => (paymentMethods.value = m))
    productApi.getShiftSummary().then((s) => (summary.value = s))
    runSearch()
  }

  return {
    products, query, category, categories, loadingProducts, runSearch,
    cart, idCart, totals, total, cartQty, cartRules, issueIds, cartIssue, syncing,
    addProduct, changeQty, removeItem, changeSize, cancelSale,
    customer, customerDetails, loadingDetails, selectCustomer, removeCustomer, createCustomer,
    held, holdCart, resumeHeld, deleteHeld,
    paymentMethods, lastInvoice, showPayment, openPayment, validatePayment, paidAmount, completeSale,
    summary, panel, mobileCartOpen, toast, flash, init
  }
})