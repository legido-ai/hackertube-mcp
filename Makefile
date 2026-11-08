.PHONY: help test lint docker run smoke smoke-docker clean

IMAGE ?= hackertube-mcp:local

help:
	@echo "make test   - run the hermetic test suite"
	@echo "make lint   - syntax-check the source and smoke script"
	@echo "make docker - build the container image"
	@echo "make run    - run the stdio MCP server in Docker"
	@echo "make smoke  - live read-only check against HackerTube"
	@echo "make smoke-docker - live MCP handshake through the built image"

test:
	npm test

lint:
	npm run lint

docker:
	docker build -t $(IMAGE) .

run:
	docker run --rm -i \
		--cap-drop=ALL --security-opt=no-new-privileges \
		-v hackertube-data:/data \
		$(IMAGE)

smoke:
	npm run smoke

smoke-docker:
	node scripts/container-smoke.mjs

clean:
	rm -rf data coverage
	rm -rf node_modules
