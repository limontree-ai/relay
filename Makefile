.PHONY: install lint test build check-key ci

install:
	npm ci

lint:
	npm run lint
	npm run typecheck

test:
	npm test

build:
	npm run build

check-key:
	npm run check:no-key

ci: install lint test check-key build
