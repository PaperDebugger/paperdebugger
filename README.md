# PaperDebugger

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

## Web 构建

```bash
cd webapp/_webapp
npm install

npm run build:local:chrome # 构建本地版本（链接至本地后端）
npm run build:prd:chrome # 构建生产环境版本（连接至生产环境服务器）
```

## 从克隆开始

```bash
make all
```