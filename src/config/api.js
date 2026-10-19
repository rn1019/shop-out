const trim = (s) => s.replace(/\/+$/, '')
const BASE = trim(import.meta.env.VITE_API_BASE_URL || 'http://localhost/sss/')
const LIVE = trim(import.meta.env.VITE_API_LIVE_URL || 'https://gateway.streetstylestore.com')

// Har endpoint ka default host. .env me VITE_HOST_<NAME>=live|base se override hota hai.
const DEFAULTS = {
  userLogin: { host: 'live', path: 'admin2014/custom-api/userLogin.php' },
  products: { host: 'live', path: 'admin2014/custom-api/inventory/index.php' },
  buyNow: { host: 'live', path: 'admin2014/custom-api/order/buyNowSSS.php' },
  searchCustomer: { host: 'live', path: 'admin2014/custom-api/customer/getCustomerStats.php' },
  customerDetails: { host: 'live', path: 'admin2014/custom-api/getCustomerDetails.php' },
  resetCookie: { host: 'live', path: 'admin2014/custom-api/pos/resetCookie.php' },
  setOrder: { host: 'live', path: 'admin2014/custom-api/order/setOrderShop.php' },
  shopStock: { host: 'live', path: 'admin2014/custom-api/pos/index.php' },
  productSearch: { host: 'live', path: 'admin2014/custom-api/product/getProductSpecificListing.php' },
}

export const ENDPOINTS = Object.fromEntries(
  Object.entries(DEFAULTS).map(([name, ep]) => {
    const override = import.meta.env[`VITE_HOST_${name.toUpperCase()}`]
    return [name, { ...ep, host: override === 'live' || override === 'base' ? override : ep.host }]
  })
)

export function resolveUrl(name) {
  const ep = ENDPOINTS[name]
  if (!ep) throw new Error(`Unknown endpoint: ${name}`)
  const root = import.meta.env.DEV ? `/__${ep.host}` : ep.host === 'live' ? LIVE : BASE
  return `${root}/${ep.path}`
}

export const WITH_CREDENTIALS = import.meta.env.VITE_WITH_CREDENTIALS === 'true'
