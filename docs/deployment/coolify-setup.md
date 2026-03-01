# Coolify Deployment Guide - ExeTeam

## Prerequisites
- Hostinger VPS with Ubuntu 22.04+
- Coolify installed
- Domain configured: app.exeteam.fr (web), api.exeteam.fr (API)

## Setup Steps

### 1. Install Coolify
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

### 2. Create Services
- Create two services in Coolify: `exeteam-web` and `exeteam-api`
- Connect GitHub repository
- Set build pack: Dockerfile
- Set target: `web` or `api` respectively

### 3. Environment Variables
Copy all variables from `.env.example` and fill in production values.

### 4. SSL
SSL is automatic via Let's Encrypt through Coolify.

### 5. Database Migrations
Run as pre-deploy hook or manually after deploy:
```bash
pnpm db:migrate deploy
```

### 6. Health Checks
- API: `GET /api/v1/health`
- Web: `GET /`

### 7. CI/CD
Configure auto-deploy on push to `main` branch in Coolify settings.
