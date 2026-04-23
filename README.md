# E-Drops: Premium Water Delivery & ERP Platform

E-Drops is a production-grade SaaS platform designed for the Kerala market, supporting multi-brand water sales, subscription logistics, and real-time fleet telemetry.

## 🧱 Project Structure

- **`/server`**: NestJS Modular Monolith (Backend API, BullMQ, Socket.IO)
- **`/website`**: Next.js SEO Landing Page (SSR, App Router)
- **`/dashboard`**: React + Vite Admin & Distributor Portal (Claymorphic UI)
- **`/mobile_customer`**: Flutter App for Customers
- **`/mobile_delivery`**: Flutter App for Delivery Partners

## 🚀 Getting Started

### Prerequisites
- Node.js v20+ & npm
- Docker (for PostgreSQL & Redis)
- Flutter SDK (for mobile apps)

### 1. Database & Infrastructure
```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Setup Backend
cd server
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

### 2. Frontend Applications
```bash
# Start Marketing Website
cd website
npm install
npm run dev

# Start Admin Dashboard
cd dashboard
npm install
npm run dev
```

### 3. Mobile Apps
```bash
cd mobile_customer
flutter pub get
flutter run
```

## 🛠 Tech Stack
- **Backend**: NestJS, Prisma, PostgreSQL, Redis, BullMQ, Socket.IO
- **Web**: Next.js (Website), React/Vite (Dashboard)
- **Mobile**: Flutter, Riverpod, Dio
- **Design**: Tailwind CSS (Web), Google Fonts (Outfit)

## ⚖️ License
UNLICENSED (Internal Webzio Project)
