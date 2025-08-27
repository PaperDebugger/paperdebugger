FROM node:lts-bookworm AS webapp

WORKDIR /app
COPY webapp/_webapp/package.json webapp/_webapp/package-lock.json ./
RUN npm install

COPY webapp/_webapp/ .
RUN npm run build

FROM golang:bookworm

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=webapp /app/dist ./webapp/_webapp/dist
RUN go build -o dist/pd.exe cmd/main.go

EXPOSE 6060
CMD ["./dist/pd.exe"]
