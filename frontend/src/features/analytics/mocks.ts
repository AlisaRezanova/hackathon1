import type {
  AnalyticsSummary,
  CategoryAdvice,
  CategoryDrilldown,
  DepartmentDrilldown,
  InterviewListItem,
} from './types'

// Offline fallback — mirrors the real aggregation over the 12 seed
// interviews, so the dashboard looks identical whether the backend is up
// or not.
export const mockAnalyticsSummary: AnalyticsSummary = {
  total_interviews: 12,
  category_breakdown: [
    { category: 'Карьерный рост', count: 5, percent: 41.7 },
    { category: 'Компенсация', count: 3, percent: 25.0 },
    { category: 'Проблемы с руководством', count: 2, percent: 16.7 },
    { category: 'Процессы и согласования', count: 1, percent: 8.3 },
    { category: 'Перегрузка и выгорание', count: 1, percent: 8.3 },
  ],
  department_risk: [
    { department: 'Продажи', total: 3, low: 0, medium: 1, high: 2, high_percent: 66.7 },
    { department: 'Поддержка', total: 2, low: 0, medium: 1, high: 1, high_percent: 50.0 },
    { department: 'Разработка', total: 4, low: 2, medium: 2, high: 0, high_percent: 0.0 },
    { department: 'HR', total: 1, low: 1, medium: 0, high: 0, high_percent: 0.0 },
    { department: 'Маркетинг', total: 2, low: 0, medium: 2, high: 0, high_percent: 0.0 },
  ],
}

