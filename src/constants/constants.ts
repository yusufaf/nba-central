/* UI */
export const CURRENT_SEASON_START_YEAR = new Date().getFullYear() - 1;

export const ROUTES = [
  { id: 1, name: "Home", path: "/", title: "" },
  { id: 2, name: "My Teams", path: "/teams", title: "My Teams" },
  { id: 3, name: "Team Builder", path: "/teambuilder", title: "Team Builder" },
  { id: 4, name: "Scores", path: "/scores", title: "NBA Scoreboard" },
  { id: 5, name: "News", path: "/news", title: "NBA News" },
  { id: 6, name: "Sign In", path: "/login", class: "login" },
];

export const TYPE_WRITER_PROPS = {
  closingText: "team",
  leadInText: "Build the",
  textDisplayArray: [
    "GOAT",
    "best",
    "greatest",
    "coldest",
    "dopest",
    "coolest",
    "hottest",
  ],
};

export const VIEWS = {
  DEFAULT: "Default",
  LIST: "List",
};
export const VIEW_OPTIONS = [
  { label: VIEWS.DEFAULT, value: VIEWS.DEFAULT },
  { label: VIEWS.LIST, value: VIEWS.LIST },
];

export const DEFAULT_NOTIFICATION_PROPS = {
  position: "bottom-left",
  closeBtn: true,
  timeout: 2500,
  textColor: "white",
};

export type DrawerSide = "left" | "right" | undefined;
export const DRAWER_SIDES: { [key: string]: DrawerSide } = {
  LEFT: "left",
  RIGHT: "right",
};
export const DRAWER_OPTIONS = [
  { label: DRAWER_SIDES.LEFT, value: DRAWER_SIDES.LEFT },
  { label: DRAWER_SIDES.RIGHT, value: DRAWER_SIDES.RIGHT },
];

export const NOTIFICATION_GRANTED = "granted";
export const NOTIFICATION_DENIED = "denied";

export type CustomizationKey = "shortNames" | "hideScores";

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
};

/* API */
export const BDL_API_PREFIX = "https://www.balldontlie.io/api/v1";
export const ESPN_SCORES_URL =
  "http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";
export const ESPN_NEWS_URL =
  "http://site.api.espn.com/apis/site/v2/sports/basketball/nba/news";

/* API URLs for reference 
- https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/7
- ESPN Scoreboard: http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard
- ESPN News: http://site.api.espn.com/apis/site/v2/sports/basketball/nba/news
- NBA.com Scoreboard: https://nba-prod-us-east-1-mediaops-stats.s3.amazonaws.com/NBA/liveData/scoreboard/todaysScoreboard_00.json
- NBA.com Standings: http://data.nba.net/prod/v1/current/standings_conference.json
*/

const COACH_COLUMNS = ["Coach", "From", "To", "Birth Date", "College"];


/* Coaches Data Function:
const coachesData = [];

const flattenedData = coachesData.map(coach => {
    const [rank, name, from, to, yrs, g, w, l, wlPercent, wGreaterThan500, playoffG = 0, playoffW = 0, playoffL = 0, playoffWLPercent = 0, confTitles = 0, championships = 0] = coach[Object.keys(coach)[0]];
    return {
      rank,
      name,
      from,
      to,
      yrs,
      g,
      w,
      l,
      wlPercent,
      wGreaterThan500,
      playoffG,
      playoffW,
      playoffL,
      playoffWLPercent,
      confTitles,
      championships
    };
  });
  
  console.log(flattenedData);

*/