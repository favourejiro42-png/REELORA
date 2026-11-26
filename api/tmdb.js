export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.TMDB_API_KEY;
  if (!key) {
    return res.status(503).json({
      error: "Discovery needs a TMDB API key. Add TMDB_API_KEY in Vercel Environment Variables."
    });
  }

  const headers = {
    Authorization: `Bearer ${key}`,
    Accept: "application/json"
  };

  const tmdb = async (path, params = {}) => {
    const url = new URL(`https://api.themoviedb.org/3/${path}`);
    for (const [name, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(name, String(value));
      }
    }
    const response = await fetch(url, { headers });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data?.status_message || "TMDB request failed.");
      error.status = response.status;
      throw error;
    }
    return data;
  };

  try {
    const id = String(req.query.id || "").trim();
    const type = String(req.query.type || "").trim().toLowerCase();
    const seasonNumber = req.query.season;

    // Curated upcoming discovery feed for the REELORA Coming Soon hub.
    if (String(req.query.action || "").toLowerCase() === "discover") {
      const mediaType = String(req.query.media || "movie").toLowerCase();
      if (!["movie", "tv"].includes(mediaType)) {
        return res.status(400).json({ error: "Choose movie or tv discovery." });
      }
      const page = Math.min(10, Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1));
      const genre = String(req.query.genre || "").trim();
      if (genre && !/^\d+(,\d+)*$/.test(genre)) {
        return res.status(400).json({ error: "Invalid genre filter." });
      }
      const today = new Date().toISOString().slice(0, 10);
      const horizon = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
      const dateField = mediaType === "movie" ? "primary_release_date" : "first_air_date";
      const discoverParams = {
        language: "en-US",
        page,
        sort_by: "popularity.desc",
        include_adult: "false",
        [`${dateField}.gte`]: today,
        [`${dateField}.lte`]: horizon,
        with_genres: genre || undefined
      };
      const data = await tmdb(`discover/${mediaType}`, discoverParams);
      const results = (data.results || []).map(item => ({
        id: item.id,
        media_type: mediaType,
        title: item.title || item.name || "Untitled",
        overview: item.overview || "",
        poster_path: item.poster_path || null,
        release_date: item.release_date || item.first_air_date || null,
        vote_average: Number.isFinite(item.vote_average) ? item.vote_average : null,
        popularity: Number(item.popularity || 0),
        genre_ids: item.genre_ids || []
      }));
      return res.status(200).json({ page: data.page || page, total_pages: data.total_pages || 1, results });
    }

    if (String(req.query.action || "").toLowerCase() === "genres") {
      const mediaType = String(req.query.media || "movie").toLowerCase();
      if (!["movie", "tv"].includes(mediaType)) return res.status(400).json({ error: "Choose movie or tv genres." });
      const data = await tmdb(`genre/${mediaType}/list`, { language: "en-US" });
      return res.status(200).json({ genres: data.genres || [] });
    }


    // Fetch a particular TV season, including its individual episodes.
    if (id && seasonNumber !== undefined && seasonNumber !== "") {
      if (!/^\d+$/.test(id) || type !== "tv" || !/^\d+$/.test(String(seasonNumber))) {
        return res.status(400).json({ error: "A valid TV ID and season number are required." });
      }
      const season = await tmdb(`tv/${id}/season/${Number(seasonNumber)}`, {
        language: "en-US"
      });
      return res.status(200).json({
        id: season.id,
        season_number: season.season_number,
        name: season.name || `Season ${season.season_number}`,
        overview: season.overview || "",
        air_date: season.air_date || null,
        poster_path: season.poster_path || null,
        episodes: (season.episodes || []).map(episode => ({
          id: episode.id,
          episode_number: episode.episode_number,
          name: episode.name || `Episode ${episode.episode_number}`,
          overview: episode.overview || "",
          air_date: episode.air_date || null,
          still_path: episode.still_path || null,
          vote_average: Number.isFinite(episode.vote_average) ? episode.vote_average : null,
          runtime: episode.runtime || null
        }))
      });
    }

    // Fetch full details for a selected movie or TV series.
    if (id) {
      if (!/^\d+$/.test(id) || !["movie", "tv"].includes(type)) {
        return res.status(400).json({ error: "A valid title ID and type (movie or tv) are required." });
      }

      const data = await tmdb(`${type}/${id}`, { language: "en-US" });
      const result = {
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
      };

      if (type === "tv") {
        result.seasons = (data.seasons || []).map(season => ({
          id: season.id,
          season_number: season.season_number,
          name: season.name || `Season ${season.season_number}`,
          overview: season.overview || "",
          air_date: season.air_date || null,
          episode_count: season.episode_count || 0,
          poster_path: season.poster_path || null
        }));
        result.next_episode_to_air = data.next_episode_to_air ? {
          id: data.next_episode_to_air.id,
          name: data.next_episode_to_air.name || "",
          season_number: data.next_episode_to_air.season_number,
          episode_number: data.next_episode_to_air.episode_number,
          air_date: data.next_episode_to_air.air_date || null,
          overview: data.next_episode_to_air.overview || ""
        } : null;
        result.last_episode_to_air = data.last_episode_to_air ? {
          id: data.last_episode_to_air.id,
          name: data.last_episode_to_air.name || "",
          season_number: data.last_episode_to_air.season_number,
          episode_number: data.last_episode_to_air.episode_number,
          air_date: data.last_episode_to_air.air_date || null,
          overview: data.last_episode_to_air.overview || ""
        } : null;
      }

      return res.status(200).json(result);
    }

    // Search movies and TV series separately so a TV series is not buried
    // beneath unrelated multi-search matches or individual episode results.
    const query = String(req.query.q || "").trim().slice(0, 100);
    if (!query) return res.status(400).json({ error: "Enter a title to search." });

    const [tvData, movieData] = await Promise.all([
      tmdb("search/tv", {
        query,
        include_adult: "false",
        language: "en-US",
        page: 1
      }),
      tmdb("search/movie", {
        query,
        include_adult: "false",
        language: "en-US",
        page: 1
      })
    ]);

    const normalize = (item, mediaType) => ({
      id: item.id,
      media_type: mediaType,
      title: item.name || item.title || "Untitled",
      overview: item.overview || "",
      poster_path: item.poster_path || null,
      release_date: item.first_air_date || item.release_date || null,
      vote_average: Number.isFinite(item.vote_average) ? item.vote_average : null,
      popularity: Number(item.popularity || 0),
      original_name: item.original_name || item.original_title || ""
    });

    const tvResults = (tvData.results || []).map(item => normalize(item, "tv"));
    const movieResults = (movieData.results || []).map(item => normalize(item, "movie"));

    const queryKey = query.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const score = item => {
      const title = item.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const original = item.original_name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      let value = item.popularity;
      if (title === queryKey || original === queryKey) value += 100000;
      else if (title.startsWith(queryKey) || original.startsWith(queryKey)) value += 10000;
      else if (title.includes(queryKey) || original.includes(queryKey)) value += 1000;
      if (item.media_type === "tv") value += 100;
      return value;
    };

    const results = [...tvResults, ...movieResults]
      .sort((a, b) => score(b) - score(a))
      .filter((item, index, all) =>
        all.findIndex(other => other.id === item.id && other.media_type === item.media_type) === index
      )
      .slice(0, 15)
      .map(({ popularity, original_name, ...item }) => item);

    return res.status(200).json({ results });
  } catch (error) {
    console.error("TMDB request error:", error);
    return res.status(error.status || 500).json({
      error: error.message || "Could not load entertainment information right now."
    });
  }
}
