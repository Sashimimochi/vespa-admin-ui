IMAGE_NAME  ?= sashimimochi/vespa-admin-ui
VERSION     ?= $(shell node -p "require('./package.json').version")
PLATFORMS   ?= linux/amd64,linux/arm64

.PHONY: help build push release dev test

## デフォルトターゲット
help:
	@echo "使用方法:"
	@echo "  make build           イメージをビルドする ($(IMAGE_NAME):$(VERSION))"
	@echo "  make push            ビルド済みイメージをDocker Hubにプッシュする"
	@echo "  make release         マルチプラットフォームビルド＆Docker Hubにプッシュする"
	@echo "  make dev             開発サーバーを起動する (docker compose up)"
	@echo "  make test            テストを実行する"
	@echo ""
	@echo "変数:"
	@echo "  IMAGE_NAME  = $(IMAGE_NAME)"
	@echo "  VERSION     = $(VERSION)"
	@echo "  PLATFORMS   = $(PLATFORMS)"

## Dockerイメージをビルドする
build:
	docker build -t $(IMAGE_NAME):$(VERSION) -t $(IMAGE_NAME):latest .

## ビルド済みイメージをDocker Hubにプッシュする
push:
	docker push $(IMAGE_NAME):$(VERSION)
	docker push $(IMAGE_NAME):latest

## マルチプラットフォームビルド＆Docker Hubにプッシュする (docker buildx が必要)
release:
	docker buildx build \
		--platform $(PLATFORMS) \
		--tag $(IMAGE_NAME):$(VERSION) \
		--tag $(IMAGE_NAME):latest \
		--push \
		.

## 開発サーバーをdocker composeで起動する
dev:
	docker compose up

## テストを実行する
test:
	npm run test:ci
