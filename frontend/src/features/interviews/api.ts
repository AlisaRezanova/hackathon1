import { apiFetch, withMockFallback } from '../../shared/http'
import { mockInterviewsPlaceholder } from './mocks'
import type { InterviewsPlaceholder } from './types'

export async function fetchInterviewsPlaceholder(): Promise<{
  data: InterviewsPlaceholder
  usedMock: boolean
}> {
  return withMockFallback(
    () => apiFetch<InterviewsPlaceholder>('/api/interviews/ping'),
    mockInterviewsPlaceholder,
  )
}
