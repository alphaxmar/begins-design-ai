# คู่มือการติดตั้งและ Deploy FLUX Image Generator

คู่มือนี้จะช่วยให้คุณสามารถนำโปรเจกต์ไปรันบน Cloudflare account ของตัวเองได้โดยไม่ต้องแก้ไขโค้ด

## ข้อกำหนดเบื้องต้น

- Node.js เวอร์ชัน 16 หรือใหม่กว่า
- npm หรือ yarn
- Cloudflare account (ฟรี)
- Git

## ขั้นตอนการติดตั้ง

### 1. เตรียม Cloudflare Account

1. ไปที่ [https://cloudflare.com](https://cloudflare.com) และสร้างบัญชีใหม่ (หรือใช้บัญชีที่มีอยู่)
2. เข้าสู่ระบบ Cloudflare Dashboard
3. ไปที่ **My Profile** > **API Tokens**
4. จด **Account ID** ไว้ (จะใช้ในขั้นตอนต่อไป)

### 2. ดาวน์โหลดและติดตั้งโปรเจกต์

```bash
cd ex-cf-worker-img1

# ติดตั้ง dependencies
npm install
```

### 3. ติดตั้งและตั้งค่า Wrangler CLI

```bash
# ติดตั้ง Wrangler (ถ้ายังไม่มี)
npm install -g wrangler

# เข้าสู่ระบบ Cloudflare
wrangler login
```

เมื่อรันคำสั่ง `wrangler login` จะเปิดเบราว์เซอร์ให้คุณล็อกอินเข้า Cloudflare account

### 4. แก้ไข Configuration

แก้ไขไฟล์ `wrangler.toml`:

```toml
name = "flux-image-generator"
main = "src/index.js"
compatibility_date = "2024-01-01"
account_id = "YOUR_ACCOUNT_ID_HERE"

[ai]
binding = "AI"
```

**สำคัญ**: เปลี่ยน `YOUR_ACCOUNT_ID_HERE` เป็น Account ID ของคุณที่ได้จากขั้นตอนที่ 1

### 5. ทดสอบการทำงานในโหมด Development

```bash
npm run dev
```

- จะเห็น URL สำหรับทดสอบ (เช่น http://localhost:8787)
- เปิดเบราว์เซอร์และทดสอบการสร้างรูปภาพ
- กด Ctrl+C เพื่อหยุดการทำงาน

### 6. Deploy ไปยัง Cloudflare

```bash
npm run deploy
```

หลังจาก deploy สำเร็จ จะได้ URL สำหรับใช้งานจริง เช่น:
```
https://flux-image-generator.your-subdomain.workers.dev
```

## การใช้งาน

### ผ่าน Web Interface
1. เปิดเบราว์เซอร์ไปยัง URL ที่ได้จาก deploy
2. ใส่คำอธิบายภาพที่ต้องการ
3. เลือก aspect ratio (ถ้าต้องการ)
4. คลิก "Generate Image"

### ผ่าน API
```bash
curl -X POST https://your-worker-url.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A beautiful sunset over mountains"}'
```

## การแก้ไขปัญหา

### ปัญหา: "Account ID not found"
- ตรวจสอบว่า Account ID ใน `wrangler.toml` ถูกต้อง
- ไปที่ Cloudflare Dashboard > ขวาล่าง จะเห็น Account ID

### ปัญหา: "Authentication failed"
- รัน `wrangler logout` แล้ว `wrangler login` ใหม่
- ตรวจสอบว่าได้ล็อกอินเข้า account ที่ถูกต้อง

### ปัญหา: "Worker name already exists"
- แก้ไข `name` ใน `wrangler.toml` เป็นชื่อใหม่ที่ไม่ซ้ำ

### ปัญหา: API ไม่ทำงาน
- ตรวจสอบว่า Cloudflare AI มีใน plan ของคุณ (Workers Free plan สามารถใช้ได้)
- ดู logs: `wrangler tail`

## ข้อมูลเพิ่มเติม

- **ค่าใช้จ่าย**: Workers Free plan ให้ใช้ 100,000 requests ต่อวัน
- **AI Model**: ใช้ FLUX-1-schnell บน Cloudflare AI
- **Supported formats**: รองรับ aspect ratios: 1:1, 16:9, 9:16, 4:3
- **การอัปเดต**: เมื่อแก้ไขโค้ด รัน `npm run deploy` ใหม่

## คำสั่งที่มีประโยชน์

```bash
# ดู logs แบบ real-time
wrangler tail

# ดูข้อมูล deployment
wrangler deployments list

# ลบ worker
wrangler delete

# ดู account info
wrangler whoami
```

---

**หมายเหตุ**: คู่มือนี้ใช้สำหรับ Cloudflare Workers Free plan หากใช้ plan อื่นอาจมีฟีเจอร์เพิ่มเติม