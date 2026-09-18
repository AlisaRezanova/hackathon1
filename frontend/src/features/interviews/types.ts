// Mirrors backend/app/features/interviews/schemas.py — keep in sync manually
// (no shared codegen for this hackathon).

export interface ChatTurn {
  question: string
  answer: string
}

export type QuestionKind = 'base' | 'followup'
export type GeneratedBy = 'llm' | 'heuristic'
export type RiskZone = 'low' | 'medium' | 'high'

export interface ChatResponse {
  question: string | null
  done: boolean
  step: number
  kind: QuestionKind
  generated_by: GeneratedBy
  department_options?: string[] | null
}

export interface CategoryItem {
  category: string
  subtype: string
  quote: string
  mentions: number
}

export interface BestPractice {
  label: string
  quote: string
}

export type Preventability = 'low' | 'medium' | 'high'

export interface Passport {
  primary_category: string
  risk_zone: RiskZone
  categories: CategoryItem[]
  best_practices: BestPractice[]
  improvement_suggestions: string[]
  sentiment_arc: number[]
  preventability: Preventability
  preventability_reason: string
  generated_by: GeneratedBy
}

export interface AnalyzeRequestPayload {
  turns?: ChatTurn[]
  transcript?: string
  department?: string
  position?: string
  employee_alias?: string
}

export interface AnalyzeResponse {
  interview_id: number
  transcript: string
  passport: Passport
}

export interface InterviewListItem {
  id: number
  employee_alias: string
  position: string
  department: string
  interview_date: string
  source: 'seed' | 'chat'
  primary_category: string | null
  risk_zone: RiskZone | null
  generated_by: GeneratedBy | null
}

export interface InterviewDetail extends InterviewListItem {
  transcript: string
  passport: Passport | null
}
