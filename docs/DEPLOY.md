# PaperDebugger 部署文档

PaperDebugger 是一个用于学术论文调试的工具，包含后端 Go 服务和前端 Chrome 扩展。本文档详细介绍了从克隆代码到部署的完整流程。

## 项目架构

- **后端**: Go 1.24 + Gin + gRPC + MongoDB
- **前端**: TypeScript + React + Vite (Chrome 扩展)
- **数据库**: MongoDB
- **构建工具**: Buf (Protocol Buffers), Wire (依赖注入)

## 目录

1. [本地开发环境部署](#1-本地开发环境部署)
2. [Docker 测试环境部署](#2-docker-测试环境部署)
3. [Kubernetes 生产环境部署](#3-kubernetes-生产环境部署)

---

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

## 2. Docker 测试环境部署

Docker 部署适用于测试环境，提供了完整的容器化解决方案。

### 2.1 环境要求

- **Docker**: 20.10+
- **Docker Compose**: 2.0+ (可选，用于多容器部署)

### 2.2 构建 Docker 镜像

```bash
# 构建镜像
make image

# 或手动构建
docker build -t paperdebugger:latest .
```

### 2.3 运行容器

#### 使用外部 MongoDB

```bash
docker run -d \
  --name paperdebugger \
  -p 6060:6060 \
  -e PD_MONGO_URI="mongodb://your-mongo-host:27017" \
  -e OPENAI_API_KEY="your-openai-api-key" \
  -e JWT_SIGNING_KEY="your-jwt-signing-key" \
  paperdebugger:latest
```

#### 使用 Docker Compose (推荐)

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  paperdebugger:
    build: .
    ports:
      - "6060:6060"
    environment:
      - PD_MONGO_URI=mongodb://mongodb:27017
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - JWT_SIGNING_KEY=${JWT_SIGNING_KEY}
    depends_on:
      - mongodb
    restart: unless-stopped

  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    command: ["mongod", "--replSet", "rs0"]
    restart: unless-stopped

volumes:
  mongodb_data:
```

启动服务：

```bash
# 设置环境变量
export OPENAI_API_KEY="your-openai-api-key"
export JWT_SIGNING_KEY="your-jwt-signing-key"

# 启动服务
docker-compose up -d

# 初始化 MongoDB 副本集
docker-compose exec mongodb mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'mongodb:27017'}]})"
```

### 2.4 推送镜像到注册表

```bash
# 推送到 GitHub Container Registry
make push

# 或手动推送
docker tag paperdebugger:latest ghcr.io/paperdebugger/sharelatex-paperdebugger:latest
docker push ghcr.io/paperdebugger/sharelatex-paperdebugger:latest
```

### 2.5 验证部署

```bash
# 检查容器状态
docker ps

# 查看日志
docker logs paperdebugger

# 测试健康检查
curl http://localhost:6060/health
```

---

## 3. Kubernetes 生产环境部署

Kubernetes 部署适用于生产环境，提供高可用性和可扩展性。

### 3.1 环境要求

- **Kubernetes**: 1.20+
- **Helm**: 3.0+
- **kubectl**: 配置好的集群访问权限

### 3.2 准备部署

#### 克隆项目
```bash
git clone https://github.com/PaperDebugger/paperdebugger.git
cd paperdebugger
```

#### 配置环境变量
```bash
export OPENAI_API_KEY="your-openai-api-key"
export JWT_SIGNING_KEY="your-jwt-signing-key"
export MCP_BASIC_KEY="your-mcp-basic-key"  # 可选
export MCP_PAPERSCORE_KEY="your-mcp-paperscore-key"  # 可选
```

### 3.3 开发环境部署

使用内置 MongoDB：

```bash
# 部署到开发环境
./hack/dev-apply.sh
```

这将：
1. 创建 `paperdebugger-dev` 命名空间
2. 部署 MongoDB 集群 (带持久化存储)
3. 部署 PaperDebugger 应用
4. 重启部署以确保最新配置

#### 查看部署状态
```bash
kubectl -n paperdebugger-dev get pods
kubectl -n paperdebugger-dev get services
```

#### 端口转发 (本地访问)
```bash
# 转发应用端口
kubectl -n paperdebugger-dev port-forward svc/paperdebugger 6060:80

# 转发 MongoDB 端口 (用于调试)
kubectl -n paperdebugger-dev port-forward svc/mongo 27017:27017
```

### 3.4 生产环境部署

生产环境通常使用外部 MongoDB：

```bash
# 设置外部 MongoDB URI
export MONGO_URI="mongodb://your-production-mongo:27017/paperdebugger"

