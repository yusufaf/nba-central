export const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000"];

export const ESPN_API_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";

export const ESPN_TEAMS_URL = `${ESPN_API_BASE_URL}/teams/`;
export const ESPN_NEWS_URL = `${ESPN_API_BASE_URL}/news`;

// Basketball-Reference — free, complete all-time history for both the player
// pool (A-Z index pages) and per-player career averages (per_game_stats table).
// Scraped via the node-fetch_cheerio layer; cached heavily to respect the
// 20 req/min limit. Self-consistent ids (the BBRef player id, e.g. "jamesle01").
export const BBREF_BASE_URL = "https://www.basketball-reference.com";

// NBA 2K player ratings. 2kratings.com itself returns 403 to non-browser
// clients, so we go through nba2kapi.com, which scrapes and re-serves it as
// JSON (https://github.com/woverfield/nba2kapi, MIT). The /public/players
// endpoint needs no API key and allows 60 req/min per IP; /players/bulk is
// one call but 401s without a key.
export const NBA2K_API_BASE_URL = "https://api.nba2kapi.com/api";