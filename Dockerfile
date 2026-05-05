FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

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
