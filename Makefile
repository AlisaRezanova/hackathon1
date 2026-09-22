# Hackathon prototype — dev commands. See CLAUDE.MD and hackathon-vibecoding-guide.md.
#
# Схема: postgres + backend поднимаются в Docker, frontend запускается
# локально (npm run dev) — так быстрее смотреть результат и чинить ошибки,
# чем гонять весь стек в контейнерах.
.DEFAULT_GOAL := help
BACKEND := backend
FRONTEND := frontend
# Compose-файлы лежат в infra/. Проект-директория compose = директория файла,
# поэтому .env из корня репозитория передаём явно через --env-file.
# dev — infra/docker-compose.yaml, prod — infra/docker-compose.prod.yml.
COMPOSE := docker compose -f infra/docker-compose.yaml --env-file .env
PROD_ENV := infra/.env.prod
COMPOSE_PROD := docker compose -f infra/docker-compose.prod.yml --env-file $(PROD_ENV)

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

# Прод: db+backend+frontend(nginx, свой образ) в Docker (без --reload и без
# монтирования исходников). Фронт собирается ВНУТРИ docker build (см.
# infra/Dockerfile.frontend) — локальный npm не нужен. См. infra/docker-compose.prod.yml.
prod: ## прод (локально): собрать и поднять db+backend+frontend (infra/.env.prod), накатить схему
	@[ -f $(PROD_ENV) ] || { echo "Нет $(PROD_ENV): cp infra/.env.prod.example $(PROD_ENV) и заполните"; exit 1; }
	$(COMPOSE_PROD) up -d --wait --build
	$(COMPOSE_PROD) exec -T backend python -m scripts.seed
	@echo "Готово: http://localhost:18080"

prod-down: ## остановить прод-контейнеры (данные БД сохраняются)
	$(COMPOSE_PROD) down

prod-logs: ## логи прод-backend
	$(COMPOSE_PROD) logs -f backend

# Деплой на сервер: rsync рабочего каталога + docker compose up там (прод-стек +
# infra/docker-compose.deploy.yml — подключение frontend-контейнера к сети
# существующего на сервере Caddy, см. README "Деплой (prod)"). Совпадает с тем,
# что уже реально поднято на сервере: путь /opt/hackathon1, имя проекта
# hackathon1 (задано в infra/docker-compose.prod.yml), алиас hackathon-frontend
# (в Caddyfile уже настроен один раз вручную). infra/.env.prod на сервере
# создаётся вручную и никогда не перезаписывается rsync'ом.
DEPLOY_HOST     ?= hr.ec9.ru
SSH             := ssh -o StrictHostKeyChecking=accept-new
DEPLOY_PATH     := /opt/hackathon1
DEPLOY_EXCLUDES := --exclude '.git' --exclude node_modules --exclude frontend/node_modules \
  --exclude frontend/dist --exclude '.venv' --exclude backend/.venv --exclude __pycache__ \
  --exclude '*.pyc' --exclude .pytest_cache --exclude .ruff_cache --exclude .DS_Store \
  --exclude '.env' --exclude 'infra/.env.prod'
COMPOSE_DEPLOY  := docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml -f infra/docker-compose.deploy.yml

deploy: ## выкатить текущий рабочий каталог на сервер (см. DEPLOY_HOST) и поднять прод-стек
	rsync -az --delete -e "$(SSH)" $(DEPLOY_EXCLUDES) ./ $(DEPLOY_HOST):$(DEPLOY_PATH)/
	$(SSH) $(DEPLOY_HOST) 'cd $(DEPLOY_PATH) && $(COMPOSE_DEPLOY) up -d --wait --build'
	$(SSH) $(DEPLOY_HOST) 'cd $(DEPLOY_PATH) && $(COMPOSE_DEPLOY) exec -T backend python -m scripts.seed'

deploy-logs: ## логи бэка на сервере
	$(SSH) $(DEPLOY_HOST) 'cd $(DEPLOY_PATH) && $(COMPOSE_DEPLOY) logs --tail=100 backend'

.PHONY: help db-up back-up build down logs install seed dev dev-build test lint check fmt reset-data prod prod-down prod-logs deploy deploy-logs
