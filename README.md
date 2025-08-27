# PaperDebugger

## Clone and Deploy (locally)

**Prequisite:**
- `brew install bufbuild/buf/buf`

```bash
git clone https://github.com/PaperDebugger/paperdebugger.git
cd paperdebugger

make build

```


## Step 1 k9s

open k9s, then expose the mongo db port at 27017
and also expose paperdebugger-mcp at 8000. (also make sure you modify the `/etc/hosts` let `127.0.0.1	paperdebugger-mcp-server`)

## Step 2 build

```bash
make deps # 安装依赖
make build
```


## Step 3 run

```bash
PD_MONGO_URI="mongodb://localhost:27017" ./dist/pd.exe
```


## 从克隆开始

### 自动
```bash
make all
```

### 手动

#### 0. 安装环境

```bash
make deps
```

#### 1. Web 构建

```bash
cd webapp/_webapp
npm install

npm run build:local:chrome # 构建本地版本（链接至本地后端）
# or
npm run build:prd:chrome # 构建生产环境版本（连接至生产环境服务器）
```

#### 2. 后端 构建

```bash
make build
```
