const express = require("express");
const { WebSocketServer } = require("ws");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const googleTTS = require("google-tts-api");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
const wss = new WebSocketServer({ server });

// Initialize generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Utility function to remove markdown formatting from text.
 */
function cleanText(text) {
  return text.replace(/[*_`>]/g, '');
}

/**
 * Placeholder function for converting speech to text.
 * Replace this with a real STT implementation.
 */
async function convertSpeechToText(audioBase64) {
  console.log("Received audio for transcription...");

  // Simulating different transcriptions for each request
  const sampleResponses = [
    "Tell me a joke",
    "What is the capital of France?",
    "How does photosynthesis work?",
    "Who won the last World Cup?",
    "What is the meaning of life?"
  ];
  
  // Select a random response for testing
  const randomResponse = sampleResponses[Math.floor(Math.random() * sampleResponses.length)];

  console.log("Simulated Transcription:", randomResponse);
  return randomResponse;
}
/**
 * Generate a response from the AI model.
 */
async function generateResponse(userPrompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  try {
    const result = await model.generateContent(userPrompt); 
    
    if (result && result.response && result.response.text) {
      return result.response.text();
    } else {
      throw new Error("Unexpected response format from AI API");
    }
  } catch (error) {
    console.error("Error in generateResponse:", error);
    return "Sorry, something went wrong.";
  }
}

/**
 * Convert text to speech using google-tts-api.
 */
async function convertTextToSpeech(text) {
  try {
    const fetch = await import("node-fetch").then((mod) => mod.default);

    if (text.length <= 200) {
      const url = googleTTS.getAudioUrl(text, { lang: "en", slow: false });
      const res = await fetch(url);
      return Buffer.from(await res.arrayBuffer());
    } else {
      const segments = googleTTS.getAllAudioUrls(text, { lang: "en", slow: false });
      const audioBuffers = [];

      for (const segment of segments) {
        const urlString = typeof segment === "object" && segment.url ? segment.url : segment;
        const res = await fetch(urlString);
        audioBuffers.push(Buffer.from(await res.arrayBuffer()));
      }

      return Buffer.concat(audioBuffers);
    }
  } catch (error) {
    console.error("Error in convertTextToSpeech:", error);
    throw error;
  }
}

// WebSocket handling
wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "audio") {
        // 1. Convert speech to text
        const userSpokenText = await convertSpeechToText(data.payload);
        console.log("User said:", userSpokenText);

        // 2. Generate AI response
        const textResponse = await generateResponse(userSpokenText);
        console.log("Generated text:", textResponse);

        // 3. Send text to the client
        ws.send(JSON.stringify({ type: "text", payload: textResponse }));

        // 4. Convert text response to speech
        const audioBuffer = await convertTextToSpeech(cleanText(textResponse));

        // 5. Send generated speech audio to the client
        ws.send(JSON.stringify({ type: "audio", payload: audioBuffer.toString("base64") }));
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  });

  ws.on("close", () => console.log("Client disconnected"));
});
