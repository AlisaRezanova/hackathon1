import { apiFetch, withMockFallback } from '../../shared/http'
import { mockAnalyticsPlaceholder } from './mocks'
import type { AnalyticsPlaceholder } from './types'

export async function fetchAnalyticsPlaceholder(): Promise<{
  data: AnalyticsPlaceholder
  usedMock: boolean
}> {
  return withMockFallback(
    () => apiFetch<AnalyticsPlaceholder>('/api/analytics/ping'),
    mockAnalyticsPlaceholder,
  )
}
