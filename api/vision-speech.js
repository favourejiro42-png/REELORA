const MODEL = "canopylabs/orpheus-v1-english";
const VOICE = "daniel";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: "GROQ_API_KEY is missing from this Vercel deployment."
    });
  }

  const text = typeof req.body?.text === "string"
    ? req.body.text.trim()
    : "";

  if (!text || text.length > 200) {
    return res.status(400).json({
      error: "Speech text must contain between 1 and 200 characters."
    });
  }

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/speech",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          voice: VOICE,
          input: text,
          response_format: "wav"
        }),
        signal: AbortSignal.timeout(25000)
      }
    );

    if (!response.ok) {
      const raw = await response.text();

      console.error(
        "VISION TTS provider error:",
        response.status,
        raw.slice(0, 1000)
      );

      let providerMessage = "";

      try {
        const parsed = JSON.parse(raw);
        providerMessage =
          parsed?.error?.message || parsed?.message || "";
      } catch {
        providerMessage = raw.slice(0, 180);
      }

      const message = providerMessage
        ? `Groq returned HTTP ${response.status}: ${providerMessage}`
        : `Groq returned HTTP ${response.status}. Check Vercel function logs.`;

      return res.status(502).json({ error: message });
    }

    const audio = Buffer.from(await response.arrayBuffer());

    if (!audio.length) {
      return res.status(502).json({
        error: "Groq returned an empty audio file."
      });
    }

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", String(audio.length));
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(audio);

  } catch (error) {
    console.error("VISION speech request failed:", error);

    if (
      error?.name === "TimeoutError" ||
      error?.name === "AbortError"
    ) {
      return res.status(504).json({
        error: "Groq took too long to generate the voice. Please try again."
      });
    }

    return res.status(500).json({
      error: "The VISION speech request failed. Check Vercel function logs."
    });
  }
}
