# รายงานความคืบหน้าโครงการ (Virtual Staging AI)

อัปเดตล่าสุด: YYYY-MM-DD (กรุณาแก้วันที่เมื่ออัปเดต)
สถานะโดยรวม: 🟡 กำลังพัฒนา — MVP ทำงานได้, ยังต้องเสริมฟีเจอร์ให้ใกล้ Collov AI

## ภาพรวมเป้าหมาย
- สร้างระบบ Virtual Staging: อัปโหลด → เลือกสไตล์/โหมด → ประมวลผลด้วย AI → แสดงผลก่อน/หลัง
- รองรับ 2 โหมด: Text-to-Image (FLUX) และ Image-to-Image
- เป้าหมายถัดไป: เพิ่ม Room Type, ผลลัพธ์หลายตัวเลือก (multi-variant), ปุ่ม Re-stage

## สถานะล่าสุด
- Frontend (React + Vite + Tailwind):
  - หน้าหลักพร้อมตัวเลือกโหมด Text-to-Image / Image-to-Image
  - อัปโหลดไฟล์และเลือกสไตล์ (scandinavian, japandi, luxury, industrial)
  - แสดงสถานะงาน (creating / processing / error) และรีเซ็ตได้
- Backend (Cloudflare Workers + D1 + R2 + Workers AI):
  - สร้างงาน, อ่านสถานะ, รัน Pipeline, บันทึกผลลง R2
  - แก้ปัญหา Text-to-Image: ไม่ require `originalAssetId` และใช้ placeholder แทน
- AI (FLUX):
  - ใช้ `@cf/black-forest-labs/flux-1-schnell` สำหรับความเร็ว
  - มี style-based prompts สำหรับ Image-to-Image และ custom prompt สำหรับ Text-to-Image

## การเปลี่ยนแปลงล่าสุด
- [YYYY-MM-DD]
  - Frontend: ลบการส่ง `originalAssetId: 'text-to-image'` ในโหมด Text-to-Image, ส่งเฉพาะ `style` และ `mode`
  - Backend: ใช้ `finalAssetId` แทน `originalAssetId` (const) และตั้งค่า `'text-to-image-placeholder'` สำหรับ Text-to-Image
  - Pipeline: ข้ามการ lookup asset เมื่อ `originalAssetId === 'text-to-image-placeholder'`
  - Logs: รีสตาร์ท worker สำเร็จหลังแก้ build error

## ปัญหาที่ทราบ
- Image-to-Image บางเคสยัง error ถ้า asset ไม่มี `r2_key` หรือไฟล์ไม่รองรับ
- คุณภาพผลลัพธ์ยังไม่สม่ำเสมอ (โมเดล schnell เน้นเร็ว)
- ยังไม่มี multi-variant และ Room Type

## แผนงานถัดไป (สัปดาห์นี้)
- ✅ เสถียรภาพ Text-to-Image (placeholder + userEmail ส่งเข้าพื้นฐาน)
- ⏭ เพิ่ม Room Type และปรับ prompt ตามชนิดห้อง
- ⏭ รองรับผลลัพธ์หลายตัวเลือกต่อ job (เช่น 4 รูป, ต่าง seed)
- ⏭ ปุ่ม "Re-stage" เพื่อสร้างผลลัพธ์ใหม่เร็ว ๆ ด้วยพารามิเตอร์เดิม
- ⏭ ปรับปรุงคุณภาพ (ตัวเลือกโมเดล/strength/negative prompt, optional upscale)
- ⏭ เพิ่มหน้า FAQ/Disclaimer/Licensing ใน UI

## วิธีทดสอบอย่างเร็ว
- เปิดเว็บ: `http://localhost:4173`
- Text-to-Image: ใส่ prompt เช่น "modern living room with minimalist furniture" แล้วกด Generate
- Image-to-Image: อัปโหลดภาพ → เลือกสไตล์ → กด Run staging
- ติดตาม worker logs: ดูสถานะ `npm run dev -- --remote` ในโฟลเดอร์ `worker`

## ตัวชี้วัด/การตรวจสอบ
- Jobs table: สถานะ `creating → processing → succeeded/failed`
- R2: ข้อมูลเอาต์พุต `outputs/{jobId}.png`
- Error patterns: missing `r2_key`, unsupported mime, AI quota/limit

## เช็กลิสต์งาน
- [x] โหมด Text-to-Image ใช้งานได้โดยไม่ต้องมี asset
- [x] ส่ง `userEmail` เข้าสู่ pipeline และบันทึกใน assets
- [ ] Room Type + prompt mapping ต่อสไตล์
- [ ] ผลลัพธ์หลายตัวเลือกต่อ job (4 ภาพ)
- [ ] ปุ่ม Re-stage ใน UI
- [ ] ปรับปรุงตัวเลือกโมเดลและคุณภาพผลลัพธ์
- [ ] หน้า FAQ/Disclaimer/Licensing

## Changelog (สรุปย่อรายวัน)
- YYYY-MM-DD: แก้ Text-to-Image placeholder + finalAssetId, อัปเดต UI ส่งพารามิเตอร์
- YYYY-MM-DD: เพิ่ม logging และตรวจสอบ errors ใน worker

## วิธีอัปเดตไฟล์นี้
- แก้วันที่ `อัปเดตล่าสุด`
- เพิ่มรายการใน "การเปลี่ยนแปลงล่าสุด" และ "Changelog"
- ติ๊กเช็กลิสต์งานเมื่อเสร็จ และปรับสถานะโดยรวม