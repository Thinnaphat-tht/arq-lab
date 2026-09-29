# ARQ Lab

แล็บจำลอง Flow Control และ ARQ (Stop-and-Wait, Go-Back-N, Selective Repeat) สำหรับทบทวนวิชา Data Communication (ITDS231 Lecture 5.2)

เว็บหน้าเดียว ไม่ต้องติดตั้งอะไร ดับเบิลคลิก `ARQ-Lab.html` เพื่อเปิดในเบราว์เซอร์ได้เลย

## มีอะไรบ้าง

- **แล็บจำลอง** แผนภาพเวลาผู้ส่ง/ผู้รับ คลิกเส้นเฟรมหรือ ACK ที่กำลังวิ่งเพื่อทำให้หาย หรือเพิ่มเหตุการณ์ (หาย / ช้า) จากฟอร์ม ดู window ฝั่งส่งและฝั่งรับ timer และบันทึกเหตุการณ์
- **ตารางเทียบ 3 ARQ** และหลุมพรางข้อสอบ 5 ข้อ
- **เครื่องคิดเลข** RTT, เวลารวม, Bandwidth-Delay Product, Utilization และ window ที่ต้องใช้
- สลับโหมดสว่าง/มืดได้

## กติกาของตัวจำลอง

เวลาเป็นหน่วย tick: ส่ง 1 เฟรมต่อ tick, เดินทางทางเดียว 3 tick, timeout 8 tick

- Stop-and-Wait คือ Go-Back-N ที่ window = 1 และเลขลำดับ 0/1
- Go-Back-N: Ws = 2^m − 1, Wr = 1, cumulative ACK, timer ตัวเดียวที่เฟรมเก่าสุด, timeout แล้วย้อนส่งใหม่ตั้งแต่เฟรมเก่าสุด
- Selective Repeat: Ws = Wr = 2^(m−1), individual ACK, timer แยกรายเฟรม, ส่งซ้ำเฉพาะเฟรมที่หาย

รายละเอียดเต็มอยู่ใน [`ARQ-Lab-spec.md`](ARQ-Lab-spec.md)

## โครงโปรเจกต์

```
ARQ-Lab.html          หน้าเว็บที่สร้างเสร็จแล้ว (ไฟล์เดียว)
ARQ-Lab-spec.md       สเปค
arq-src/
  engine.js           ตรรกะจำลอง + สูตรคำนวณ (ไม่พึ่ง DOM)
  template.html       เทมเพลตหน้าเว็บ (HTML + CSS + JS ส่วนแสดงผล)
  build.js            รวม engine.js เข้ากับเทมเพลตเป็น ARQ-Lab.html
  test.js             ชุดตรวจตรรกะ
```

## รันชุดตรวจและสร้างไฟล์ใหม่

ต้องมี [Node.js](https://nodejs.org)

```
node arq-src/test.js     # ตรวจตรรกะ
node arq-src/build.js    # สร้าง ARQ-Lab.html ใหม่
```

ชุดตรวจครอบคลุม: ขนาด window ตามสูตร, ตัวเลขตัวอย่างจากสไลด์ (RTT, BDP, Utilization), เฟรมหาย (GBN ส่งซ้ำ 4 เฟรม, SR ส่งซ้ำเฟรมเดียว), ACK หายแต่ ACK ถัดไปมาทัน, ACK มาช้าจนเกิดเฟรมซ้ำ, เลขลำดับวนรอบ และการส่งจบทุกโหมดเมื่อเฟรม/ACK หาย

## หมายเหตุ

ทำขึ้นเพื่อการเรียน อ้างอิงเนื้อหาจากสไลด์ ITDS231 Lecture 5.2 (Flow Control, ARQ & HDLC) ยังไม่รวมส่วน HDLC
