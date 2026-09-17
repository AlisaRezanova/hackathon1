/**
 * Shared fetch helper + mock fallback switch — FROZEN seam, see
 * hackathon-vibecoding-guide.md ("Швы"). Each feature keeps its own
 * `api.ts`/`mocks.ts` and calls into this; there is no shared "services"
 * layer beyond this thin transport helper.
 */

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} ${res.statusText}`)
  }
  return (await res.json()) as T
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    await apiFetch('/api/health')
    return true
  } catch {
    return false
  }
}

/**
 * Try the real API call; on any failure (backend down, network error while
 * polishing UI, ...) fall back to local mock data so the screen stays
 * demoable. Returns whether the mock was used, so a feature can surface it.
 */
export async function withMockFallback<T>(
  load: () => Promise<T>,
  mock: T,
): Promise<{ data: T; usedMock: boolean }> {
  try {
    return { data: await load(), usedMock: false }
  } catch {
    return { data: mock, usedMock: true }
  }
}
