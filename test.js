// test.js
const fetch = require("node-fetch");

async function testSend() {
  try {
    const response = await fetch("http://localhost:3001/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "905511663824", // ← حط رقمك مع كود تركيا بدون +
        filePath: "./Yelizisik.pdf", // ← اسم ملف الـ PDF المحلي
        message: "🔥 Here's your test PDF from Robonarim bot",
      }),
    });

    const data = await response.json();
    console.log("Response:", data);
  } catch (err) {
    console.error("Error:", err);
  }
}

testSend();
