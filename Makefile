check: check-noexec check-backend check-frontend check-node-transition

check-noexec:
	@if grep -rnE '(^|[^.A-Za-z0-9_])(eval|exec|compile|__import__)\s*\(' server/app --include='*.py' | grep -v 'mode="eval"'; then \
		echo 'dynamic execution found in server/app'; exit 1; \
	else \
		echo 'noexec OK'; \
	fi

check-backend:
	cd server && uv run ruff check . && uv run mypy app && uv run pytest -q

check-frontend:
	npm run check

check-node-transition:
	npm --prefix server test

dev-backend:
	cd server && uv run uvicorn app.main:app --reload --port 8700

.PHONY: check check-noexec check-backend check-frontend check-node-transition dev-backend
