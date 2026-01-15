# SSH Mini App

A Telegram Mini App for connecting to remote machines via SSH/Mosh, with saved connections synced across devices.

## Features

- **SSH & Mosh Support** - Connect via standard SSH or mobile-optimized Mosh
- **Terminal Emulation** - Full xterm.js terminal in Telegram
- **Secure Credential Storage** - AES-256-GCM encrypted credentials on backend
- **Cross-Device Sync** - Connection metadata synced via Telegram CloudStorage
- **Telegram Native UI** - Follows Telegram theme and design patterns

## Architecture

```
┌─────────────────────────────────────────┐
│         Telegram Mini App               │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │ Connection  │  │    Terminal     │   │
│  │    List     │  │   (xterm.js)    │   │
│  └─────────────┘  └─────────────────┘   │
│         │ CloudStorage (metadata)       │
└─────────│───────────────────────────────┘
          │ WebSocket
┌─────────▼───────────────────────────────┐
│           Backend Server                │
│  ┌──────────┐  ┌──────────────────────┐ │
│  │ Telegram │  │  SSH/Mosh Proxy      │ │
│  │   Auth   │  │  (ssh2 / node-pty)   │ │
│  └──────────┘  └──────────────────────┘ │
│  ┌──────────────────────────────────┐   │
│  │ SQLite + AES-256-GCM Encryption  │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18, TypeScript, Vite |
| Terminal | xterm.js |
| Telegram SDK | @telegram-apps/sdk |
| Backend | Node.js, Express, TypeScript |
| SSH | ssh2 |
| Mosh | node-pty + mosh-client |
| Database | SQLite (better-sqlite3) |
| Encryption | AES-256-GCM |

## Setup

### 1. Create Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy your bot token
4. Send `/newapp` to configure your Mini App URL

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```bash
BOT_TOKEN=your_bot_token_here
MASTER_KEY=$(openssl rand -hex 32)
DATABASE_PATH=/app/data/ssh-miniapp.db
```

### 3. Run with Docker

```bash
docker-compose build
docker-compose up -d
```

### 4. Development Mode

```bash
# Install dependencies
cd frontend && npm install
cd ../backend && npm install

# Run development servers
npm run dev:frontend  # Terminal 1
npm run dev:backend   # Terminal 2
```

## Security

- **Authentication**: Telegram initData validated via HMAC-SHA256
- **Credentials**: Encrypted with AES-256-GCM, per-user keys derived via PBKDF2
- **Transport**: All communication over HTTPS/WSS
- **Storage**: Credentials never stored in CloudStorage, only encrypted on backend

## License

MIT
