export type CustomizationKey =
    | "shortNames"
    | "hideScores"
    | "hideFinishedGames";

export type CustomizationState = Map<CustomizationKey, any>;

export type DrawerSide = "left" | "right";

export type Team = {
    uuid: string;
    name: string;
    description: string;
    players: any;
};

export type Coach = {
    championships: number;
    confTitles: number;
    from: number;
    g: number;
    l: number;
    name: string;
    playoffG: number;
    playoffL: number;
    playoffW: number;
    playoffWLPercent: string;
    rank: number;
    to: number;
    w: number;
    wGreaterThan500: number;
    wlPercent: string;
    yrs: number;
    // Custom coach fields
    isCustom?: boolean;
    coachUUID?: string;
    created?: string;
    overallRating?: number;
    specialty?: 'Offensive' | 'Defensive' | 'Balanced';
};

export type Arena = {
    imgLink: string;
    name: string;
    location: string;
    team: string;
    capacity: string;
    openedYear: number;
};

export type GM = {
    name: string;
    teams: string[];
    isCustom?: boolean;
    gmUUID?: string;
    created?: string;
};

export type NBATeam = {
    abbr: string;
    name: string;
};

export type Player = {
    // API player fields (from BallDontLie API - snake_case)
    id?: number;
    first_name?: string;
    last_name?: string;
    fullName?: string;
    position?: string;
    height_feet?: number;
    height_inches?: number;
    weight_pounds?: number;
    team?: {
        full_name?: string;
        abbreviation?: string;
    };
    // Custom player fields (camelCase)
    isCustom?: boolean;
    playerUUID?: string;
    created?: string;
    name?: string;
    heightFeet?: number;
    heightInches?: number;
    weightPounds?: number;
    overallRating?: number;
};

export type CoachSpecialty = 'Offensive' | 'Defensive' | 'Balanced';
export type PlayerPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export type SortDirection = "asc" | "desc";

/* ESPN Scoreboard API Types */

export type ESPNLink = {
    rel?: string[];
    href: string;
    text?: string;
    isExternal?: boolean;
    isPremium?: boolean;
};

export type ESPNLogo = {
    href: string;
    width: number;
    height: number;
    alt: string;
    rel: string[];
    lastUpdated: string;
};

export type ESPNSeasonType = {
    id: string;
    type: number;
    name: string;
    abbreviation: string;
};

export type ESPNSeason = {
    year: number;
    startDate: string;
    endDate: string;
    displayName: string;
    type: ESPNSeasonType;
};

export type ESPNLeague = {
    id: string;
    uid: string;
    name: string;
    abbreviation: string;
    slug: string;
    season: ESPNSeason;
    logos: ESPNLogo[];
    calendarType: string;
    calendarIsWhitelist: boolean;
    calendarStartDate: string;
    calendarEndDate: string;
    calendar: string[];
};

export type ESPNAddress = {
    city: string;
    state: string;
};

export type ESPNVenue = {
    id: string;
    fullName?: string;
    address?: ESPNAddress;
    indoor?: boolean;
};

export type ESPNTeamInfo = {
    id: string;
    uid: string;
    location: string;
    name: string;
    abbreviation: string;
    displayName: string;
    shortDisplayName: string;
    color: string;
    alternateColor: string;
    isActive: boolean;
    venue: ESPNVenue;
    links: ESPNLink[];
    logo: string;
};

export type ESPNPosition = {
    abbreviation: string;
};

export type ESPNAthlete = {
    id: string;
    fullName: string;
    displayName: string;
    shortName: string;
    links: ESPNLink[];
    headshot: string;
    jersey: string;
    position: ESPNPosition;
    team: { id: string };
    active: boolean;
};

export type ESPNLeaderItem = {
    displayValue: string;
    value: number;
    athlete: ESPNAthlete;
    team: { id: string };
};

export type ESPNLeader = {
    name: string;
    displayName: string;
    shortDisplayName: string;
    abbreviation: string;
    leaders: ESPNLeaderItem[];
};

export type ESPNStatistic = {
    name: string;
    abbreviation: string;
    displayValue: string;
};

export type ESPNLineScore = {
    value: number;
    displayValue: string;
    period: number;
};

export type ESPNRecord = {
    name: string;
    abbreviation?: string;
    type: string;
    summary: string;
};

export type ESPNCompetitor = {
    id: string;
    uid: string;
    type: string;
    order: number;
    homeAway: "home" | "away";
    winner?: boolean;
    team: ESPNTeamInfo;
    score?: string;
    linescores?: ESPNLineScore[];
    statistics?: ESPNStatistic[];
    leaders?: ESPNLeader[];
    records?: ESPNRecord[];
};

export type ESPNStatusType = {
    id: string;
    name: string;
    state: "pre" | "in" | "post";
    completed: boolean;
    description: string;
    detail: string;
    shortDetail: string;
};

export type ESPNStatus = {
    clock?: number;
    displayClock?: string;
    period?: number;
    type: ESPNStatusType;
};

export type ESPNBroadcast = {
    market: string;
    names: string[];
};

export type ESPNGeoBroadcastType = {
    id: string;
    shortName: string;
};

export type ESPNGeoBroadcastMarket = {
    id: string;
    type: string;
};

export type ESPNGeoBroadcastMedia = {
    shortName: string;
};

export type ESPNGeoBroadcast = {
    type: ESPNGeoBroadcastType;
    market: ESPNGeoBroadcastMarket;
    media: ESPNGeoBroadcastMedia;
    lang: string;
    region: string;
};

export type ESPNHighlightRestrictions = {
    embargoDate: string;
    expirationDate: string;
};

export type ESPNDeviceRestrictions = {
    type: string;
    devices: string[];
};

export type ESPNGeoRestrictions = {
    type: string;
    countries: string[];
};

export type ESPNHighlight = {
    id: number;
    cerebroId: string;
    source: string;
    headline: string;
    description: string;
    lastModified: string;
    originalPublishDate: string;
    duration: number;
    timeRestrictions: ESPNHighlightRestrictions;
    deviceRestrictions: ESPNDeviceRestrictions;
    geoRestrictions: ESPNGeoRestrictions;
};

export type ESPNCompetitionType = {
    id: string;
    abbreviation: string;
};

export type ESPNFormat = {
    regulation: {
        periods: number;
    };
};

export type ESPNCompetition = {
    id: string;
    uid: string;
    date: string;
    attendance?: number;
    type: ESPNCompetitionType;
    timeValid: boolean;
    neutralSite: boolean;
    conferenceCompetition: boolean;
    playByPlayAvailable: boolean;
    recent: boolean;
    venue: ESPNVenue;
    competitors: ESPNCompetitor[];
    notes: any[];
    status: ESPNStatus;
    broadcasts?: ESPNBroadcast[];
    format: ESPNFormat;
    startDate: string;
    broadcast?: string;
    geoBroadcasts?: ESPNGeoBroadcast[];
    highlights?: ESPNHighlight[];
};

export type ESPNEvent = {
    id: string;
    uid: string;
    date: string;
    name: string;
    shortName: string;
    season: {
        year: number;
        type: number;
        slug: string;
    };
    competitions: ESPNCompetition[];
    links?: ESPNLink[];
};

export type ESPNScoreboardResponse = {
    leagues: ESPNLeague[];
    events: ESPNEvent[];
    day?: {
        date: string;
    };
};
