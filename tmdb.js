export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const key = process.env.TMDB_API_KEY;
  if (!key) return res.status(503).json({ error: "Discovery needs a TMDB API key. Add TMDB_API_KEY in Vercel Environment Variables." });
  const query = String(req.query.q || "").trim().slice(0, 100);
  if (!query) return res.status(400).json({ error: "Enter a title to search." });

  try {
    const url = new URL("https://api.themoviedb.org/3/search/multi");
    url.searchParams.set("query", query);
    url.searchParams.set("include_adult", "false");
    url.searchParams.set("language", "en-US");
    url.searchParams.set("page", "1");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.status_message || "Title search failed." });
    const results = (data.results || []).filter(x => ["movie", "tv"].includes(x.media_type)).slice(0, 12).map(x => ({
      id: x.id, media_type: x.media_type, title: x.title || x.name || "Untitled",
      overview: x.overview || "", poster_path: x.poster_path || null,
      release_date: x.release_date || x.first_air_date || null,
      vote_average: x.vote_average || null
    }));
    return res.status(200).json({ results });
  } catch (e) {
    console.error("TMDB search error:", e);
    return res.status(500).json({ error: "Could not search titles right now." });
  }
}
