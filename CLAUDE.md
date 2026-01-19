# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PaperDebugger is an AI-powered academic writing assistant with Chrome extension frontend and Go backend. It integrates with Overleaf to provide intelligent suggestions, chat assistance, and AI-powered paper review capabilities.

**Tech Stack:**
- **Backend**: Go 1.24+, Gin (HTTP), gRPC (API), MongoDB
- **Frontend**: React 19, TypeScript, Vite, Zustand (state management)
- **Chrome Extension**: Built from `webapp/_webapp`
- **Office Add-in**: Separate npm project in `webapp/office`
- **API**: Protocol Buffers with Buf for code generation
- **AI**: OpenAI API integration with optional XtraMCP orchestration backend

## Architecture

### Backend Structure

```
cmd/main.go           - Entry point for backend server
internal/
  ├── api/            - HTTP (Gin) and gRPC API handlers
  │   ├── auth/       - Authentication endpoints (login, logout, token refresh)
  │   ├── chat/       - Chat and conversation management
  │   ├── comment/    - Comment system
  │   ├── project/    - Overleaf project integration
  │   └── user/       - User settings and prompts
  ├── services/       - Business logic layer
  │   ├── chat.go/chat_v2.go - Chat service implementations
  │   ├── toolkit/    - AI tool calling framework
  │   │   ├── client/ - OpenAI API client wrappers
  │   │   ├── registry/ - Tool registration system
  │   │   └── tools/  - Available tools (file_read, latex parsing, etc.)
  ├── models/         - Domain models and database schemas
  └── libs/           - Shared libraries (db, jwt, logger, tex processing)
proto/                - Protocol Buffer definitions (auth, chat, comment, project, user)
pkg/gen/              - Generated gRPC/Protobuf code (auto-generated, don't edit)
```

**Key architectural patterns:**
- Dependency injection via Google Wire (`wire.go`, `wire_gen.go`)
- Service layer pattern: API handlers → Services → Models → Database
- Tool calling system for AI function execution in `internal/services/toolkit/`
- Protocol Buffers for API contracts between frontend and backend

### Frontend Structure

```
webapp/
  ├── _webapp/              - Main Chrome extension (uses bun/npm)
  │   ├── src/
  │   │   ├── pkg/gen/      - Generated Protobuf client code
  │   │   └── (React components, stores, etc.)
  │   └── dist/             - Build output (load in Chrome)
  ├── office/               - Office Add-in (npm only, Word integration)
  │   └── src/paperdebugger/office.js - Built from _webapp
  └── oauth-landing/        - OAuth callback page
```

**Frontend state management**: Zustand stores, React Query for API calls

## Common Commands

### Backend Development

```bash
# Install development dependencies (protoc, buf, wire, etc.)
make deps

# Generate Protocol Buffer code and Wire dependency injection
make gen

# Build backend binary
make build

# Run backend server (requires MongoDB on localhost:27017)
./dist/pd.exe
# Server starts on http://localhost:6060

# Format code (buf, go fmt, npm format in webapp)
make fmt

# Lint code (buf, golangci-lint, npm lint in webapp)
make lint

# Run tests with coverage
make test

# View test coverage in browser
make test-view
```

**Environment setup**: Copy `.env.example` to `.env` and configure MongoDB URI, OpenAI API keys, etc.

**MongoDB requirement**: Start MongoDB locally with `docker run -d --name mongodb -p 27017:27017 mongo:latest`

### Frontend Development

#### Chrome Extension (webapp/_webapp)

**Package manager**: Use `bun` or `npm` (both supported)

```bash
cd webapp/_webapp

# Install dependencies
npm install

# Development mode (watch and rebuild on changes)
npm run dev

# Development server (for testing chat UI in browser)
npm run dev:chat

# Full production build (all components)
npm run build

# Build individual components
npm run _build:default      # Main extension UI
npm run _build:background   # Background service worker
npm run _build:office       # Office Add-in bundle
npm run _build:settings     # Settings page
npm run _build:popup        # Extension popup

# Environment-specific builds
npm run build:local:chrome  # Local development
npm run build:stg:chrome    # Staging
npm run build:prd:chrome    # Production

# Lint and format
npm run lint
npm run format
```

**Build Office Add-in for Word:**
```bash
# From webapp/_webapp, build office.js bundle
PD_API_ENDPOINT="https://app.paperdebugger.com" npm run _build:office
# Outputs to: webapp/office/src/paperdebugger/office.js
```

**Loading the extension in Chrome:**
1. Run `npm run build` (or environment-specific build)
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select `webapp/_webapp/dist`

#### Office Add-in (webapp/office)

**Package manager**: Use `npm` only (Office Add-in compatibility requirement)

```bash
cd webapp/office

# Install dependencies (npm only!)
npm install

# Start development server (watches office.js for changes)
npm run dev-server

# Start Word and load the add-in
npm run start

# Stop the add-in
npm run stop

# Production build
npm run build

# Validate manifest
npm run validate
```

**Development workflow**:
1. Build `office.js` from `webapp/_webapp` (see above)
2. Run `npm run dev-server` in `webapp/office` to watch for changes
3. Run `npm run start` to launch Word with the add-in loaded

## Protocol Buffer Workflow

When modifying API contracts:

1. Edit `.proto` files in `proto/` directory
2. Run `make gen` to regenerate Go and TypeScript code
3. Backend code appears in `pkg/gen/`
4. Frontend code appears in `webapp/_webapp/src/pkg/gen/`
5. Never manually edit generated files

## Testing

```bash
# Run all tests with coverage
PD_MONGO_URI="mongodb://localhost:27017" go test -coverprofile=coverage.out ./cmd/... ./internal/... ./webapp/...

# View coverage report in browser
go tool cover -html=coverage.out
```

## Key Concepts

### Tool Calling System
The AI chat uses a tool calling framework in `internal/services/toolkit/`:
- Tools are registered in `registry/registry.go`
- Each tool implements the tool interface (e.g., `tools/files/file_read.go`)
- OpenAI function calling is wrapped in `toolkit/client/`
- Tool execution results are stored in MongoDB via `db/tool_call_record.go`

### XtraMCP Integration (Optional)
XtraMCP is a closed-source MCP orchestration backend that provides:
- Research-mode agents with literature search
- AI-powered paper review and critique
- Domain-specific academic writing revisions

Local development works without XtraMCP. The error `"ERROR [AI Client] Failed to initialize XtraMCP session"` is expected when self-hosting without it.

### Chat System
Two implementations exist:
- `chat.go` - Original implementation
- `chat_v2.go` - Enhanced version with improved streaming

Both use OpenAI's chat completion API with tool calling support.

## Custom Endpoint Configuration

Users can point the extension to a self-hosted backend:
1. Open extension settings
2. Click version number 5 times to enable "Developer Tools"
3. Enter backend URL in "Backend Endpoint" field
4. Refresh the page

## Docker Deployment

```bash
# Build Docker image
make image

# Push to registry
make push
```

Images are tagged with branch name and commit hash to `ghcr.io/paperdebugger/sharelatex-paperdebugger`.
