FROM golang:1.11.1-stretch as builder

WORKDIR /chat-playground

COPY . ./

RUN CGO_ENABLED=0 GOOS=linux go build -mod=vendor -o app 

FROM alpine:3.8

WORKDIR /root/

COPY --from=builder /chat-playground/app .
COPY --from=builder /chat-playground/templates ./templates 
COPY --from=builder /chat-playground/public ./public

# Metadata params
ARG VERSION
ARG BUILD_DATE
ARG VCS_URL
ARG VCS_REF
ARG NAME
ARG VENDOR

# Metadata
LABEL org.label-schema.build-date=$BUILD_DATE \
      org.label-schema.name=$NAME \
      org.label-schema.description="Stateless chat playground inspired by play.golang website." \
      org.label-schema.url="https://:)none" \
      org.label-schema.vcs-url=https://github.com/alextanhongpin/$VCS_URL \
      org.label-schema.vcs-ref=$VCS_REF \
      org.label-schema.vendor=$VENDOR \
      org.label-schema.version=$VERSION \
      org.label-schema.docker.schema-version="1.0" \
      org.label-schema.docker.cmd="docker run -d -p 8000:8000 alextanhongpin/chat-playground"

EXPOSE 8000

CMD ["./app"]