const mockDrilldowns: Record<string, CategoryDrilldown> = {
  'Карьерный рост': {
    category: 'Карьерный рост',
    total_mentions: 9,
    interview_count: 6,
    subtypes: [
      { subtype: 'однообразные задачи без развития', count: 1 },
      { subtype: 'нет ротации и обучения', count: 1 },
      { subtype: 'нет трека до lead-роли', count: 1 },
      { subtype: 'нет обратной связи по развитию', count: 1 },
      { subtype: 'нет перехода SDR → AE', count: 1 },
      { subtype: 'AE-позиции закрываются извне', count: 1 },
      { subtype: 'роль без управленческих полномочий', count: 1 },
      { subtype: 'обещания без изменений', count: 1 },
      { subtype: 'нет управленческой HR-позиции', count: 1 },
    ],
    quotes: [
      {
        quote: 'Полгода тестирую одну и ту же форму регистрации',
        department: 'Разработка',
        position: 'QA-инженер',
      },
      {
        quote: 'позиции senior/lead DevOps тут просто нет',
        department: 'Разработка',
        position: 'DevOps-инженер',
      },
      {
        quote: 'хотел вырасти в Account Executive, но позиции не освобождаются',
        department: 'Продажи',
        position: 'Sales Development Rep',
      },
      {
        quote: 'по факту всё ещё разбираю тикеты наравне со всеми',
        department: 'Поддержка',
        position: 'Тимлид поддержки',
      },
      {
        quote: 'следующий шаг, которого здесь пока нет',
        department: 'HR',
        position: 'HR-бизнес-партнёр',
      },
    ],
    summary:
      '«Карьерный рост» встречается в 6 из 12 интервью (9 упоминаний). Основные подтипы: ' +
      'однообразные задачи без развития, нет ротации и обучения, нет трека до lead-роли. ' +
      'Частое предложение по улучшению: «Ввести ротацию задач между сотрудниками раз в квартал».',
    generated_by: 'heuristic',
  },
  Компенсация: {
    category: 'Компенсация',
    total_mentions: 4,
    interview_count: 3,
    subtypes: [
      { subtype: 'нет ежегодного пересмотра зарплаты', count: 1 },
      { subtype: 'непрозрачные грейды', count: 1 },
      { subtype: 'снижение бонусного процента', count: 1 },
      { subtype: 'ставка не растёт с нагрузкой', count: 1 },
    ],
    quotes: [
      {
        quote: 'зарплату не пересматривали два года, хотя я просил на каждом ревью',
        department: 'Разработка',
        position: 'Frontend-разработчик',
      },
      {
        quote: 'процент с продажи наоборот срезают',
        department: 'Продажи',
        position: 'Менеджер по продажам',
      },
      {
        quote: 'Ставка не менялась полтора года, хотя объём задач вырос',
        department: 'Маркетинг',
        position: 'Контент-специалист',
      },
    ],
    summary:
      '«Компенсация» встречается в 3 из 12 интервью (4 упоминаний). Основные подтипы: нет ' +
      'ежегодного пересмотра зарплаты, непрозрачные грейды, снижение бонусного процента. ' +
      'Частое предложение по улучшению: «Ввести ежегодный пересмотр зарплаты по рынку».',
    generated_by: 'heuristic',
  },
  'Проблемы с руководством': {
    category: 'Проблемы с руководством',
    total_mentions: 4,
    interview_count: 3,
    subtypes: [
      { subtype: 'микроменеджмент', count: 1 },
      { subtype: 'критерии не фиксируются заранее', count: 1 },
      { subtype: 'руководитель на связи только в авралах', count: 1 },
      { subtype: 'частая смена приоритетов без объяснений', count: 1 },
    ],
    quotes: [
      {
        quote: 'Постоянно переделывает мои сделки по-своему',
        department: 'Продажи',
        position: 'Account Executive',
      },
      {
        quote: 'руководитель обычно на связи только когда что-то горит',
        department: 'Поддержка',
        position: 'Специалист поддержки',
      },
      {
        quote: 'В понедельник говорят делать одно, в среду — уже совсем другое',
        department: 'Маркетинг',
        position: 'Growth-аналитик',
      },
    ],
    summary:
      '«Проблемы с руководством» встречается в 3 из 12 интервью (4 упоминаний). Основные ' +
      'подтипы: микроменеджмент, критерии не фиксируются заранее, руководитель на связи ' +
      'только в авралах. Частое предложение по улучшению: «Фиксировать ожидания и критерии ' +
      'по сделке до начала работы».',
    generated_by: 'heuristic',
  },
  'Процессы и согласования': {
    category: 'Процессы и согласования',
    total_mentions: 3,
    interview_count: 2,
    subtypes: [
      { subtype: 'долгое согласование ТЗ', count: 1 },
      { subtype: 'переделки после старта работ', count: 1 },
      { subtype: 'план меняется в середине периода', count: 1 },
    ],
    quotes: [
      {
        quote: 'мы полгода обсуждаем ТЗ, а потом переделываем за неделю',
        department: 'Разработка',
        position: 'Backend-разработчик',
      },
      {
        quote: 'не менять план в середине квартала',
        department: 'Продажи',
        position: 'Менеджер по продажам',
      },
    ],
    summary:
      '«Процессы и согласования» встречается в 2 из 12 интервью (3 упоминаний). Основные ' +
      'подтипы: долгое согласование ТЗ, переделки после старта работ, план меняется в ' +
      'середине периода. Частое предложение по улучшению: «Сократить цепочку согласования ' +
      'ТЗ до 1-2 ответственных».',
    generated_by: 'heuristic',
  },
  'Перегрузка и выгорание': {
    category: 'Перегрузка и выгорание',
    total_mentions: 1,
    interview_count: 1,
    subtypes: [{ subtype: 'хроническая перегрузка без роста штата', count: 1 }],
    quotes: [
      {
        quote: 'Нагрузка выросла в два раза, а людей не добавили',
        department: 'Поддержка',
        position: 'Специалист поддержки',
      },
    ],
    summary:
      '«Перегрузка и выгорание» встречается в 1 из 12 интервью (1 упоминаний). Основные ' +
      'подтипы: хроническая перегрузка без роста штата. Частое предложение по улучшению: ' +
      '«Пересмотреть KPI по нагрузке на одного специалиста».',
    generated_by: 'heuristic',
  },
}

export function mockCategoryDrilldown(category: string): CategoryDrilldown {
  return (
    mockDrilldowns[category] ?? {
      category,
      total_mentions: 0,
      interview_count: 0,
      subtypes: [],
      quotes: [],
      summary: `Нет данных по категории «${category}» (офлайн-режим).`,
      generated_by: 'heuristic',
    }
  )
}

