import { apiFetch, withMockFallback } from '../../shared/http'
import { localAnalyze, localNextChatStep, mockInterviewList } from './mocks'
import type {
  AnalyzeRequestPayload,
  AnalyzeResponse,
  ChatResponse,
  ChatTurn,
  InterviewDetail,
  InterviewListItem,
} from './types'

export async function fetchNextChatStep(
  turns: ChatTurn[],
): Promise<{ data: ChatResponse; usedMock: boolean }> {
  try {
    const data = await apiFetch<ChatResponse>('/api/interviews/chat', {
      method: 'POST',
      body: JSON.stringify({ turns }),
    })
    return { data, usedMock: false }
  } catch {
    return { data: localNextChatStep(turns), usedMock: true }
  }
}

function transcriptFromTurns(turns: ChatTurn[]): string {
  return turns
    .map((t) => {
      const answer = t.answer.trim()
      const withStop = /[.!?]$/.test(answer) ? answer : `${answer}.`
      return `— ${t.question} — ${withStop}`
    })
    .join(' ')
}

export async function analyzeInterview(
  request: AnalyzeRequestPayload,
): Promise<{ data: AnalyzeResponse; usedMock: boolean }> {
  try {
    const data = await apiFetch<AnalyzeResponse>('/api/interviews/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    })
    return { data, usedMock: false }
  } catch {
    const transcript = request.transcript?.trim() || transcriptFromTurns(request.turns ?? [])
    return {
      data: { interview_id: -1, transcript, passport: localAnalyze(transcript) },
      usedMock: true,
    }
  }
}

export async function fetchInterviews(): Promise<{
  data: InterviewListItem[]
  usedMock: boolean
}> {
  return withMockFallback(() => apiFetch<InterviewListItem[]>('/api/interviews'), mockInterviewList)
}

export async function fetchInterviewDetail(
  id: number,
): Promise<{ data: InterviewDetail | null; usedMock: boolean }> {
  try {
    const data = await apiFetch<InterviewDetail>(`/api/interviews/${id}`)
    return { data, usedMock: false }
  } catch {
    return { data: null, usedMock: true }
  }
}
