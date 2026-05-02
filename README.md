# <img src="client/public/logo-128.png" width="32" height="32" alt="logo" style="vertical-align: middle;"> WebPush MCP

**Give your AI agents the power to send native browser push notifications.**

[![Live](https://img.shields.io/badge/Live-webpushmcp.com-6366f1?style=flat-square)](https://webpushmcp.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Runs%20on-Cloudflare%20Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)

---

Free, open-source [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that delivers real browser push notifications from any MCP-compatible AI agent — Claude, Cursor, Windsurf, and more.

**No accounts. No registration. No cost. Notifications arrive even when the browser is closed.**

🌐 **Try it now → [webpushmcp.com](https://webpushmcp.com)**

---

## How It Works

```
┌──────────┐     MCP      ┌──────────────────┐    Web Push     ┌─────────┐
│ AI Agent │ ──────────▶   │  WebPush MCP     │ ──────────────▶ │ Browser │
│ (Claude) │   /mcp/:id   │  (CF Worker)     │    VAPID        │  (You)  │
└──────────┘              └──────────────────┘                 └─────────┘
```

1. **You** visit [webpushmcp.com](https://webpushmcp.com) and enable notifications — one click, done.
2. **You** get a personalized MCP endpoint URL (e.g. `https://webpushmcp.com/mcp/your-uuid`).
3. **Your agent** connects to that URL and uses the `send_notification` tool.
4. **You** receive native OS notifications — even if the browser tab is closed.

## Quick Start

### Use the hosted service (recommended)

1. Go to [webpushmcp.com](https://webpushmcp.com)
2. Click **Enable Notifications**
3. Copy your MCP endpoint URL
4. Add it to your agent:

**Claude Desktop** — add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "webpush": {
      "url": "https://webpushmcp.com/mcp/YOUR-CLIENT-ID"
    }
  }
}
```

**Cursor / IDEs** — Settings → Features → MCP → Add Server → Type: `SSE` → paste your URL.

### Tell your agent what to do

Your client ID is baked into the URL, so the agent just needs:

```
When you finish the task, notify me using the send_notification tool with:
  title: "Task Complete"
  body:  "Your report is ready."
```

## MCP Tool

### `send_notification`

| Parameter | Type     | Required | Description |
|-----------|----------|----------|-------------|
| `title`   | string   | ✅       | Notification title (max 200 chars) |
| `body`    | string   | ✅       | Notification body text (max 4000 chars) |
| `url`     | string   | ❌       | URL to open when clicked |

## Self-Hosting

### Prerequisites

- [Node.js](https://nodejs.org) (v20+)
- [Cloudflare account](https://dash.cloudflare.com) (free tier works)
- VAPID keys (generate with `npx web-push generate-vapid-keys`)

### Setup

```bash
git clone https://github.com/webpushmcp/webpushmcp.git
cd webpushmcp
npm install
```

Create a `.dev.vars` file with your VAPID keys:

```env
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
```

### Development

```bash
npm run dev        # Build client + start Wrangler dev server
```

### Testing

```bash
npx vitest run -c vitest.unit.config.ts   # Run unit tests
```

### Deploy

```bash
# Set production secrets (one-time)
npx wrangler secret put VAPID_PUBLIC_KEY --env production
npx wrangler secret put VAPID_PRIVATE_KEY --env production

# Deploy to production
npm run deploy:prod
```

## Architecture

| Component | Technology |
|-----------|-----------|
| **Runtime** | Cloudflare Workers |
| **Storage** | Durable Objects (SQLite) |
| **Push** | Web Push API (VAPID / RFC 8291) |
| **Frontend** | Vanilla HTML + TypeScript + Tailwind CSS |
| **Build** | Vite |
| **MCP SDK** | `@modelcontextprotocol/sdk` |
| **Rate Limiting** | Cloudflare Rate Limiting (layered IP + client) |

### Security

- **Layered rate limiting** — Global IP ceiling + per-client limits prevent abuse, even from attackers using random IDs or corporate NAT environments.
- **No data collection** — Only browser push subscription endpoints and crypto keys are stored. No emails, no names, no tracking.
- **Edge encryption** — All data lives in Cloudflare Durable Objects with built-in encryption at rest.

### Static Assets

Static files (HTML, CSS, JS, images) are served directly from Cloudflare's CDN edge — **your Worker is only invoked for API and MCP endpoints**, keeping costs minimal.

## Project Structure

```
├── client/
│   ├── index.html          # Landing page
│   ├── legal.html          # Legal disclaimer
│   └── src/
│       ├── main.ts          # Frontend logic
│       ├── sw.ts            # Service worker (push handler)
│       └── style.css        # Tailwind styles
├── src/
│   ├── index.ts             # Worker entry point + MCP server
│   ├── mcp/
│   │   ├── rate-limit.ts    # Rate limiting logic (pure function)
│   │   └── rate-limit.test.ts
│   └── store/
│       └── durable-object.ts  # Subscription storage (DO + SQLite)
├── wrangler.jsonc            # Cloudflare Workers config
└── package.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Build client + start local dev server |
| `npm run dev:client` | Vite dev server (client only) |
| `npm run build:client` | Build client assets to `dist/` |
| `npm run deploy` | Build + deploy to default environment |
| `npm run deploy:prod` | Build + deploy to production |
| `npm test` | Run tests |
| `npm run cf-typegen` | Regenerate TypeScript types from wrangler.jsonc |

## License

[MIT](LICENSE)

## Disclaimer

This service is provided **"as is"** without any warranties. See the full [legal disclaimer](https://webpushmcp.com/legal.html) for details.
