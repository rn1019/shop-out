import { useAuthStore } from '../stores/auth'
import { post } from '../api/http'
import { ENDPOINTS } from '../config/api'

const API_URL = 'https://gateway.streetstylestore.com/admin2014/custom-api/inventory/index.php'
const CACHE_TTL_MS = 60 * 1000 // itne time baad inventory dobara fetch hoti hai

let cache = null // { key, time, data }
let inflight = null // { key, promise }
let generation = 0 // clear hone par purani in-flight request ka result ignore karne ke liye

// Login se aaya hua role, warehouse aur user
function sessionInfo() {
  const auth = useAuthStore()
  return { role: auth.session?.role, idWarehouse: auth.idWarehouse, userId: auth.userId }
}

// Sale ke baad (ya jab bhi fresh stock chahiye) isko call karo
export function clearInventoryCache() {
  cache = null
  inflight = null
  generation++
}

// Inventory response me ye keys size nahi hain; baaki numeric keys size hain
// (shoes: size_34.., apparel: XS, S, M, "XS/S/M", "L/XL", 2XL ...)
const META_KEYS = new Set(['img', 'Id', 'name', 'Vendor', 'categories', 'shop_sp', 'shop_cp'])
const OFFER_RE = /\d+\s*for\s*\d+|deal|offer|sale/i
// categories: "Shoes | 3 for 1299 Shoes" -> "3 for 1299 Shoes"
const offerBadge = (categories) => String(categories || '').split('|').map((t) => t.trim()).filter(Boolean).slice(1).find((t) => OFFER_RE.test(t)) || ''

async function loadFromApi({ role, idWarehouse, userId }) {
  const payloadBase = {
    type: 'shopInventory',
    user_role: role,
    id_warehouse: idWarehouse,
    user_id: userId
  }
  const call = (productType) =>
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payloadBase, product_type: productType })
    }).then((r) => {
      if (!r.ok) throw new Error(`Inventory error (${r.status})`)
      return r.json()
    })

  const [shoesRes, apparelsRes] = await Promise.all([call('Shoes'), call('Apparels')])
  const rawProducts = [...(shoesRes.results || []), ...(apparelsRes.results || [])]

  return rawProducts.map((p) => {
    const parsedSizes = Object.keys(p)
      .filter((k) => !META_KEYS.has(k) && /^\d+$/.test(String(p[k]).trim()))
      .map((k) => ({ label: k.replace('size_', ''), qty: parseInt(p[k], 10) || 0 }))
    return {
      id: String(p.Id),
      name: p.name,
      sku: String(p.Id),
      price: parseFloat(p.shop_sp) || 0,
      category: ['shoe', 'shoes','boot', 'flat', 'flats', 'wadge', 'sneaker', 'boots', 'heel', 'heels'].some(kw => p.categories?.toLowerCase().includes(kw)) ? 'Shoes' : 'Clothing',
      sizes: parsedSizes.map((s) => s.label),
      _rawSizes: parsedSizes,
      badge: offerBadge(p.categories),
      img: p.img?.replace(/\\\//g, '/').replace('-cart_default', '-large_default')
    }
  })
}

async function fetchInventory() {
  const info = sessionInfo()
  if (!info.idWarehouse) return [] // login nahi hai

  const key = `${info.idWarehouse}:${info.userId}`
  if (cache && cache.key === key && Date.now() - cache.time < CACHE_TTL_MS) return cache.data
  if (inflight && inflight.key === key) return inflight.promise // ek hi baar request jaaye

  const gen = generation
  const promise = loadFromApi(info)
    .then((data) => {
      if (gen === generation) cache = { key, time: Date.now(), data }
      return data
    })
    .catch((error) => {
      console.error('Inventory fetch failed:', error)
      // Purana data ho to wahi dikhao, warna khaali
      return cache && cache.key === key ? cache.data : []
    })
    .finally(() => {
      if (inflight && inflight.promise === promise) inflight = null
    })
  inflight = { key, promise }
  return promise
}

export async function searchProducts(query = '', category = 'All') {
  const products = await fetchInventory()
  const q = query.trim().toLowerCase()

  return products.filter((p) => {
    const mq = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.id.includes(q)
    const mc = category === 'All' || category === 'Recent' || (category === 'Offers' ? !!p.badge : p.category === category)
    return mq && mc
  })
}

