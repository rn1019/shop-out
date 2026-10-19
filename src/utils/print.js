// Receipt element ko hidden iframe me copy karke print karta hai (modal/overflow ka issue nahi aata).
export function printElement(id) {
  const el = document.getElementById(id)
  if (!el) return
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join('')
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  doc.open()
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8">${styles}<style>body{margin:0;background:#fff;padding:8px}@page{margin:4mm}</style></head><body>${el.outerHTML}</body></html>`)
  doc.close()
  setTimeout(() => {
    frame.contentWindow.focus()
    frame.contentWindow.print()
    setTimeout(() => frame.remove(), 1500)
  }, 400)
}
