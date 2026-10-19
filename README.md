# SSS POS (Vue 3 + Vite + Tailwind)

## Chalane ka tarika
```bash
npm install
cp .env.example .env     # hosts aur endpoint-wise base/live yahan set karo
npm run dev              # http://localhost:5173
npm run build            # dist/ production build
```

## Screens
1. `/login`  : `userLogin.php` se login (session localStorage me, JWT expiry check ke saath)
2. `/`       : POS screen (login ke bina nahi khulti)

## API: kaunsi real hai, kaunsi dummy
| Feature | Status | File |
|---|---|---|
| Login | REAL `userLogin` | `services/auth.js` |
| Cart total / GST / discount | REAL `buyNowSSS` | `services/pos.js` |
| Customer search | REAL `getCustomerStats` | `services/customer.js` |
| Customer details (address, vouchers, orders) | REAL `getCustomerDetails` | `services/customer.js` |
| Cart reset | REAL `resetCookie` | `services/pos.js` |
| Order save + receipt data | REAL `setOrderShop` | `services/pos.js` |
| Products / search / barcode | DUMMY | `services/dummy.js` |
| Payment methods list | DUMMY (sample wali 6 options) | `services/dummy.js` |
| Create customer | DUMMY (is customer par sale blocked) | `services/dummy.js` |
| Voucher apply/remove | DUMMY (toast) | `services/dummy.js` |
| Stock lookup, Exchange, Shift summary/KPIs | DUMMY | `services/dummy.js` |

Real API aane par `services/dummy.js` ka sirf wahi function replace karo (same naam, same return shape).

## Base / live host
`.env` me `VITE_HOST_<ENDPOINT>=base|live`. Cart wale calls (`BUYNOW`, `RESETCOOKIE`, `SETORDER`) ek hi host par rakhna.
Dev me Vite proxy (`/__base`, `/__live`) use hoti hai, to CORS ka issue nahi aata.
Production build browser se seedha URL hit karti hai, to server par CORS allow hona chahiye
(ya same domain par deploy karo / reverse proxy lagao).

## Shortcuts
Alt+C clear bill, Alt+S pay, Alt+N new sale, Alt+P print receipt.

## Dev me URL kaisa dikhta hai
Browser Network tab me `localhost:5173/__live/...` dikhna normal hai. Ye Vite proxy hai jo request ko
`https://gateway.streetstylestore.com/...` par forward karti hai. `.env` badalne ke baad `npm run dev` restart karo.
