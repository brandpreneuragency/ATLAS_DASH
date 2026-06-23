# Zen Editor

A minimalist "Zen" text editor with an integrated AI writing assistant. Built with React, TipTap, and Tailwind CSS.

## Features

- **Chrome-style tabs** — Multiple documents open simultaneously, auto-saved to IndexedDB
- **Rich text editor** — Full formatting toolbar (bold, italic, headings, alignment, lists, links, images, color)
- **Auto-save** — Every keystroke is debounced and saved to IndexedDB; sessions restore exactly as left
- **AI Assistant sidebar** — Resizable panel with streaming chat
- **AI context selection** — Highlight text in the editor to automatically send it as context to the AI
- **Apply Change** — One-click replacement of highlighted text with AI suggestion
- **Multi-provider AI** — OpenAI, Google Gemini, OpenRouter (and Anthropic via local proxy)
- **Custom agents** — Create agents with unique names, avatars, and system prompts
- **Quick prompts** — Save and reuse frequently used prompts
- **Export** — DOCX, PDF, and TXT export via the hamburger menu

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Adding an AI Provider

1. Click the **AI Model** button in the top-right header
2. Click **Manage API Keys & Models**
3. Select a provider, paste your API key, choose a model, and click **Save Provider**
4. The provider is now active and ready to use in the sidebar

### Provider Notes

| Provider | CORS | Notes |
|----------|------|-------|
| OpenAI | ✅ Direct | Works in browser |
| Google Gemini | ✅ Direct | Works in browser |
| OpenRouter | ✅ Direct | Access to 100+ models with one key |
| Anthropic | ❌ Requires proxy | Run `node proxy.mjs` first |

### Anthropic Proxy

Anthropic's API does not allow direct browser requests. To use Claude models:

```bash
node proxy.mjs
```

Then in Settings, set the Anthropic base URL to `http://localhost:3001/anthropic`.

Alternatively, use **OpenRouter** with an Anthropic Claude model — it supports CORS and works directly in the browser.

## Tech Stack

- **React 19 + Vite 6 + TypeScript 5**
- **TipTap v2** — ProseMirror-based rich text editor
- **Tailwind CSS v4** — Utility-first styling
- **Dexie.js** — IndexedDB wrapper for persistence
- **Zustand** — Lightweight state management
- **Lucide React** — Icon library
