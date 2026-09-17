# Hackathon HR prototype — template

Легкий шаблон для двухчасового хакатона по вайбкодингу. Стек: React + TypeScript + Vite
(frontend, локально), FastAPI + SQLAlchemy 2.0 + PostgreSQL (backend, в Docker). Правила
работы — в [`CLAUDE.md`](./CLAUDE.md), контекст подготовки — в
[`hackathon-vibecoding-guide.md`](./hackathon-vibecoding-guide.md).

## Быстрый старт

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
make install   # зависимости backend + frontend
make dev       # db + backend в Docker, frontend локально (vite)
```

Frontend: http://localhost:5173 · Backend: http://localhost:8000 · Swagger:
http://localhost:8000/docs

## Команды (Makefile)

| Команда             | Что делает                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `make install`      | ставит зависимости backend + frontend                            |
| `make dev`          | поднимает db+backend в Docker и запускает frontend (`npm run dev`) |
| `make db-up`        | поднимает только Postgres                                        |
| `make back-up`      | поднимает db+backend и накатывает демоданные                     |
| `make seed`         | создаёт таблицы (если их нет) и засеивает демоданные, идемпотентно |
| `make reset-data`   | сбрасывает БД (volume) и поднимает стек заново с демоданными      |
| `make down`         | останавливает все контейнеры                                     |
| `make test`         | тесты backend (pytest) + frontend (vitest)                       |
| `make lint`         | линт backend (ruff) + frontend (oxlint)                          |
| `make fmt`          | автоформат backend (ruff) + frontend (prettier)                  |
| `make check`        | `test` + `lint` — гонять после каждой фичи                       |

## Структура

```
backend/app/
  main.py, db.py, config.py    заморожено — шов: include_router для обеих фич
  models.py                    заморожено — все HR-сущности сразу
  features/ranking/            router.py, schemas.py — заглушка, домен ranking
  features/turnover/           router.py, schemas.py — заглушка, домен turnover
backend/scripts/seed.py        заморожено — демоданные сразу во все таблицы

frontend/src/
  App.tsx, router.tsx          заморожено — оба маршрута заведены
  shared/ui/                   готовый набор компонентов (см. ниже)
  shared/http.ts               заморожено — fetch + переключатель моков
  features/ranking/            ui.tsx, api.ts, types.ts, mocks.ts — заглушка
  features/turnover/           ui.tsx, api.ts, types.ts, mocks.ts — заглушка
```

`features/ranking` и `features/turnover` — placeholder-имена для двух будущих фич
(конкретные домены хакатона ещё не известны); переименуйте папки под реальные фичи, когда
задание станет известно, не трогая `main.py`/`router.tsx`/`models.py`.

## Готовые UI-компоненты (`frontend/src/shared/ui`)

Layout/Sidebar/Header, Card/StatCard, DataTable, Field/Input/Select/TextArea, Modal, Drawer,
Toast, LoadingState/EmptyState/ErrorState, Button, Badge. Живая витрина всех компонентов —
главная страница (`/`) после `make dev`.

## Известные ограничения шаблона

- Без авторизации, миграций (Alembic) и CI — сознательно, см. `CLAUDE.md`.
- Обе фичи — заглушки (`/api/ranking/ping`, `/api/turnover/ping`); реальную логику и экраны
  реализуют участники хакатона каждый в своей папке.
- Frontend-фичи используют мок-fallback (`shared/http.ts::withMockFallback`), если backend
  недоступен — полезно при офлайн-полировке UI.