const mockSolutions: Record<string, string[]> = {
  'Карьерный рост': [
    'Построить прозрачные карьерные треки (junior → senior → lead) с явными критериями перехода',
    'Ввести ежеквартальную ротацию задач и обучение внутри команд, чтобы разбавить рутину',
    'Приоритизировать внутренних кандидатов на открытые senior/lead-позиции перед внешним наймом',
    'Добавить регулярную 1:1-обратную связь по развитию с фиксацией целей на квартал',
  ],
  Компенсация: [
    'Ввести ежегодный пересмотр зарплаты по рыночному бенчмарку для каждой роли',
    'Опубликовать прозрачную грейдовую сетку с вилками окладов, видимую сотрудникам',
    'Зафиксировать бонусный процент в договоре и предупреждать заранее об изменениях условий',
  ],
  'Проблемы с руководством': [
    'Обучить руководителей делегированию и договориться о зонах самостоятельных решений команды',
    'Фиксировать критерии и ожидания по задаче/сделке письменно до начала работы',
    'Ввести регулярные (а не только «авральные») синки руководителя с командой раз в неделю',
  ],
  'Процессы и согласования': [
    'Сократить цепочку согласования ТЗ до 1-2 ответственных лиц',
    'Замораживать план на период (спринт/квартал) и вносить изменения только через явный процесс',
    'Проводить финальный ревью ТЗ перед стартом работ, чтобы исключить переделки после старта',
  ],
  'Перегрузка и выгорание': [
    'Пересмотреть KPI по нагрузке на одного специалиста и нормы обращений/тикетов',
    'Расширить штат поддержки пропорционально росту нагрузки, а не постфактум',
    'Ввести мониторинг перегрузки (алерты по объёму задач) и правило эскалации при превышении',
  ],
}

export function mockCategoryAdvice(category: string): CategoryAdvice {
  return {
    category,
    solutions: mockSolutions[category] ?? [
      'Собрать дополнительные интервью по этой категории, чтобы сформулировать план действий',
      'Обсудить категорию с руководителями затронутых отделов',
      'Проверить, не связана ли категория с более широкой проблемой в другой категории',
    ],
    generated_by: 'heuristic',
  }
}

export const mockInterviews: InterviewListItem[] = [
  {
    id: 5,
    employee_alias: 'Сотрудник П-1',
    position: 'Sales Development Rep',
    department: 'Продажи',
    interview_date: '2026-08-01',
    primary_category: 'Карьерный рост',
    risk_zone: 'high',
  },
  {
    id: 8,
    employee_alias: 'Сотрудник С-1',
    position: 'Тимлид поддержки',
    department: 'Поддержка',
    interview_date: '2026-08-03',
    primary_category: 'Карьерный рост',
    risk_zone: 'high',
  },
  {
    id: 11,
    employee_alias: 'Сотрудник М-1',
    position: 'Контент-специалист',
    department: 'Маркетинг',
    interview_date: '2026-08-04',
    primary_category: 'Компенсация',
    risk_zone: 'medium',
  },
  {
    id: 1,
    employee_alias: 'Сотрудник Р-1',
    position: 'QA-инженер',
    department: 'Разработка',
    interview_date: '2026-08-02',
    primary_category: 'Карьерный рост',
    risk_zone: 'medium',
  },
  {
    id: 2,
    employee_alias: 'Сотрудник Р-2',
    position: 'DevOps-инженер',
    department: 'Разработка',
    interview_date: '2026-08-05',
    primary_category: 'Карьерный рост',
    risk_zone: 'low',
  },
  {
    id: 6,
    employee_alias: 'Сотрудник П-2',
    position: 'Менеджер по продажам',
    department: 'Продажи',
    interview_date: '2026-08-06',
    primary_category: 'Компенсация',
    risk_zone: 'high',
  },
  {
    id: 10,
    employee_alias: 'Сотрудник HR-1',
    position: 'HR-бизнес-партнёр',
    department: 'HR',
    interview_date: '2026-08-08',
    primary_category: 'Карьерный рост',
    risk_zone: 'low',
  },
  {
    id: 12,
    employee_alias: 'Сотрудник М-2',
    position: 'Growth-аналитик',
    department: 'Маркетинг',
    interview_date: '2026-08-09',
    primary_category: 'Проблемы с руководством',
    risk_zone: 'medium',
  },
  {
    id: 3,
    employee_alias: 'Сотрудник Р-3',
    position: 'Frontend-разработчик',
    department: 'Разработка',
    interview_date: '2026-08-10',
    primary_category: 'Компенсация',
    risk_zone: 'low',
  },
  {
    id: 7,
    employee_alias: 'Сотрудник П-3',
    position: 'Account Executive',
    department: 'Продажи',
    interview_date: '2026-08-11',
    primary_category: 'Проблемы с руководством',
    risk_zone: 'medium',
  },
  {
    id: 9,
    employee_alias: 'Сотрудник С-2',
    position: 'Специалист поддержки',
    department: 'Поддержка',
    interview_date: '2026-08-12',
    primary_category: 'Перегрузка и выгорание',
    risk_zone: 'medium',
  },
  {
    id: 4,
    employee_alias: 'Сотрудник Р-4',
    position: 'Backend-разработчик',
    department: 'Разработка',
    interview_date: '2026-08-14',
    primary_category: 'Процессы и согласования',
    risk_zone: 'medium',
  },
]

