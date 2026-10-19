import { post, ApiError } from '../api/http'

export async function buyNow({ items, idCart, idWarehouse }) {
  const payload = {
    cart_items: items.map((i) => ({
      cartItems: { product_id: String(i.id), product_qty: String(i.qty), attribute: { size: String(i.size) } }
    })),
    from: 'shop',
    id_warehouse: String(idWarehouse)
  }
  if (idCart) payload.id_cart = String(idCart)
  const data = await post('buyNow', payload)
  if (!data || data.success === false) throw new ApiError('Cart update nahi ho paya.')
  return data
}

export async function resetCookie({ idCart, customerId, idWarehouse }) {
  return post('resetCookie', {
    id_cart: String(idCart || ''),
    id_customer: customerId ? String(customerId) : 0,
    from: 'shop',
    id_warehouse: String(idWarehouse)
  })
}

export async function setOrder({ customerId, idCart, paymentType, idWarehouse, userId, comments, barCodes }) {
  const data = await post('setOrder', {
    id_customer: String(customerId),
    id_cart: String(idCart),
    paymentType,
    id_warehouse: String(idWarehouse),
    user_id: String(userId),
    sale_comments: comments || '',
    bar_codes: barCodes || []
  })
  if (!data?.id_order) throw new ApiError(data?.error || data?.message || 'Order save nahi ho paya.')
  return data
}
