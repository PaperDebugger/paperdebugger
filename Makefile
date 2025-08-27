# Makefile

MONOREPO_ROOT := ../
export MONOREPO_REVISION ?= $(shell git rev-parse HEAD | cut -c1-6)
export BRANCH_NAME ?= $(shell git rev-parse --abbrev-ref HEAD)

export PAPERDEBUGGER_BRANCH ?= ghcr.io/paperdebugger/sharelatex-paperdebugger:$(BRANCH_NAME)
export PAPERDEBUGGER_LATEST ?= ghcr.io/paperdebugger/sharelatex-paperdebugger
export PAPERDEBUGGER_TAG ?= ghcr.io/paperdebugger/sharelatex-paperdebugger:$(BRANCH_NAME)-$(MONOREPO_REVISION)

.PHONY: all
all: image push

.PHONY: build
build:
	mkdir -p dist
	go build -o dist/pd.exe cmd/main.go

.PHONY: image
image:
	docker build \
	  --build-arg BUILDKIT_INLINE_CACHE=1 \
	  --progress=plain \
	  --file Dockerfile \
	  --pull \
	  --tag $(PAPERDEBUGGER_TAG) \
	  --tag $(PAPERDEBUGGER_BRANCH) \
	  --tag $(PAPERDEBUGGER_LATEST) \
	  .

.PHONY: push
push:
	docker push $(PAPERDEBUGGER_TAG)
	docker push $(PAPERDEBUGGER_LATEST)

.PHONY: deps
deps:
	go install github.com/go-delve/delve/cmd/dlv@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@latest
	go install github.com/bufbuild/buf/cmd/buf@latest
	go install github.com/google/wire/cmd/wire@latest
	cd webapp/_webapp && npm install

.PHONY: gen
gen:
	buf build
	rm -rf pkg/gen
	buf generate --template buf.gen.yaml
	rm -rf webapp/_webapp/src/pkg/gen
	buf generate --template buf.webapp.gen.yaml
	wire gen ./internal

.PHONY: fmt
fmt:
	buf format -w
	go fmt ./...
	cd webapp/_webapp && npm run format

.PHONY: lint
lint:
	buf lint
	golangci-lint run --verbose --fix -E gci
	cd webapp/_webapp && npm run lint

.PHONY: test
test:
	PD_MONGO_URI="mongodb://localhost:27017" go test -coverprofile=coverage.out ./cmd/... ./internal/... ./webapp/...
	go tool cover -html=coverage.out -o coverage.html

.PHONY: test-view
test-view: test
	go tool cover -html=coverage.out
