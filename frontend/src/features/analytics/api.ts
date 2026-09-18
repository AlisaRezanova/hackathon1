import { apiFetch, withMockFallback } from '../../shared/http'
import {
  mockAnalyticsSummary,
  mockCategoryAdvice,
  mockCategoryDrilldown,
  mockDepartmentDrilldown,
  mockInterviews,
} from './mocks'
import type {
  AnalyticsSummary,
  CategoryAdvice,
  CategoryDrilldown,
  DepartmentDrilldown,
  InterviewListItem,
} from './types'

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

export async function fetchInterviews(): Promise<{
  data: InterviewListItem[]
  usedMock: boolean
}> {
  return withMockFallback(
    () => apiFetch<InterviewListItem[]>('/api/analytics/interviews'),
    mockInterviews,
  )
}

export async function fetchCategoryAdvice(category: string): Promise<{
  data: CategoryAdvice
  usedMock: boolean
}> {
  return withMockFallback(
    () =>
      apiFetch<CategoryAdvice>(`/api/analytics/categories/${encodeURIComponent(category)}/advice`),
    mockCategoryAdvice(category),
  )
}

export async function fetchDepartmentDrilldown(department: string): Promise<{
  data: DepartmentDrilldown
  usedMock: boolean
}> {
  return withMockFallback(
    () =>
      apiFetch<DepartmentDrilldown>(`/api/analytics/departments/${encodeURIComponent(department)}`),
    mockDepartmentDrilldown(department),
  )
}
