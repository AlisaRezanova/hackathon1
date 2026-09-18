import { apiFetch, withMockFallback } from '../../shared/http'
import { mockAnalyticsSummary, mockCategoryDrilldown } from './mocks'
import type { AnalyticsSummary, CategoryDrilldown } from './types'

export async function fetchAnalyticsSummary(): Promise<{
  data: AnalyticsSummary
  usedMock: boolean
}> {
  return withMockFallback(
    () => apiFetch<AnalyticsSummary>('/api/analytics/summary'),
    mockAnalyticsSummary,
  )
}

export async function fetchCategoryDrilldown(category: string): Promise<{
  data: CategoryDrilldown
  usedMock: boolean
}> {
  return withMockFallback(
    () => apiFetch<CategoryDrilldown>(`/api/analytics/categories/${encodeURIComponent(category)}`),
    mockCategoryDrilldown(category),
  )
}
