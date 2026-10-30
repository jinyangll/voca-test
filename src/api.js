const TOKEN_KEY = 'voca_admin_token'

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token) } catch { /* 저장 불가 환경 */ }
}

export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* 저장 불가 환경 */ }
}

export async function api(path, { method = 'GET', body, admin = false } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (admin) headers.Authorization = `Bearer ${getToken()}`

  let res
  try {
    res = await fetch('/api' + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('서버에 연결하지 못했어요. 인터넷 연결을 확인하세요')
  }
  const data = await res.json().catch(() => null)

  if (admin && res.status === 401) {
    clearToken()
    window.location.assign('/admin/login')
  }
  if (!res.ok) {
    const detail = data?.detail
    throw new Error(typeof detail === 'string' ? detail : `입력값을 확인하세요 (${res.status})`)
  }
  return data
}

export function formatDate(iso) {
  return iso ? new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '-'
}
