---
name: my-skill
description: Short description of what this skill does and when to use it.
---

# PaperDebugger Developer Skill

Detailed instructions for the agent.

## When to Use

- Use this skill when...
- This skill is helpful for...

## Instructions

- Step-by-step guidance for the agent
- Domain-specific conventions
- Best practices and patterns

### webapp/_webapp Developing Notes

- Use `bun` as package manager
- Use `PD_API_ENDPOINT="https://app.paperdebugger.com" npm run _build:office` to build the latest office add-in. it will save the `office.js` file in the `webapp/office/src/paperdebugger/office.js` directory.

### webapp/office Developing Notes

- Use `npm` as package manager, because Office Add-in can only compatible with npm packages.
- Use `npm install` to install packages in this office-addin project.
- Use `npm run dev-server` to start the development server (that update the `office.js` file in real time).
- Use `npm run start` to start a word and load the add-in.
