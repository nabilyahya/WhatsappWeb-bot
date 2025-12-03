// bot.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(cors());

// =============== WhatsApp Client ===============
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

let isReady = false;

client.on("qr", (qr) => {
  console.log("Scan this QR with WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("WhatsApp Bot is ready! 🚀");
  isReady = true;
});

client.on("auth_failure", (msg) => {
  console.error("AUTH FAILURE:", msg);
});

client.on("disconnected", (reason) => {
  console.error("Client was disconnected:", reason);
  isReady = false;
  // إعادة التهيئة لو حبّيت
  client.initialize();
});

client.initialize();

// =============== Helpers ===============

/**
 * نأخذ أي رقم جاي من روبوناريم ونحوله لصيغة دولية تركية بدون +
 * في روبوناريم الأرقام هيك: 5397324662
 * الهدف النهائي: 905397324662
 */
function normalizeToTRInternational(phone) {
  let digits = String(phone || "").replace(/\D+/g, "");

  if (!digits) return null;

  // لو الرقم أصلاً جاي بهالشكل 9053xxxxxxx
  if (digits.startsWith("90") && digits.length === 12) {
    return digits;
  }

  // لو جاي 0539xxxxxxx
  if (digits.startsWith("0") && digits.length === 11 && digits[1] === "5") {
    return "90" + digits.slice(1); // نشيل الـ 0
  }

  // لو جاي 539xxxxxxx (وهي حالتك في روبوناريم)
  if (digits.startsWith("5") && digits.length === 10) {
    return "90" + digits;
  }

  // لو جاي مع +90 من الواجهة الأمامية مثلاً
  if (digits.startsWith("90") && digits.length > 12) {
    // محاولة بسيطة: نأخذ آخر 12 خانة
    return digits.slice(-12);
  }

  // أي شكل غريب آخر
  return digits;
}

// =============== API Endpoint ===============

app.post("/send", async (req, res) => {
  let { phone, message, pdfUrl } = req.body;

  try {
    if (!isReady) {
      console.error("Client not ready yet");
      return res.status(503).json({ ok: false, error: "whatsapp_not_ready" });
    }

    if (!phone || !message) {
      return res
        .status(400)
        .json({ ok: false, error: "missing_phone_or_message" });
    }

    const normalized = normalizeToTRInternational(phone);
    if (!normalized) {
      return res
        .status(400)
        .json({ ok: false, error: "invalid_phone_after_normalize" });
    }

    console.log("Incoming phone:", phone, "→ normalized:", normalized);

    // نتأكد أن الرقم عنده حساب واتساب
    const numberId = await client.getNumberId(normalized);
    if (!numberId) {
      console.error("Not a WhatsApp user:", normalized);
      return res.status(400).json({
        ok: false,
        error: "not_whatsapp_user",
        phone: normalized,
      });
    }

    // 🔹 لو ما في PDF → نرسل رسالة نصية فقط (السلوك القديم)
    if (!pdfUrl) {
      await client.sendMessage(numberId._serialized, message);
      return res.json({ ok: true, sent: "text" });
    }

    // 🔹 لو في pdfUrl → ننزل الملف ونبعتو كـ Document
    console.log("Downloading PDF from:", pdfUrl);

    const tmpDir = path.join(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const fileName = `receipt-${Date.now()}.pdf`;
    const filePath = path.join(tmpDir, fileName);

    // تحميل الملف من الرابط
    const response = await axios.get(pdfUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(filePath, response.data);

    // تحويله لـ MessageMedia
    const media = MessageMedia.fromFilePath(filePath);

    // إرسال الملف مع الكابشن (message)
    await client.sendMessage(numberId._serialized, media, {
      caption: message,
    });

    // حذف الملف بعد الإرسال
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Failed to delete temp PDF:", err);
      } else {
        console.log("Temp PDF deleted:", filePath);
      }
    });

    res.json({ ok: true, sent: "pdf_with_caption" });
  } catch (err) {
    console.error("Error sending:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// =============== Start Server ===============
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});
