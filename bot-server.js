require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { log } = require("console");

const app = express();
app.use(express.json());

// 🔐 CORS: السماح فقط لدومينات معيّنة
app.use(
  cors({
    origin: [
      "https://www.robonarim.com",
      "https://robonarim.com",
      "http://localhost:3000", // ✅ بدون السلاش
      // لو عندك دومينات أخرى زيدها هون
    ],
  })
);

// ✅ قراءة BOT_SECRET مع trim لإزالة أي فراغات غير مقصودة
const BOT_SECRET = (process.env.BOT_SECRET || "").trim();

// ⚠️ لوج خفيف للمساعدة في الديبغ (بدون كشف السر كامل)
console.log("BOT SECRET INIT", {
  hasSecret: !!BOT_SECRET,
  length: BOT_SECRET.length,
});

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
  client.initialize();
});

client.initialize();

// =============== Helpers ===============

function normalizeToTRInternational(phone) {
  let digits = String(phone || "").replace(/\D+/g, "");

  if (!digits) return null;

  if (digits.startsWith("90") && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith("0") && digits.length === 11 && digits[1] === "5") {
    return "90" + digits.slice(1);
  }

  if (digits.startsWith("5") && digits.length === 10) {
    return "90" + digits;
  }

  if (digits.startsWith("90") && digits.length > 12) {
    return digits.slice(-12);
  }

  return digits;
}

// ✅ Route بسيط للفحص من المتصفح
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    isReady,
  });
});

// =============== Middleware للتأكد من السر ===============

app.use((req, res, next) => {
  if (req.path === "/health") return next(); // health بدون حماية

  const headerSecret = (req.headers["x-bot-secret"] || "").toString().trim();

  if (!BOT_SECRET || headerSecret !== BOT_SECRET) {
    console.warn("BOT_SECRET:", BOT_SECRET, "headerSecret:", headerSecret);
    console.warn("Unauthorized request to bot", {
      path: req.path,
      ip: req.ip,
      headerLen: headerSecret.length,
      envLen: BOT_SECRET.length,
      match: headerSecret === BOT_SECRET,
    });
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  next();
});

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

    const numberId = await client.getNumberId(normalized);
    if (!numberId) {
      console.error("Not a WhatsApp user:", normalized);
      return res.status(400).json({
        ok: false,
        error: "not_whatsapp_user",
        phone: normalized,
      });
    }

    // فقط رسالة نصية
    if (!pdfUrl) {
      await client.sendMessage(numberId._serialized, message);
      return res.json({ ok: true, sent: "text" });
    }

    // مع PDF
    console.log("Downloading PDF from:", pdfUrl);

    const tmpDir = path.join(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const fileName = `receipt-${Date.now()}.pdf`;
    const filePath = path.join(tmpDir, fileName);

    const response = await axios.get(pdfUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(filePath, response.data);

    const media = MessageMedia.fromFilePath(filePath);

    await client.sendMessage(numberId._serialized, media, {
      caption: message,
    });

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
const HOST = "0.0.0.0"; // مهم ليشتغل على كل الواجهات

app.listen(PORT, HOST, () => {
  console.log(`API running at http://${HOST}:${PORT}`);
});
