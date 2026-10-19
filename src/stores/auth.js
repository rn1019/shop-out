import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as authApi from '../services/auth'

const KEY = 'sss_pos_auth'

function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (!s?.secretToken) return s
    // JWT expiry check (exp seconds me hota hai)
    const payload = JSON.parse(atob(s.secretToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp && payload.exp * 1000 < Date.now()) return null
    return s
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const session = ref(readSession())
  const isAuthed = computed(() => !!session.value?.user_id)
  const idWarehouse = computed(() => String(session.value?.id_warehouse ?? ''))
  const userId = computed(() => String(session.value?.user_id ?? ''))

  async function login(username, password) {
    const d = await authApi.login(username.trim(), password)
    session.value = {
      username: username.trim(),
      role: d.role,
      id_warehouse: d.id_warehouse,
      user_id: d.user_id,
      token: d.token,
      secretToken: d.secretToken
    }
    localStorage.setItem(KEY, JSON.stringify(session.value))
  }

  function logout() {
    session.value = null
    localStorage.removeItem(KEY)
    // purane login ka adhura bill agle login par na dikhe
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sss_pos_cart_'))
      .forEach((k) => localStorage.removeItem(k))
  }

  return { session, isAuthed, idWarehouse, userId, login, logout }
})