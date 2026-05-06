.PHONY: build build-debug run run-debug docker-build docker-build-debug

build:
	cd frontend && npm run build
	go build -o sharecode ./cmd/server

build-debug:
	cd frontend && npm run build:debug
	go build -o sharecode ./cmd/server

run:
	cd frontend && npm run build
	go run ./cmd/server

run-debug:
	cd frontend && npm run build:debug
	DEBUG=1 go run ./cmd/server

docker-build:
	docker build -t sharecode:prod .

docker-build-debug:
	docker build --build-arg BUILD_MODE=debug -t sharecode:debug .
