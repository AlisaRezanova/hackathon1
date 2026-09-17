import { useState, type FormEvent } from 'react'
import { Badge } from '../shared/ui/Badge'
import { Button } from '../shared/ui/Button'
import { Card, StatCard, StatGrid } from '../shared/ui/Card'
import { Drawer } from '../shared/ui/Drawer'
import { Field, Input, Select } from '../shared/ui/Form'
import { Header } from '../shared/ui/Header'
import { Modal } from '../shared/ui/Modal'
import { type Column, DataTable } from '../shared/ui/Table'
import { EmptyState, ErrorState, LoadingState } from '../shared/ui/States'
import { useToast } from '../shared/ui/toastContext'

interface RosterRow {
  id: number
  name: string
  position: string
  department: string
  status: 'active' | 'at_risk' | 'open'
}

const roster: RosterRow[] = [
  {
    id: 1,
    name: 'Anna Ivanova',
    position: 'Backend Engineer',
    department: 'Engineering',
    status: 'active',
  },
  {
    id: 2,
    name: 'Boris Petrov',
    position: 'Sales Manager',
    department: 'Sales',
    status: 'at_risk',
  },
  { id: 3, name: 'Elena Sokolova', position: 'Recruiter', department: 'People', status: 'active' },
  {
    id: 4,
    name: 'Igor Volkov',
    position: 'Support Specialist',
    department: 'Customer Support',
    status: 'open',
  },
  {
    id: 5,
    name: 'Maria Novikova',
    position: 'Growth Analyst',
    department: 'Marketing',
    status: 'active',
  },
]

const statusLabel: Record<
  RosterRow['status'],
  { label: string; tone: 'default' | 'amber' | 'neutral' }
> = {
  active: { label: 'Работает', tone: 'default' },
  at_risk: { label: 'Риск ухода', tone: 'amber' },
  open: { label: 'Вакансия', tone: 'neutral' },
}

const columns: Column<RosterRow>[] = [
  { key: 'name', header: 'Сотрудник', render: (row) => row.name },
  { key: 'position', header: 'Роль', render: (row) => row.position },
  { key: 'department', header: 'Отдел', render: (row) => row.department },
  {
    key: 'status',
    header: 'Статус',
    render: (row) => {
      const meta = statusLabel[row.status]
      return <Badge tone={meta.tone}>{meta.label}</Badge>
    },
  },
]

type StatePreview = 'loading' | 'empty' | 'error' | null

/**
 * Landing screen for the template — a working showcase of every shared
 * component (cards, table, form, modal, drawer, toast, loading/empty/error
 * states) wired to real interactions, not a specific product scenario.
 * The integrator replaces this with the real primary scenario.
 */
export function Home() {
  const [isFormOpen, setFormOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<RosterRow | null>(null)
  const [preview, setPreview] = useState<StatePreview>(null)
  const toast = useToast()

  function handleSave(e: FormEvent) {
    e.preventDefault()
    setFormOpen(false)
    toast.show('Изменения сохранены', 'success')
  }

  return (
    <>
      <Header
        eyebrow="Шаблон хакатона"
        title="Обзор"
        actions={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(true)}>
              Добавить запись
            </Button>
            <Button onClick={() => toast.show('Демо-уведомление отправлено', 'success')}>
              Показать уведомление
            </Button>
          </>
        }
      />
      <div className="ui-content">
        <StatGrid>
          <StatCard label="Всего сотрудников" value="128" delta="+4 за месяц" />
          <StatCard label="Открытые вакансии" value="9" />
          <StatCard label="Текучесть, 90 дней" value="6.2%" delta="−1.1 п.п." />
          <StatCard label="Кандидатов в воронке" value="23" delta="+7 за неделю" />
        </StatGrid>

        <div style={{ height: 20 }} />

        <Card
          title="Ростер (демоданные)"
          actions={
            <Button variant="ghost" onClick={() => setSelectedRow(roster[0])}>
              Открыть карточку
            </Button>
          }
        >
          <DataTable columns={columns} rows={roster} />
        </Card>

        <div style={{ height: 20 }} />

        <Card title="Состояния экрана">
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setPreview('loading')}>
              Loading
            </Button>
            <Button variant="secondary" onClick={() => setPreview('empty')}>
              Empty
            </Button>
            <Button variant="secondary" onClick={() => setPreview('error')}>
              Error
            </Button>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Скрыть
            </Button>
          </div>
          {preview === 'loading' && <LoadingState />}
          {preview === 'empty' && (
            <EmptyState
              title="Пока ничего нет"
              body="Здесь появятся данные фичи после интеграции."
            />
          )}
          {preview === 'error' && (
            <ErrorState
              body="Backend не ответил. Проверьте `make back-up`."
              action={
                <Button variant="secondary" onClick={() => setPreview(null)}>
                  Повторить
                </Button>
              }
            />
          )}
        </Card>
      </div>

      {isFormOpen && (
        <Modal
          title="Новая запись"
          onClose={() => setFormOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setFormOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" form="demo-form">
                Сохранить
              </Button>
            </>
          }
        >
          <form id="demo-form" onSubmit={handleSave}>
            <Field label="Имя" htmlFor="demo-name">
              <Input id="demo-name" name="name" placeholder="Например, Ольга Смирнова" required />
            </Field>
            <Field label="Отдел" htmlFor="demo-department">
              <Select id="demo-department" name="department" defaultValue="Engineering">
                <option>Engineering</option>
                <option>Sales</option>
                <option>Customer Support</option>
                <option>People</option>
                <option>Marketing</option>
              </Select>
            </Field>
          </form>
        </Modal>
      )}

      {selectedRow && (
        <Drawer title={selectedRow.name} onClose={() => setSelectedRow(null)}>
          <p style={{ color: 'var(--ink-soft)', marginBottom: 12 }}>{selectedRow.position}</p>
          <p>
            <strong>Отдел:</strong> {selectedRow.department}
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Статус:</strong> {statusLabel[selectedRow.status].label}
          </p>
        </Drawer>
      )}
    </>
  )
}
