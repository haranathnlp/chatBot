import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error("❌ GROQ_API_KEY is missing from .env");
  process.exit(1);
}

const groq = new Groq({ apiKey });

// ✅ YOUR ACTUAL AVAILABLE MODELS
const MODELS = [
  "qwen/qwen3.6-27b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "groq/compound",
  "groq/compound-mini",
  "allam-2-7b"
];

let activeModel = null;
const conversations = {};

// ✅ Helper function to clean response
function cleanResponse(text) {
  // Remove <think>...</think> tags and their content
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  
  // Remove any leftover "think" artifacts
  cleaned = cleaned.replace(/<\/?think>/g, '').trim();
  
  // If empty after cleaning, return original
  return cleaned || text;
}

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    model: activeModel || "auto-detecting",
    available_models: MODELS,
    timestamp: new Date().toISOString()
  });
});

// Chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    const sessionId = req.body?.session_id || "default";

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (activeModel) {
      const result = await callGroq(message, sessionId, activeModel);
      return res.json(result);
    }

    for (const model of MODELS) {
      try {
        console.log(`🔄 Trying model: ${model}`);
        const result = await callGroq(message, sessionId, model);
        activeModel = model;
        console.log(`✅ Using model: ${activeModel}`);
        return res.json(result);
      } catch (error) {
        console.log(`❌ ${model} failed:`, error.message);
      }
    }

    return res.status(500).json({
      error: "All models failed. Please check your API key.",
      success: false
    });

  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      error: error.message,
      success: false
    });
  }
});

// Helper function to call Groq
async function callGroq(message, sessionId, model) {
  if (!conversations[sessionId]) {
    conversations[sessionId] = [];
  }

  if (conversations[sessionId].length > 20) {
    conversations[sessionId] = conversations[sessionId].slice(-20);
  }

  const messages = [
    { role: "system", content: "You are a helpful AI assistant. Answer clearly and concisely. Never use <think> tags in your response." },
    ...conversations[sessionId],
    { role: "user", content: message }
  ];

  const result = await groq.chat.completions.create({
    model: model,
    messages: messages,
    temperature: 0.7,
    max_tokens: 1024
  });

  let reply = result.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";

  // ✅ Clean the response
  reply = cleanResponse(reply);

  conversations[sessionId].push({ role: "user", content: message });
  conversations[sessionId].push({ role: "assistant", content: reply });

  return {
    response: reply,
    success: true,
    model: model
  };
}

// Start server
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
  console.log(`📦 Available models: ${MODELS.join(", ")}`);
});









// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import { GoogleGenAI } from "@google/genai";

// dotenv.config();

// const app = express();
// const PORT = 5000;

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Gemini API key
// const apiKey = process.env.GEMINI_API_KEY;

// if (!apiKey) {
//   console.error("❌ GEMINI_API_KEY is missing from .env");
//   process.exit(1);
// }

// // Gemini client
// const ai = new GoogleGenAI({
//   apiKey
// });

// // Chat API
// app.post("/api/chat", async (req, res) => {
//   try {
//     // Get user message
//     const message = String(req.body?.message || "").trim();

//     if (!message) {
//       return res.status(400).json({
//         error: "Message is required."
//       });
//     }

//     // Get current date and time in India
//     const now = new Date();

//     const currentDate = now.toLocaleDateString("en-IN", {
//       timeZone: "Asia/Kolkata",
//       day: "numeric",
//       month: "long",
//       year: "numeric"
//     });

//     const currentTime = now.toLocaleTimeString("en-IN", {
//       timeZone: "Asia/Kolkata",
//       hour: "numeric",
//       minute: "2-digit",
//       second: "2-digit"
//     });

//     // Prompt for Gemini
//     const prompt = `
// You are a helpful AI assistant.

// Current date in India: ${currentDate}
// Current time in India: ${currentTime}

// Use this date and time when answering questions about:
// - today's date
// - current month
// - current year
// - current time
// - today
// - yesterday
// - tomorrow
// - dates relative to today

// Answer the user's question clearly, accurately, and concisely.

// User:
// ${message}
// `;

//     // Send request to Gemini
//     const result = await ai.interactions.create({
//       model: "gemini-3.6-flash",
//       input: prompt
//     });

//     // Send response to frontend
//     res.json({
//       reply: result.output_text
//     });

//   } catch (error) {
//     console.error("❌ Gemini API Error:", error);

//     res.status(500).json({
//       error: "Failed to get AI response."
//     });
//   }
// });

// // Start server
// app.listen(PORT, () => {
//   console.log(`✅ Backend running at http://localhost:${PORT}`);
// });