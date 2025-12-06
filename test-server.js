require("dotenv").config();
const axios = require("axios");

const BOT_URL = process.env.BOT_URL || "https://bot.robonarim.com/send";
const BOT_SECRET = process.env.BOT_SECRET;

if (!BOT_SECRET) {
  console.error("❌ BOT_SECRET is missing in .env");
  process.exit(1);
}

async function main() {
  try {
    const payload = {
      phone: "5389835677", // رقمك بدون 0 بالبداية، أو بالشكل اللي تحب
      message:
        "Test mesajı – Robonarim bot tunnel ✅ اذا وصلك هالرسالة، يعني البوت شغال اونلاين.",
    };

    console.log("➡️ Sending request to bot:", BOT_URL);
    const res = await axios.post(BOT_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-bot-secret": BOT_SECRET,
      },
      timeout: 20000,
    });

    console.log("✅ Response status:", res.status);
    console.log("✅ Response data:", res.data);
  } catch (err) {
    if (err.response) {
      console.error("❌ Error response from bot:");
      console.error("Status:", err.response.status);
      console.error("Data:", err.response.data);
    } else {
      console.error("❌ Request failed:", err.message);
    }
  }
}

main();
