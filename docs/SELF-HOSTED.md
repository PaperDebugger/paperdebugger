# PaperDebugger Self-hosted Guide


## 1. 本地开发环境部署

### 1.1 环境要求

- **Go**: 1.24+
- **Node.js**: LTS 版本
- **MongoDB**: 本地实例或远程连接
- **Buf**: Protocol Buffer 工具

### 1.2 克隆项目

```bash
git clone https://github.com/PaperDebugger/paperdebugger.git
cd paperdebugger
```

### 1.3 安装依赖

#### 安装 Buf (必需)
```bash
# macOS
brew install bufbuild/buf/buf

# 其他系统请参考: https://docs.buf.build/installation
```

#### 安装项目依赖
```bash
make deps
```

这个命令会：
- 安装 Go 开发工具 (delve, golangci-lint, protoc-gen-go, wire 等)
- 安装前端依赖 (npm install)

### 1.4 设置环境变量

创建 `.env` 文件或设置环境变量：

```bash
# 必需的环境变量
export PD_MONGO_URI="mongodb://localhost:27017"
export OPENAI_API_KEY="your-openai-api-key"
export JWT_SIGNING_KEY="your-jwt-signing-key"

# 可选的环境变量
export PD_API_ENDPOINT="http://localhost:6060"
```

### 1.5 启动 MongoDB

确保 MongoDB 在本地运行：

```bash
# 使用 Docker 启动 MongoDB
docker run -d --name mongodb -p 27017:27017 mongo:latest

# 或使用本地安装的 MongoDB
mongod
```

### 1.6 构建项目

#### 生成代码 (Protocol Buffers)
```bash
make gen
```

#### 构建后端
```bash
make build
```

#### 构建前端扩展

```bash
cd webapp/_webapp

# 构建本地开发版本 (连接到 localhost:6060)
npm run build:local:chrome

# 或构建生产版本 (连接到生产服务器)
npm run build:prd:chrome
```

### 1.7 运行应用

#### 启动后端服务
```bash
./dist/pd.exe
```

后端服务将在 `http://localhost:6060` 启动。

#### 安装 Chrome 扩展

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `webapp/_webapp/dist` 目录

#### 开发调试 (可选)

启动前端开发服务器进行调试：

```bash
cd webapp/_webapp
npm run dev:chat
```

访问 `http://localhost:3000` 进行前端开发。

### 1.8 测试

```bash
# 运行测试
make test

# 查看测试覆盖率
make test-view
```

### 1.9 代码格式化和检查

```bash
# 格式化代码
make fmt

# 代码检查
make lint
```

---
