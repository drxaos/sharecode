ARG BUILD_MODE=prod

FROM node:20-alpine AS frontend-builder
ARG BUILD_MODE
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN if [ "$BUILD_MODE" = "debug" ]; then npm run build:debug; else npm run build; fi

FROM golang:1.22-alpine AS backend-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
RUN CGO_ENABLED=0 GOOS=linux go build -o sharecode ./cmd/server

FROM alpine:3.20
WORKDIR /app
COPY --from=backend-builder /app/sharecode .
COPY --from=backend-builder /app/frontend/dist ./frontend/dist
EXPOSE 8080
CMD ["./sharecode"]
