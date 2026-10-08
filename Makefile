# Fractional AI Architecture Office — prototype
# make setup | data | api | ui | demo | test | reset | docs | lint
PY ?= python3
PYPATH = PYTHONPATH=backend:.
API_PORT ?= 8000
UI_PORT ?= 5173

.PHONY: setup data api ui demo test reset docs lint build static deploy-s3 stop

setup:
	@if command -v uv >/dev/null 2>&1; then uv pip install --system -r requirements.txt || uv pip install -r requirements.txt; \
	else $(PY) -m pip install -r requirements.txt; fi
	cd frontend && npm install --no-audit --no-fund
	@test -f .env || cp .env.example .env
	@echo "setup complete — run 'make demo'"

data:
	$(PYPATH) $(PY) -m data_gen.generate --all --if-missing

reset:
	$(PYPATH) $(PY) -m data_gen.generate --all
	$(PYPATH) $(PY) scripts/gen_docs.py

docs:
	$(PYPATH) $(PY) scripts/gen_docs.py

api:
	cd backend && $(PY) -m uvicorn app.main:app --host 0.0.0.0 --port $(API_PORT)

ui:
	cd frontend && npm run dev -- --port $(UI_PORT)

build:
	cd frontend && npm run build

# Read-only static site (no backend): UI + JSON snapshot in frontend/dist. See docs/DEPLOY_AWS_S3.md.
static:
	cd frontend && npm run build:static
	$(PYPATH) $(PY) scripts/export_static.py --out frontend/dist/demo-data

# Upload frontend/dist to an S3 website bucket: make deploy-s3 BUCKET=my-bucket
deploy-s3:
	@test -n "$(BUCKET)" || (echo "usage: make deploy-s3 BUCKET=<bucket-name>" && exit 1)
	scripts/deploy_s3.sh $(BUCKET)

# Generates data if missing, starts the API (port 8000) and the UI (port 5173).
demo: data
	@echo "Starting API on :$(API_PORT) and UI on :$(UI_PORT) ..."
	@cd backend && $(PY) -m uvicorn app.main:app --host 0.0.0.0 --port $(API_PORT) > ../api.log 2>&1 & echo $$! > .api.pid
	@sleep 2
	@echo ""
	@echo "  Demo UI:   http://localhost:$(UI_PORT)"
	@echo "  API docs:  http://localhost:$(API_PORT)/docs"
	@echo "  Script:    docs/DEMO_SCRIPT.md   (Ctrl-C stops the UI; 'make stop' stops the API)"
	@echo ""
	cd frontend && npm run dev -- --port $(UI_PORT)

stop:
	-@kill `cat .api.pid` 2>/dev/null; rm -f .api.pid

test:
	$(PY) -m pytest --cov --cov-report=term-missing:skip-covered

lint:
	ruff check backend data_gen scripts
	cd frontend && npx tsc --noEmit -p tsconfig.json && npx eslint src --ext .ts,.tsx
