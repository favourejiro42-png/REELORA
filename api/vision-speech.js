const MODEL = "canopylabs/orpheus-v1-english";
const VOICE = "daniel"; // VISION's fixed signature voice

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "VISION voice is not configured. Add GROQ_API_KEY in Vercel." });
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text || text.length > 200) return res.status(400).json({ error: "Speech text must contain between 1 and 200 characters." });
  try {
    const response = await fetch("https://api.groq.com/openai/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, voice: VOICE, input: text, response_format: "wav" })
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("VISION TTS error:", response.status, detail.slice(0, 500));
      return res.status(response.status).json({ error: "VISION could not generate speech just now." });
    }
    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", String(audio.length));
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(audio);
  } catch (error) {
    console.error("VISION speech error:", error);
    return res.status(500).json({ error: "Something went wrong while generating VISION's voice." });
  }
}
