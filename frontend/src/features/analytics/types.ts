// Matches backend/app/features/analytics/schemas.py.

export interface CategoryShare {
  category: string
  count: number
  percent: number
}

export interface DepartmentRisk {
  department: string
  total: number
  low: number
  medium: number
  high: number
  high_percent: number
}

export interface AnalyticsSummary {
  total_interviews: number
  category_breakdown: CategoryShare[]
  department_risk: DepartmentRisk[]
}

export interface SubtypeCount {
  subtype: string
  count: number
}

export interface CategoryQuote {
  quote: string
  department: string
  position: string
}

export interface CategoryDrilldown {
  category: string
  total_mentions: number
  interview_count: number
  subtypes: SubtypeCount[]
  quotes: CategoryQuote[]
  summary: string
  generated_by: 'llm' | 'heuristic'
}

export interface CategoryAdvice {
  category: string
  solutions: string[]
  generated_by: 'llm' | 'heuristic'
}

export interface InterviewListItem {
  id: number
  employee_alias: string
  position: string
  department: string
  interview_date: string
  primary_category: string
  risk_zone: 'low' | 'medium' | 'high'
}

export interface DepartmentDrilldown {
  department: string
  total: number
  low: number
  medium: number
  high: number
  high_percent: number
  top_categories: CategoryShare[]
  summary: string
  generated_by: 'llm' | 'heuristic'
}
