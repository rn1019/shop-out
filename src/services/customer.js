import { post } from '../api/http'

export async function searchCustomer(text) {
  const data = await post('searchCustomer', { search_text: text, type: 'searchCustomer' })
  return Array.isArray(data) ? data : []
}

export async function getCustomerDetails(idCustomer) {
  return post('customerDetails', { id_customer: String(idCustomer) })
}
