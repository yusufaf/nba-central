/* UI */
export const VIEWS = {
    DEFAULT: "Default",
    LIST: "List",
}
export const VIEW_OPTIONS = [
    { label: VIEWS.DEFAULT, value: VIEWS.DEFAULT },
    { label: VIEWS.LIST, value: VIEWS.LIST }
];

export const NOTIFICATION_GRANTED = "granted";
export const NOTIFICATION_DENIED = "denied"

/* NBA Info */
export const NUM_TEAMS = 30;

export const HOME = "home";
export const HOME_C = "Home";
export const AWAY = "away";
export const AWAY_C = "Away";

/* Scoreboard */
export const ZERO_CLOCK = "0.0";
export const GAME_STATUS = {
    SCHEDULED: "STATUS_SCHEDULED",
    IN_PROGRESS: "STATUS_IN_PROGRESS",
    COMPLETED: "STATUS_COMPLETED",
}

/* API */
export const BDL_API_PREFIX = "https://www.balldontlie.io/api/v1";
export const ESPN_SCORES_URL = "http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";

/* API URLs for reference 
- https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/7
- ESPN Scoreboard: http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard
- ESPN News: http://site.api.espn.com/apis/site/v2/sports/basketball/nba/news
- NBA.com Scoreboard: https://nba-prod-us-east-1-mediaops-stats.s3.amazonaws.com/NBA/liveData/scoreboard/todaysScoreboard_00.json
- NBA.com Standings: http://data.nba.net/prod/v1/current/standings_conference.json
*/