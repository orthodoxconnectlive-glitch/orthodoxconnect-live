# OrthodoxConnect ✝️

A full-stack, real-time social network and community fellowship platform built for Orthodox Christian parishes, clergy, deacons, and youth.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v20.x or v22.x+
- **npm**, **pnpm**, or **bun**

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Development Server
```bash
npm run dev
```
The application will launch on `http://localhost:3000`.

> **Local D1 Database**: The dev server includes a native zero-config local SQLite D1 database emulator (`node:sqlite`). It automatically loads `schema.sql` and seeds initial accounts on first run.

---

## 📦 How to Upload to GitHub

To initialize git and push to your GitHub repository:

```bash
# 1. Initialize git repository (if not already initialized)
git init

# 2. Stage all project files
git add .

# 3. Create your initial commit
git commit -m "feat: initial commit for OrthodoxConnect with Cloudflare D1 & Worker support"

# 4. Link your remote GitHub repository
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY_NAME>.git

# 5. Push to GitHub
git push -u origin main
```

### Subsequent Updates to GitHub
```bash
git add .
git commit -m "update: improvements and bug fixes"
git push origin main
```

---

## ☁️ Deployment (Cloudflare Workers + D1)

OrthodoxConnect is designed to deploy seamlessly to Cloudflare Workers with D1 and Bunny Stream integration.

### 1. Authenticate with Cloudflare Wrangler
```bash
npx wrangler login
```

### 2. Provision / Verify your D1 Database
If you haven't created your D1 database yet:
```bash
npx wrangler d1 create orthodoxconnect
```
*Update your `database_id` inside `wrangler.toml` if you created a new database.*

### 3. Initialize Remote D1 Database Schema
```bash
npm run d1:init
# or: npx wrangler d1 execute orthodoxconnect --file=./schema.sql --remote
```

### 4. Deploy Application
```bash
npm run build
npm run deploy
```

---

## 🔑 Environment Variables & Configuration

Create a `.env` file for your local environment (refer to `.env.example`):

| Variable | Description |
| :--- | :--- |
| `VITE_BUNNY_LIBRARY_ID` | Bunny.net Video Library ID |
| `VITE_BUNNY_API_KEY` | Bunny.net Video Access Key |
| `VITE_BUNNY_CDN_HOST` | Bunny.net CDN Pull Zone Hostname |
| `GEMINI_API_KEY` | Google Gemini API key for AI parish reflections |

---

## 👥 Default Demo & Admin Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| 👑 **Super Admin** | `orthodoxconnect.live@gmail.com` | `admin123` |
| ✝️ **Clergy / Priest** | `fr.anthony@orthodox.org` | `orthodox123` |
| 🕊️ **Parish Servant** | `deacon.mark@orthodox.org` | `orthodox123` |

---

## 🛠️ Project Structure

```
├── schema.sql           # Complete SQLite / D1 database schema
├── wrangler.toml        # Cloudflare Workers & D1 configuration
├── vite.config.ts       # Vite config + local D1 worker dev server middleware
├── src/
│   ├── worker.ts        # Cloudflare Worker API backend (Auth, Posts, Chats, D1)
│   ├── dev-d1.ts        # Zero-config local D1 SQLite emulator
│   ├── App.tsx          # Main routing & state controller
│   ├── components/      # Reusable UI components (Navbar, Modals, Feed, Video Player)
│   ├── views/           # Full-page views (Feed, Messenger, Events, Admin, Notifications)
│   ├── context/         # Auth, Theme, Call & Audio contexts
│   └── utils/           # Helper utilities, caching, and push notifications
```

---

## 📜 License
MIT License. Built for the Orthodox Christian Community.
