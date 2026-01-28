![branding](docs/imgs/branding.png)

**Explore the demo paper’s supporting assets in the [/demo](/demo/) folder.**

<div align="center">
<a href="https://chromewebstore.google.com/detail/paperdebugger/dfkedikhakpapbfcnbpmfhpklndgiaog" target="_blank"><img src="https://img.shields.io/chrome-web-store/users/dfkedikhakpapbfcnbpmfhpklndgiaog?label=Users" alt="Chrome Web Store Users"/></a>
<a href="https://chromewebstore.google.com/detail/paperdebugger/dfkedikhakpapbfcnbpmfhpklndgiaog" target="_blank"><img src="https://img.shields.io/chrome-web-store/v/dfkedikhakpapbfcnbpmfhpklndgiaog?label=Chrome%20Web%20Store&logo=google-chrome&logoColor=white" alt="Chrome Web Store Version"/></a>
<a href="https://github.com/PaperDebugger/paperdebugger/releases" target="_blank"><img src="https://img.shields.io/github/v/release/PaperDebugger/paperdebugger?label=Latest%20Release" alt="GitHub Release"/></a>
<a href="https://github.com/PaperDebugger/paperdebugger/actions/workflows/release.yml" target="_blank"><img src="https://img.shields.io/github/actions/workflow/status/PaperDebugger/paperdebugger/build.yml?branch=main" alt="Build Status"/></a>
<a href="https://github.com/PaperDebugger/PaperDebugger?tab=AGPL-3.0-1-ov-file"><img src="https://img.shields.io/github/license/PaperDebugger/paperdebugger" alt="License"/></a>
</div>

**PaperDebugger** is an AI-powered academic writing assistant that helps researchers debug and improve their research papers with intelligent suggestions and seamless Overleaf integration, without leaving the editor. It is powered by our [custom MCP-based orchestration engine](demo/xtramcp/readme.md) that simulates the full academic workflow **Research → Critique → Revision**. <br>
This enables multi-step reasoning, reviewer-style critique, and structured revision passes beyond standard chat-based assistance.

<div align="center">
    <a href="https://chromewebstore.google.com/detail/paperdebugger/dfkedikhakpapbfcnbpmfhpklndgiaog" target="_blank"><strong>🚀 Install from Chrome Web Store</strong></a>
</div>

<div align="center">
  <img src="docs/imgs/preview2.png" width="47%" style="margin: 0 1.5%;"/>
  <img src="docs/imgs/preview3.png" width="44.6%" style="margin: 0 1.5%;"/>
  <img src="docs/imgs/preview1.png" width="96%" style="margin: 0 1.5%; border-radius: 0.5rem;"/>
</div>

## Community
Our team is actively working to improve long-term reliability, hoping to iron out issues this month. Thank you for your patience. <br>
Stay connected with the PaperDebugger community! Join our [Discord](https://discord.gg/WwTMzzt9xD) or WeChat channels for updates, announcements, and support.

<div align="center">
  <img src="docs/imgs/discord.png" width="40%" style="margin: 0 3%; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"/>
  <img src="docs/imgs/wechat.jpg" width="40%" style="margin: 0 3%; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"/>
</div>


## Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
  - [For Users](#for-users)
  - [Custom Endpoint Configuration](#custom-endpoint-configuration)
- [Architecture Overview](#architecture-overview)
- [Self-Host Development Setup](#self-host-development-setup)

## Features

PaperDebugger never modifies your project, it only reads and provides suggestions.

- **🤖 AI-Powered Chat**: Intelligent conversations about your Overleaf project
- **⚡ Instant Insert**: One-click insertion of AI responses into your project
- **💬 Comment System**: Automatically generate and insert comments into your project
- **📚 Prompt Library**: Custom prompt templates for different use cases
- **🔒 Privacy First**: Your content stays secure - we only read, never modify
- **🧠 Multi-Agent Orchestration** – [XtraMCP](demo/xtramcp/readme.md) support for literature-grounded research, AI-Conference review, citation verification, and domain-specific revision

https://github.com/user-attachments/assets/6c20924d-1eb6-44d5-95b0-207bd08b718b

## Quick Start

### For Users

1. **Install the extension fron [Chrome Web Store](https://chromewebstore.google.com/detail/paperdebugger/dfkedikhakpapbfcnbpmfhpklndgiaog)**

2. **Ready to use**
   - Open any Overleaf project
   - Click the PaperDebugger icon on the top-left
   - Begin chatting with your LaTeX assistant!

### Custom Endpoint Configuration

If you want to use a **self-hosted** PaperDebugger backend, you can configure a custom endpoint. Here are the steps:

1. Open the PaperDebugger extension

    (a.) Go to Settings, click the version number 5 times to enable "Developer Tools" 

    (b.) Enter your backend URL in the "Backend Endpoint" field 
2. Refresh the page

If you encounter endpoint errors after refresh, use the "Advanced Options" at the bottom of the login page to reconfigure.

<div align="center">
  <img src="docs/imgs/custom endpoint.png" alt="Custom Endpoint Configuration" style="max-width: 600px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"/>
</div>

## Architecture Overview

The PaperDebugger backend is built with modern technologies:

<div align="center">
  <img src="docs/imgs/stacks.png" alt="Stacks" style="max-height: 200px; border-radius: 16px;" />
</div>

- **Language**: Go 1.24+
- **Framework**: Gin (HTTP) + gRPC (API)
- **Database**: MongoDB
- **AI Integration**: OpenAI API
- **Architecture**: Microservices with Protocol Buffers
- **Authentication**: JWT-based with OAuth support

## Self-Host Development Setup

Please refer to [DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Citation
```
@misc{hou2025paperdebugger,
      title={PaperDebugger: A Plugin-Based Multi-Agent System for In-Editor Academic Writing, Review, and Editing}, 
      author={Junyi Hou and Andre Lin Huikai and Nuo Chen and Yiwei Gong and Bingsheng He},
      year={2025},
      eprint={2512.02589},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2512.02589}, 
}
```
