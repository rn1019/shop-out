import { post, ApiError } from '../api/http'

export async function login(username, password) {
  const data = await post('userLogin', { username, password })
  if (!data || data.success !== true) {
    throw new ApiError(data?.message || data?.error || 'Username ya password galat hai.')
  }
  return data
}
