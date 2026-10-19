import axios from 'axios'
import { resolveUrl, WITH_CREDENTIALS } from '../config/api'

export class ApiError extends Error {}

// Purane project jaisa hi: JSON string body, form-urlencoded header
// (isse browser preflight nahi bhejta, to CORS simple rehta hai).
export async function post(endpoint, payload = {}) {
  let res
  try {
    res = await axios.post(resolveUrl(endpoint), JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      withCredentials: WITH_CREDENTIALS,
      timeout: 25000
    })
  } catch (e) {
    if (e.code === 'ECONNABORTED') throw new ApiError('Server ne time par jawab nahi diya. Dobara try karo.')
    if (!e.response) throw new ApiError('Server se connect nahi ho paya. Internet ya server check karo.')
    throw new ApiError(`Server error (${e.response.status})`)
  }
  let data = res.data
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch { throw new ApiError('Server se galat response aaya.') }
  }
  return data
}
