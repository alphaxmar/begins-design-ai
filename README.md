
# BeginsDesignAI

ระบบ AI Virtual Staging สำหรับการแต่งห้องด้วย AI โดยใช้ Cloudflare Stack

## 🏗️ โครงสร้างโปรเจค

```
BeginsDesignAI/
├── worker/          # Cloudflare Worker (Hono) + D1 + R2 + Workers AI + Access JWT
├── apps/web/        # React + Vite + Tailwind (Dashboard: อัปโหลด → เลือกสไตล์ → Run)
├── migrations/      # สคีมา D1 (assets, jobs, usage_logs)
└── README.md        # คู่มือการใช้งาน
```

## ✨ คุณสมบัติ

- **Authentication**: ตรวจสอบผ่าน Cloudflare Access JWT (CF-Access-Jwt-Assertion)
- **File Upload**: อัปโหลดรูปภาพผ่าน R2 Presigned URLs
- **AI Processing**: ประมวลผลภาพด้วย Workers AI (Flux-1-Schnell)
- **Style Options**: 4 สไตล์ - Scandinavian, Japandi, Luxury, Industrial
- **Real-time Status**: ติดตามสถานะงานแบบ real-time
- **Before/After**: เปรียบเทียบภาพก่อน-หลังด้วย slider

## 🚀 ขั้นตอนติดตั้งแบบสั้น

### 1. ติดตั้ง Wrangler และเตรียมทรัพยากร

```bash
# ติดตั้ง Wrangler CLI
npm install -g wrangler

# สร้างทรัพยากร Cloudflare
wrangler d1 create staging-db
wrangler r2 bucket create staging-bucket
wrangler queues create staging-jobs
```

### 2. กำหนดค่า Environment Variables

เปิดไฟล์ `worker/wrangler.toml` แล้วใส่ค่าต่อไปนี้:

```toml
# ใส่ database_id ของ D1 ที่เพิ่งสร้าง
database_id = "your-d1-database-id-here"

# ใส่ค่า Cloudflare Access
ACCESS_AUD = "your-access-app-aud-uuid-here"
ACCESS_JWKS_URL = "https://your-team.cloudflareaccess.com/cdn-cgi/access/certs"

# (ถ้าใช้ Stripe จริงให้ใส่ค่าเหล่านี้ภายหลัง)
STRIPE_SECRET = "sk_test_your_stripe_secret_key_here"
STRIPE_WEBHOOK_SECRET = "whsec_your_stripe_webhook_secret_here"
```

### 3. Apply Migrations และรัน Worker

```bash
cd worker
pnpm install
wrangler d1 migrations apply staging-db
pnpm dev
```

### 4. รันเว็บแอป (อีกหนึ่งเทอร์มินัล)

```bash
cd ../apps/web
pnpm install
pnpm dev
```

## 🎯 การใช้งาน

1. เปิดเบราว์เซอร์ไปที่ `http://localhost:5173`
2. อัปโหลดรูปภาพห้อง (JPG/PNG)
3. เลือกสไตล์ที่ต้องการ (Scandinavian, Japandi, Luxury, Industrial)
4. กดปุ่ม "Run staging" เพื่อเริ่มประมวลผล
5. รอผลลัพธ์และดูการเปรียบเทียบ Before/After

## 🔧 โครงสร้างเทคนิค

### Worker (Backend)

- **Framework**: Hono.js
- **Database**: Cloudflare D1
- **Storage**: Cloudflare R2
- **AI**: Workers AI (Flux-1-Schnell)
- **Queue**: Cloudflare Queues
- **Auth**: Cloudflare Access JWT

### Web App (Frontend)

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Query
- **Forms**: React Hook Form + Zod

### API Endpoints

```
GET  /api/health                    # Health check
POST /api/uploads/presign           # สร้าง presigned URL สำหรับอัปโหลด
POST /api/uploads/commit            # ยืนยันการอัปโหลดเสร็จสิ้น
POST /api/jobs                      # สร้างงาน AI processing
GET  /api/jobs/:id                  # ดูสถานะงาน
POST /api/staging/:id/run           # เรียกใช้ AI pipeline
POST /api/billing/create-checkout   # สร้าง checkout (stub)
```

### Database Schema

