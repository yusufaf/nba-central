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
};
