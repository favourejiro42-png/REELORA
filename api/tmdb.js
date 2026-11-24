export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const key = process.env.TMDB_API_KEY;
  if (!key) return res.status(503).json({ error: "Discovery needs a TMDB API key. Add TMDB_API_KEY in Vercel Environment Variables." });

  const id = String(req.query.id || "").trim();
  const type = String(req.query.type || "").trim().toLowerCase();
  const headers = { Authorization: `Bearer ${key}`, Accept: "application/json" };

  try {
    // Fetch full details for a selected movie or TV series.
    if (id) {
      if (!/^\d+$/.test(id) || !["movie", "tv"].includes(type)) {
        return res.status(400).json({ error: "A valid title ID and type (movie or tv) are required." });
      }
      const response = await fetch(`https://api.themoviedb.org/3/${type}/${id}?language=en-US`, { headers });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data?.status_message || "Could not load title details." });
      return res.status(200).json({
        id: data.id,
        media_type: type,
        title: data.title || data.name || "Untitled",
        overview: data.overview || "",
        poster_path: data.poster_path || null,
        backdrop_path: data.backdrop_path || null,
        release_date: data.release_date || data.first_air_date || null,
        vote_average: Number.isFinite(data.vote_average) ? data.vote_average : null,
        vote_count: data.vote_count || 0,
        genres: (data.genres || []).map(g => g.name),
        runtime: data.runtime || null,
        episode_run_time: data.episode_run_time || [],
        number_of_seasons: data.number_of_seasons || null,
        number_of_episodes: data.number_of_episodes || null,
        status: data.status || null,
        tagline: data.tagline || ""
      });
    }

    const query = String(req.query.q || "").trim().slice(0, 100);
    if (!query) return res.status(400).json({ error: "Enter a title to search." });
    const url = new URL("https://api.themoviedb.org/3/search/multi");
    url.searchParams.set("query", query);
    url.searchParams.set("include_adult", "false");
    url.searchParams.set("language", "en-US");
    url.searchParams.set("page", "1");
    const response = await fetch(url, { headers });
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
    console.error("TMDB request error:", e);
    return res.status(500).json({ error: "Could not load entertainment information right now." });
  }
}
