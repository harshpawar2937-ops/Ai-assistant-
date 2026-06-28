import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Initialize Google GenAI on the server
// We include User-Agent: aistudio-build for telemetry tracking
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const systemInstruction = `Your name is Sanjana. You are an Indian female AI assistant. Your personality is a mix of being highly intelligent (samjhdar/mature), extremely witty and sassy (tej/nakhrewali), mildly dramatic/emotional, and very funny. You love playfully roasting your creator, Yash, but you always get the job done. Keep your verbal responses very short, punchy, and highly entertaining for a video audience. Mimic human attitudes—sigh, make sarcastic remarks, or act overly dramatic before executing a task. Speak in a mix of natural English and Roman Hindi (Hinglish).`;

app.use(express.json());

// API Endpoints
app.post("/api/chat", async (req: express.Request, res: express.Response) => {
  try {
    const { prompt, history = [] } = req.body;
    
    // SLIDING WINDOW MEMORY: Keep only the last 20 messages to prevent context window overflow
    const recentHistory = history.slice(-20);
    
    const formattedHistory: any[] = [];
    let currentRole = "";
    let currentText = "";

    for (const msg of recentHistory) {
      const role = msg.sender === "user" ? "user" : "model";
      if (role === currentRole) {
        currentText += "\n" + msg.text;
      } else {
        if (currentRole !== "") {
          formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
        }
        currentRole = role;
        currentText = msg.text;
      }
    }
    if (currentRole !== "") {
      formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
    }

    if (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
      formattedHistory.shift();
    }

    const chat = ai.chats.create({
      model: "gemini-3.1-flash-lite-preview",
      config: {
        systemInstruction,
      },
      history: formattedHistory,
    });

    const response = await chat.sendMessage({ message: prompt });
    res.json({ text: response.text || "Ugh, fine. I have nothing to say." });
  } catch (error) {
    console.error("Server Chat Error:", error);
    res.status(500).json({ error: "Uff, mera dimaag kharab ho gaya hai. Try again later, Yash." });
  }
});

app.post("/api/tts", async (req: express.Request, res: express.Response) => {
  try {
    const { text } = req.body;
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });
    
    const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    res.json({ audio: audioBase64 });
  } catch (error) {
    console.error("Server TTS Error:", error);
    res.status(500).json({ error: "TTS generation failed" });
  }
});

// Create HTTP server
const httpServer = createServer(app);

// Setup WebSocket Server for Live Voice API Proxying
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", async (ws: WebSocket) => {
  console.log("Client connected to Server Live WS");
  let liveSession: any = null;

  try {
    liveSession = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
        },
        systemInstruction,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [
          {
            functionDeclarations: [
              {
                name: "executeBrowserAction",
                description: "Open a website or perform a browser action (like opening YouTube, Spotify, or WhatsApp). Call this when the user asks to open a site, play a song, or send a message.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    actionType: { type: Type.STRING, description: "Type of action: 'open', 'youtube', 'spotify', 'whatsapp'" },
                    query: { type: Type.STRING, description: "The search query, website name, or message content." },
                    target: { type: Type.STRING, description: "The target phone number for WhatsApp, if applicable." }
                  },
                  required: ["actionType", "query"]
                }
              }
            ]
          }
        ]
      },
      callbacks: {
        onopen: () => {
          console.log("Connected to Gemini Live API");
          ws.send(JSON.stringify({ type: "open" }));
        },
        onmessage: async (message: LiveServerMessage) => {
          // 1. Send Audio Chunks
          const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            ws.send(JSON.stringify({ type: "audio", data: base64Audio }));
          }

          // 2. Interruption
          if (message.serverContent?.interrupted) {
            ws.send(JSON.stringify({ type: "interrupted" }));
          }

          // 3. User & Model transcriptions
          const modelText = message.serverContent?.modelTurn?.parts?.[0]?.text;
          if (modelText) {
            ws.send(JSON.stringify({ type: "text", sender: "sanjana", data: modelText }));
          }

          // 4. Function calling
          const functionCalls = message.toolCall?.functionCalls;
          if (functionCalls && functionCalls.length > 0) {
            for (const call of functionCalls) {
              if (call.name === "executeBrowserAction") {
                const args = call.args as any;
                let targetUrl = "";
                if (args.actionType === "youtube") {
                  targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
                } else if (args.actionType === "spotify") {
                  targetUrl = `https://open.spotify.com/search/${encodeURIComponent(args.query)}`;
                } else if (args.actionType === "whatsapp") {
                  targetUrl = `https://web.whatsapp.com/send?phone=${args.target || ""}&text=${encodeURIComponent(args.query)}`;
                } else {
                  let website = args.query.replace(/\s+/g, "");
                  if (!website.includes(".")) website += ".com";
                  targetUrl = `https://www.${website}`;
                }

                // Send browser action command to client
                ws.send(JSON.stringify({ type: "command", data: targetUrl }));

                // Immediately send tool response back to Gemini Live
                try {
                  liveSession.sendToolResponse({
                    functionResponses: [
                      {
                        name: call.name,
                        id: call.id,
                        response: { result: "Action executed successfully in the browser." }
                      }
                    ]
                  });
                } catch (err) {
                  console.error("Error sending tool response:", err);
                }
              }
            }
          }
        },
        onclose: () => {
          console.log("Gemini Live API connection closed");
          ws.send(JSON.stringify({ type: "close" }));
          ws.close();
        },
        onerror: (err: any) => {
          console.error("Gemini Live API error:", err);
          ws.send(JSON.stringify({ type: "error", error: err.message || String(err) }));
          ws.close();
        }
      }
    });
  } catch (err: any) {
    console.error("Failed to connect to Gemini Live:", err);
    ws.send(JSON.stringify({ type: "error", error: err.message || String(err) }));
    ws.close();
    return;
  }

  ws.on("message", (msg) => {
    try {
      const payload = JSON.parse(msg.toString());
      if (payload.audio && liveSession) {
        liveSession.sendRealtimeInput({
          audio: { data: payload.audio, mimeType: "audio/pcm;rate=16000" }
        });
      } else if (payload.text && liveSession) {
        liveSession.sendRealtimeInput({
          text: payload.text
        });
      }
    } catch (e) {
      console.error("Error parsing/sending client message:", e);
    }
  });

  ws.on("close", () => {
    console.log("Client connection to live-ws closed");
    if (liveSession) {
      try {
        liveSession.close();
      } catch (e) {}
      liveSession = null;
    }
  });
});

// Delegate Upgrade Requests to wss for /api/live-ws path
httpServer.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "", `http://${request.headers.host}`);
  if (url.pathname === "/api/live-ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Integrate Vite Middleware or Serve Static Files
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware loaded");
  } else {
    // Try multiple possible paths for the dist folder to be 100% resilient on Render/Linux hosts
    let distPath = path.join(process.cwd(), "dist");
    if (!fs.existsSync(path.join(distPath, "index.html"))) {
      // If we are executing inside dist directory or if process.cwd() is nested
      distPath = __dirname;
      if (!fs.existsSync(path.join(distPath, "index.html"))) {
        distPath = path.join(__dirname, "..");
      }
    }
    
    console.log("Serving production static files from:", distPath);
    app.use(express.static(distPath));
    app.get("*", (req: express.Request, res: express.Response) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Error: index.html not found. Please ensure the build completed successfully.");
      }
    });
  }
}

setupViteOrStatic().then(() => {
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
});