const mockDepartmentDrilldowns: Record<string, DepartmentDrilldown> = {
  Продажи: {
    department: 'Продажи',
    total: 3,
    low: 0,
    medium: 1,
    high: 2,
    high_percent: 66.7,
    top_categories: [
      { category: 'Карьерный рост', count: 1, percent: 33.3 },
      { category: 'Компенсация', count: 1, percent: 33.3 },
      { category: 'Проблемы с руководством', count: 1, percent: 33.3 },
    ],
    summary:
      'Отдел продаж — самая горячая зона риска: 2 из 3 интервью помечены высоким риском. ' +
      'Причины равномерно распределены между карьерным треком, компенсацией и стилем ' +
      'управления — это указывает на системную проблему, а не единичный случай.',
    generated_by: 'heuristic',
  },
  Поддержка: {
    department: 'Поддержка',
    total: 2,
    low: 0,
    medium: 1,
    high: 1,
    high_percent: 50.0,
    top_categories: [
      { category: 'Карьерный рост', count: 1, percent: 50.0 },
      { category: 'Перегрузка и выгорание', count: 1, percent: 50.0 },
    ],
    summary:
      'В поддержке риск ухода связан с отсутствием карьерного трека и растущей нагрузкой ' +
      'без расширения штата — классическое сочетание, ведущее к выгоранию.',
    generated_by: 'heuristic',
  },
  Разработка: {
    department: 'Разработка',
    total: 4,
    low: 2,
    medium: 2,
    high: 0,
    high_percent: 0.0,
    top_categories: [
      { category: 'Карьерный рост', count: 2, percent: 50.0 },
      { category: 'Компенсация', count: 1, percent: 25.0 },
      { category: 'Процессы и согласования', count: 1, percent: 25.0 },
    ],
    summary:
      'Разработка пока не в зоне высокого риска, но карьерный рост — повторяющаяся тема: ' +
      'стоит заняться этим превентивно, пока риск не перешёл в высокий.',
    generated_by: 'heuristic',
  },
  HR: {
    department: 'HR',
    total: 1,
    low: 1,
    medium: 0,
    high: 0,
    high_percent: 0.0,
    top_categories: [{ category: 'Карьерный рост', count: 1, percent: 100.0 }],
    summary: 'Данных по HR пока мало (1 интервью), рисков высокого уровня не выявлено.',
    generated_by: 'heuristic',
  },
  Маркетинг: {
    department: 'Маркетинг',
    total: 2,
    low: 0,
    medium: 2,
    high: 0,
    high_percent: 0.0,
    top_categories: [
      { category: 'Компенсация', count: 1, percent: 50.0 },
      { category: 'Проблемы с руководством', count: 1, percent: 50.0 },
    ],
    summary:
      'В маркетинге риск средний: сотрудники упоминают компенсацию и управленческий стиль, ' +
      'но пока без признаков высокого риска ухода.',
    generated_by: 'heuristic',
  },
}

export function mockDepartmentDrilldown(department: string): DepartmentDrilldown {
  return (
    mockDepartmentDrilldowns[department] ?? {
      department,
      total: 0,
      low: 0,
      medium: 0,
      high: 0,
      high_percent: 0,
      top_categories: [],
      summary: `Нет данных по отделу «${department}» (офлайн-режим).`,
      generated_by: 'heuristic',
    }
  )
}
