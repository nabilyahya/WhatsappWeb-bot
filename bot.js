const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// WhatsApp Client
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "robonarim-bot",
  }),
  puppeteer: {
    headless: true, // يخلي المتصفح مخفي
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

// QR Code أول مرة فقط
client.on("qr", (qr) => {
  console.log("Scan this QR:");
  qrcode.generate(qr, { small: true });
});

// جاهز
client.on("ready", () => {
  console.log("WhatsApp Bot is ready! 🚀");
});

// لاستقبال طلبات من Robonarim أو من test.js
app.post("/send", async (req, res) => {
  const { phone, message, filePath } = req.body;

  if (!phone) {
    return res.status(400).json({ error: "phone required" });
  }

  try {
    // لو فيه ملف (مثل PDF) نرسله
    if (filePath) {
      const media = MessageMedia.fromFilePath(filePath);
      await client.sendMessage(phone + "@c.us", media);
    }

    // لو فيه رسالة نصية نرسلها
    if (message) {
      await client.sendMessage(phone + "@c.us", message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error sending:", err);
    res.status(500).json({ error: "Failed to send" });
  }
});

// WhatsApp Start
client.initialize();

// API Server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});