export async function getStock(productId) {
  const products = await fetchInventory()
  const p = products.find((x) => x.id === String(productId))
  if (!p) return null

  const storeQty = p.sizes.map((sizeLabel) => {
    const sizeData = p._rawSizes.find((rs) => rs.label === sizeLabel)
    return sizeData ? sizeData.qty : 0
  })

  return {
    sizes: p.sizes,
    rows: [{ location: 'Current store', note: `Warehouse ID: ${sessionInfo().idWarehouse}`, qty: storeQty }]
  }
}

// ---------- Stock panel ke liye ----------

// Saare products me search (id ya naam). Purane project jaisa payload.
// api.js me productSearch ka path bharte hi ye real search use karega,
// tab tak sirf is store ki inventory me search hota hai.
export async function searchAllProducts(text) {
  const q = String(text || '').trim()
  if (ENDPOINTS.productSearch.path && q.length > 3) {
    const data = await post('productSearch', { search_text: q, type: 'searchProductList', product_type: 'all' })
    const list = Array.isArray(data?.productList) ? data.productList : []
    return list.map((p) => ({
      id: String(p.id),
      name: p.name,
      img: p.img,
      stock: p.stock,
      discontinue: p.discontinue
    }))
  }
  const local = await searchProducts(q, 'All')
  return local.map(({ id, name, img }) => ({ id, name, img }))
}

// Saare shops ka size-wise stock (pos/index.php, type: getAllShopStock)
// Return: { sizes: ['34','35',...], rows: [{ location, note, qty: [0, 2, null, ...] }] }
// qty me null ka matlab us shop ke response me wo size hai hi nahi.
export async function getAllShopStock(productId) {
  const n = Number(productId)
  const data = await post('shopStock', {
    id_product: Number.isFinite(n) ? n : String(productId),
    type: 'getAllShopStock'
  })
  const list = Array.isArray(data?.stock) ? data.stock : null
  if (!list) throw new Error(data?.error || data?.message || 'Stock data nahi mila.')

  const sizes = []
  list.forEach((s) =>
    Object.keys(s.sizes || {}).forEach((z) => {
      if (!sizes.includes(z)) sizes.push(z)
    })
  )
  return {
    sizes,
    rows: list.map((s) => ({
      location: s.location,
      note: s.subtitle || '',
      qty: sizes.map((z) => (s.sizes && z in s.sizes ? parseInt(s.sizes[z], 10) || 0 : null))
    }))
  }
}

// --- REMAINING DUMMY SERVICES (jaise jaise endpoints milte jayein, replace karte jao) ---
const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms))

export async function getPaymentMethods() {
  await wait(50)
  return [
    { id: 'Cash', name: 'Cash' },
    { id: 'Credit-Debit Card', name: 'Credit/Debit Card' },
    { id: 'E-Voucher', name: 'E-Voucher' },
    { id: 'Paytm', name: 'Paytm' },
    { id: 'GooglePay', name: 'Google Pay' },
    { id: 'PhonePe', name: 'PhonePe' }
  ].map((m) => ({ ...m, selected: false, value: '0' }))
}

// DEMO: createAccount API connect hone tak isDummy true rehna chahiye,
// warna fake id (DUMMY-...) live setOrder me chala jayega.
export async function createCustomer({ mobileNumber, firstName, lastName, email }) {
  await wait(300)
  const name = `${firstName} ${lastName}`.trim() || mobileNumber
  return {
    id_customer: `DUMMY-${Date.now()}`,
    name,
    name_initial: name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
    email: email || `${mobileNumber}@sss.com`,
    mobile_number: mobileNumber,
    isDummy: true
  }
}

export async function applyVoucher() {
  await wait(100)
  throw new Error('Voucher apply API abhi connect nahi hui.')
}
export const removeVoucher = applyVoucher

export async function getShiftSummary() {
  await wait(150)
  return {
    kpis: [
      { label: 'Bills today', value: '83' },
      { label: 'Sales', value: '₹86.4K' }
    ],
    totals: [
      { label: 'Gross sales', value: '₹91,380' },
      { label: 'Net sales', value: '₹86,400' }
    ],
    payments: [{ mode: 'Cash', system: 18450, counted: 18450 }]
  }
}

export async function findPurchase(source, lookup) {
  await wait(300)
  if (!lookup) throw new Error('Bill / order ID daalo.')
  return {
    source,
    billId: lookup,
    item: { id: 'dummy', name: 'Dummy Item', sku: 'DUMMY', size: '38', qty: 1, price: 799, img: '' }
  }
}

export async function completeExchange() {
  await wait(300)
  return { ok: true }
}