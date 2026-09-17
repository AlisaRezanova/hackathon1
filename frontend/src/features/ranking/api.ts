import { apiFetch, withMockFallback } from '../../shared/http'
import { mockRankingPlaceholder } from './mocks'
import type { RankingPlaceholder } from './types'

export async function fetchRankingPlaceholder(): Promise<{
  data: RankingPlaceholder
  usedMock: boolean
}> {
  return withMockFallback(
    () => apiFetch<RankingPlaceholder>('/api/ranking/ping'),
    mockRankingPlaceholder,
  )
}
