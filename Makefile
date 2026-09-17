# Hackathon prototype — dev commands. See CLAUDE.MD and hackathon-vibecoding-guide.md.
#
# Схема: postgres + backend поднимаются в Docker, frontend запускается
# локально (npm run dev) — так быстрее смотреть результат и чинить ошибки,
# чем гонять весь стек в контейнерах.
.DEFAULT_GOAL := help
BACKEND := backend
FRONTEND := frontend
# Один docker-compose.yaml в корне репозитория — docker compose находит его
# без -f. Переменные окружения (POSTGRES_USER и т.д.) берутся из .env рядом.
COMPOSE := docker compose

help: ## список команд
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN{FS=":.*?## "}{printf "  %-14s %s\n", $$1, $$2}'

db-up: ## поднять postgres (docker)
	$(COMPOSE) up -d db

# --wait дожидается healthy у db перед стартом backend. Миграций (Alembic) нет —
# схема одна и зафиксирована в models.py, seed сам создает таблицы (create_all).
back-up: ## поднять postgres + backend (docker, пересборка по кешу) + накатить схему и демоданные
	$(COMPOSE) up -d --wait --build db backend
	$(MAKE) seed

build: ## пересобрать образ backend
	$(COMPOSE) build backend

down: ## остановить все контейнеры
	$(COMPOSE) down

logs: ## логи backend
	$(COMPOSE) logs -f backend

install: ## поставить зависимости back+front
	cd $(BACKEND) && python -m pip install -e ".[dev]"
	cd $(FRONTEND) && npm install

seed: ## создать таблицы (если их нет) и залить демо-данные — идемпотентно
	$(COMPOSE) exec -T backend python -m scripts.seed

dev: back-up ## db+backend в docker + frontend локально (vite)
	cd $(FRONTEND) && { [ -d node_modules ] || npm install; } && npm run dev

dev-build: ## то же, что dev, но с пересборкой образа backend без кеша
	$(COMPOSE) build --no-cache backend
	$(MAKE) dev

test: ## все тесты
	cd $(BACKEND) && pytest -q
	cd $(FRONTEND) && npm run test

lint: ## линт + формат + типы
	cd $(BACKEND) && ruff format --check . && ruff check .
	cd $(FRONTEND) && npm run lint

check: test lint ## ВОРОТА КАЧЕСТВА: тесты + линт. Гонять после каждой фичи.

fmt: ## автоформат
	cd $(BACKEND) && ruff format . && ruff check --fix .
	cd $(FRONTEND) && npm run fmt

reset-data: ## сброс демоданных: снести volume БД и поднять стек заново (кнопка "сбросить демо")
	$(COMPOSE) down -v
	$(MAKE) back-up

.PHONY: help db-up back-up build down logs install seed dev dev-build test lint check fmt reset-data
