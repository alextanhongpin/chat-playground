-include .env
export

start:
	go run chat.go main.go room.go


init:
	go mod init chat-playground

vendor:
	go mod vendor

# Docker args.
BUILD_DATE := $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
NAME := $(shell basename `git rev-parse --show-toplevel`)
VCS_URL := $(shell git config --get remote.origin.url)
VCS_REF := $(shell git rev-parse HEAD)
VENDOR := $(shell whoami)
VERSION := $(shell git rev-parse --short HEAD)

print:
	@echo VERSION=${VERSION} 
	@echo BUILD_DATE=${BUILD_DATE}
	@echo VCS_URL=${VCS_URL}
	@echo VCS_REF=${VCS_REF}
	@echo NAME=${NAME}
	@echo VENDOR=${VENDOR}

docker:
	docker build \
	--build-arg VERSION="${VERSION}" \
	--build-arg BUILD_DATE="${BUILD_DATE}" \
	--build-arg VCS_URL="${VCS_URL}" \
	--build-arg VCS_REF="${VCS_REF}" \
	--build-arg NAME="${NAME}" \
	--build-arg VENDOR="${VENDOR}" \
	-t alextanhongpin/chat-playground .

up:
	docker run -d -p 8000:8000 alextanhongpin/chat-playground

inspect:
	docker inspect --format='{{json .Config.Labels}}' alextanhongpin/chat-playground | jq
