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
