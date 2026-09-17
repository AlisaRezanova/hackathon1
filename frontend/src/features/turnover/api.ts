import { apiFetch, withMockFallback } from '../../shared/http'
import { mockTurnoverPlaceholder } from './mocks'
import type { TurnoverPlaceholder } from './types'

export async function fetchTurnoverPlaceholder(): Promise<{
  data: TurnoverPlaceholder
  usedMock: boolean
}> {
  return withMockFallback(
    () => apiFetch<TurnoverPlaceholder>('/api/turnover/ping'),
    mockTurnoverPlaceholder,
  )
}