# 生成生产环境配置
./hack/prd.sh > production-deployment.yaml

# 应用配置
kubectl apply -f production-deployment.yaml
```

### 3.5 自定义部署配置

#### 修改配置文件

编辑 `hack/values-prd.yaml`:

```yaml
namespace: paperdebugger

# 使用外部 MongoDB
mongo:
  in_cluster: false
  uri: "mongodb://external-mongo:27017/paperdebugger"

# 自定义镜像
paperdebugger:
  image: ghcr.io/paperdebugger/sharelatex-paperdebugger:v1.0.0

# MCP 服务器配置
paperdebuggerMcpServer:
  image: ghcr.io/paperdebugger/paperdebugger-mcp-server:latest
```

#### 使用 Helm 直接部署

```bash
helm install paperdebugger ./helm-chart \
  --create-namespace \
  --namespace paperdebugger \
  --values ./helm-chart/values.yaml \
  --values ./hack/values-prd.yaml \
  --set openai_api_key="$OPENAI_API_KEY" \
  --set jwt_signing_key="$JWT_SIGNING_KEY" \
  --set mongo.uri="$MONGO_URI"
```

### 3.6 高可用配置

#### 多副本部署

修改 `helm-chart/templates/paperdebugger.yaml`:

```yaml
spec:
  replicas: 3  # 增加副本数
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
```

#### 资源限制

```yaml
containers:
  - name: paperdebugger
    resources:
      requests:
        memory: "256Mi"
        cpu: "100m"
      limits:
        memory: "512Mi"
        cpu: "500m"
```

#### 健康检查

```yaml
containers:
  - name: paperdebugger
    livenessProbe:
      httpGet:
        path: /health
        port: 6060
      initialDelaySeconds: 30
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /ready
        port: 6060
      initialDelaySeconds: 5
      periodSeconds: 5
```

### 3.7 监控和日志

#### 查看日志
```bash
kubectl -n paperdebugger logs -f deployment/paperdebugger
```

#### 查看事件
```bash
kubectl -n paperdebugger get events --sort-by=.metadata.creationTimestamp
```

#### 调试 Pod
```bash
kubectl -n paperdebugger exec -it deployment/paperdebugger -- /bin/bash
```

### 3.8 更新部署

#### 滚动更新
```bash
# 更新镜像
kubectl -n paperdebugger set image deployment/paperdebugger paperdebugger=ghcr.io/paperdebugger/sharelatex-paperdebugger:v1.1.0

# 重启部署
kubectl -n paperdebugger rollout restart deployment/paperdebugger

# 查看更新状态
kubectl -n paperdebugger rollout status deployment/paperdebugger
```

#### 回滚
```bash
kubectl -n paperdebugger rollout undo deployment/paperdebugger
```

---

## 故障排除

### 常见问题

1. **MongoDB 连接失败**
   - 检查 `PD_MONGO_URI` 环境变量
   - 确保 MongoDB 服务正在运行
   - 验证网络连接

2. **前端扩展无法连接后端**
   - 检查 `PD_API_ENDPOINT` 配置
   - 确保后端服务在正确端口运行
   - 检查 CORS 配置

3. **Kubernetes 部署失败**
   - 检查命名空间是否存在
   - 验证 RBAC 权限
   - 查看 Pod 日志和事件

4. **镜像拉取失败**
   - 配置镜像拉取密钥
   - 检查镜像标签是否正确

### 调试工具

```bash
# 检查应用健康状态
curl http://localhost:6060/health

# 查看 MongoDB 连接
docker exec -it mongodb mongosh

# Kubernetes 调试
kubectl describe pod <pod-name>
kubectl logs <pod-name> --previous
```

---

## 安全注意事项

1. **环境变量**: 不要在代码中硬编码敏感信息
2. **API 密钥**: 使用 Kubernetes Secrets 管理敏感数据
3. **网络**: 配置适当的网络策略和防火墙规则
4. **访问控制**: 实施适当的 RBAC 策略
5. **TLS**: 在生产环境中启用 HTTPS

---

## 性能优化

1. **资源配置**: 根据负载调整 CPU 和内存限制
2. **水平扩展**: 增加应用副本数以处理更多请求
3. **数据库优化**: 配置 MongoDB 索引和副本集
4. **缓存**: 考虑添加 Redis 等缓存层
5. **负载均衡**: 使用 Ingress 或 LoadBalancer 分发流量

通过以上部署文档，您可以根据不同的需求选择合适的部署方式，从本地开发到生产环境都有完整的指导。
