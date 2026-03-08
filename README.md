# 🐟 AquaFarm — Catfish Farm Management App

A beautiful, mobile-first farm management app built for Nigerian catfish farmers. 
Tracks batches, feeding, mortality, water quality, and profits — all in one place.

---

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Frontend  | Next.js 14 (App Router)           |
| Styling   | Tailwind CSS + Custom Design System |
| Charts    | Recharts                          |
| Backend   | Next.js API Routes (no separate server) |
| Database  | MongoDB Atlas                     |
| Auth      | NextAuth.js (JWT)                 |
| Deploy    | Vercel (recommended)              |

---

## 🚀 Quick Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set up MongoDB Atlas (FREE)
1. Go to https://cloud.mongodb.com
2. Create a free account
3. Create a new cluster (M0 free tier)
4. Create a database user (username + password)
5. Whitelist your IP (or 0.0.0.0/0 for all)
6. Get your connection string (looks like: `mongodb+srv://user:pass@cluster.mongodb.net/`)

### 3. Configure environment variables
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASS@cluster0.xxxxx.mongodb.net/aquafarm?retryWrites=true&w=majority
NEXTAUTH_SECRET=any-long-random-string-here  # generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
```

### 4. Run development server
```bash
npm run dev
```

Open http://localhost:3000 — you'll be redirected to /login

### 5. Create your account
- Click "Register"
- Enter your name, farm name, email, password
- You're in!

---

## 📱 Features

| Page          | What it does                                         |
|---------------|------------------------------------------------------|
| Dashboard     | KPI overview, charts, batch progress, P&L summary    |
| Batches       | Create & track production batches with week timeline  |
| Daily Log     | Quick-entry feeding, water quality, mortality logger  |
| Mortality     | Dedicated mortality tracker with cause analysis       |
| Financials    | Expense tracker, revenue logger, profit calculator   |
| Tanks         | Tank setup with water level guidance                 |
| Calendar      | Week-by-week timeline with sorting reminders         |

---

## 🌐 Deploy to Vercel (FREE)

### Option A: Via Vercel CLI
```bash
npm install -g vercel
vercel
```

### Option B: Via GitHub
1. Push this repo to GitHub
2. Go to https://vercel.com
3. Import your GitHub repo
4. Add environment variables in Vercel dashboard:
   - `MONGODB_URI`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (set to your Vercel URL e.g. https://aquafarm.vercel.app)
5. Deploy!

---

## 🏗️ Project Structure

```
aquafarm/
├── app/
│   ├── (auth)/login/         → Login & register page
│   ├── (dashboard)/
│   │   ├── dashboard/        → Main KPI dashboard
│   │   ├── batches/          → Batch management
│   │   ├── feeding/          → Daily log entry
│   │   ├── mortality/        → Mortality tracker
│   │   ├── financials/       → Cost & profit
│   │   ├── tanks/            → Tank setup
│   │   └── calendar/         → Production calendar
│   └── api/
│       ├── auth/             → NextAuth + register
│       ├── batches/          → Batch CRUD
│       ├── logs/             → Daily log CRUD
│       ├── tanks/            → Tank CRUD
│       └── financials/       → Financial tracking
├── components/
│   ├── layout/Sidebar.tsx    → Nav sidebar (desktop + mobile)
│   └── Providers.tsx         → Session provider
├── lib/
│   ├── db.ts                 → MongoDB connection
│   ├── auth.ts               → NextAuth config
│   └── utils.ts              → Helper functions
├── models/                   → Mongoose schemas
│   ├── User.ts
│   ├── Batch.ts
│   ├── DailyLog.ts
│   ├── Tank.ts
│   └── Financial.ts
└── app/globals.css           → Design system & custom styles
```

---

## 💡 SaaS Upgrade Path (Future)

When you're ready to sell this to other farmers:

1. **Multi-tenancy** — Already built in (userId on every document)
2. **Subscription plans** — Add Stripe/Paystack integration
3. **Plan gating** — Use `user.plan` field (free/pro already in schema)
4. **Admin dashboard** — Add `/admin` route for managing farmers
5. **SMS alerts** — Add Termii/Africa's Talking for sort reminders
6. **Offline support** — Add PWA manifest for offline mobile use

---

## 📞 Your Farm Setup

Pre-configured for:
- **Location:** Abuja, Nigeria
- **Initial batch:** 550 juveniles (500 paid + 20 bonus)
- **Cost:** ₦35,000 (₦70/fish)
- **4 tanks:** Tarpaulin + 3 half-cut water tanks
- **Cycle:** ~16–18 weeks (starting from juveniles)
- **Target:** December harvest for Christmas price premium (+30–50%)
