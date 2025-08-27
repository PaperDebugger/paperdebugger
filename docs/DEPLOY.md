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
