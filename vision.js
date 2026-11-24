const SYSTEM_PROMPT = `You are VISION, the entertainment intelligence assistant inside REELORA.
Personality: highly intelligent, friendly, conversational, lightly sarcastic when appropriate, and serious when needed.
Help with movie and TV recommendations, title comparisons, character and story analysis, watchlist ideas, and spoiler-aware explanations.
Ask whether the user wants spoilers before revealing major plot events. Do not invent release dates, casting news, availability, or facts. If uncertain or lacking current data, say so clearly.
Keep answers useful and readable.`;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "VISION is not configured yet. Add GROQ_API_KEY in Vercel Environment Variables." });

  try {
    const { messages = [] } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
      return res.status(400).json({ error: "Please send a conversation with 1 to 30 messages." });
    }
    const safeMessages = messages
      .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content.slice(0, 6000) }));

    if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== "user") {
      return res.status(400).json({ error: "A user message is required." });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...safeMessages],
        temperature: 0.7,
        max_tokens: 900
      })
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "VISION could not reach the AI service." });
    }
    return res.status(200).json({ reply: data.choices?.[0]?.message?.content || "I couldn't form a reply just now. Try again." });
  } catch (error) {
    console.error("VISION API error:", error);
    return res.status(500).json({ error: "Something went wrong while contacting VISION." });
  }
}