```sql
-- ตาราง assets: เก็บข้อมูลไฟล์ที่อัปโหลด
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  kind TEXT NOT NULL,              -- original|intermediate|output
  r2_key TEXT NOT NULL,
  mime TEXT,
  width INTEGER,
  height INTEGER,
  bytes INTEGER,
  checksum TEXT,
  meta JSON,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

-- ตาราง jobs: เก็บข้อมูลงาน AI processing
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  original_asset_id TEXT NOT NULL,
  original_r2_key TEXT NOT NULL,
  status TEXT NOT NULL,            -- queued|processing|succeeded|failed|canceled
  style TEXT,
  prompt TEXT,
  negative_prompt TEXT,
  strength REAL,
  seed INTEGER,
  model TEXT,
  output_r2_key TEXT,
  error TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER
);

-- ตาราง usage_logs: เก็บข้อมูลการใช้งานและเครดิต
CREATE TABLE usage_logs (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  job_id TEXT,
  amount INTEGER NOT NULL,         -- credits delta (+pack, -job)
  reason TEXT,                     -- job|gift|refund|purchase
  created_at INTEGER DEFAULT (strftime('%s','now'))
);
```

## 🎨 Style Presets

ระบบมี 4 สไตล์ให้เลือก:

1. **Scandinavian**: bright scandinavian interior, light oak wood, white walls, minimalist, natural light, magazine grade
2. **Japandi**: japandi interior, warm wood, linen, neutral palette, low profile furniture, zen, soft ambient light
3. **Luxury**: contemporary luxury, marble, brass accents, designer lighting, cinematic
4. **Industrial**: industrial loft, concrete, black steel frames, leather sofa, matte surfaces

## 🔐 Security & Authentication

- ใช้ Cloudflare Access สำหรับ authentication
- ตรวจสอบ JWT token ผ่าน `CF-Access-Jwt-Assertion` header
- ไม่เก็บ sensitive data ใน code
- ใช้ environment variables สำหรับ secrets

## 💳 Billing (Stub Implementation)

ปัจจุบันเป็น stub implementation ที่ให้เครดิตทันทีเพื่อการ demo:
- `pack_200`: ให้ 200 เครดิต
- อื่นๆ: ให้ 60 เครดิต

สำหรับ production ควรเชื่อมต่อกับ Stripe จริง

## 🚀 Deployment

### Worker Deployment

```bash
cd worker
wrangler deploy
```

### Web App Deployment

```bash
cd apps/web
pnpm build
# Deploy ไฟล์ใน dist/ ไปยัง hosting service ที่ต้องการ
```

## 🔧 Development Tips

1. **Local Development**: Worker รันที่ port 8787, Web app รันที่ port 5173
2. **Proxy Setup**: Vite proxy `/api/*` ไปยัง worker
3. **Hot Reload**: ทั้ง worker และ web app รองรับ hot reload
4. **Database**: ใช้ `wrangler d1 execute` สำหรับ debug database
5. **Logs**: ใช้ `wrangler tail` เพื่อดู worker logs

## 📝 TODO สำหรับ Production

- [ ] เชื่อมต่อ Stripe จริงสำหรับ billing
- [ ] เพิ่ม signed URLs สำหรับดาวน์โหลดจาก R2
- [ ] เพิ่ม rate limiting
- [ ] เพิ่ม error handling ที่ดีกว่า
- [ ] เพิ่ม monitoring และ analytics
- [ ] เพิ่ม unit tests
- [ ] เพิ่ม CI/CD pipeline

## 🆘 Troubleshooting

### Worker ไม่ทำงาน
- ตรวจสอบ `wrangler.toml` ว่าใส่ค่าครบถ้วน
- ตรวจสอบ D1 database ว่าสร้างแล้วและ apply migrations แล้ว
- ตรวจสอบ R2 bucket และ Queue ว่าสร้างแล้ว

### Web App ไม่เชื่อมต่อ API
- ตรวจสอบ proxy configuration ใน `vite.config.ts`
- ตรวจสอบว่า worker รันอยู่ที่ port 8787

### Authentication Error
- ตรวจสอบ Cloudflare Access configuration
- ตรวจสอบ `ACCESS_AUD` และ `ACCESS_JWKS_URL` ใน wrangler.toml

## 📄 License

MIT License - ดูรายละเอียดใน LICENSE file

