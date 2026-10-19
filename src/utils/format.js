export const num = (v) => Number(v) || 0
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
export const money = (n) => (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
