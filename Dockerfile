FROM golang:bookworm

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o dist/pd.exe cmd/main.go

EXPOSE 6060
CMD ["./dist/pd.exe"]
