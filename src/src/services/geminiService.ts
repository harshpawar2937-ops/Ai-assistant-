export function resetSanjanaSession() {
  // Session is handled dynamically via chat history sent to the server.
}

export async function getSanjanaResponse(
  prompt: string,
  history: { sender: "user" | "sanjana"; text: string }[] = []
): Promise<string> {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, history }),
    });
    if (!response.ok) {
      throw new Error("Server responded with error");
    }
    const data = await response.json();
    return data.text || "Ugh, fine. I have nothing to say.";
  } catch (error) {
    console.error("Client Chat Error:", error);
    return "Uff, mera dimaag kharab ho gaya hai. Try again later, Yash.";
  }
}

export async function getSanjanaAudio(text: string): Promise<string | null> {
  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      throw new Error("Server responded with error");
    }
    const data = await response.json();
    return data.audio;
  } catch (error) {
    console.error("Client TTS Error:", error);
    return null;
  }
}

