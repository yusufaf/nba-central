import * as NBA from 'nba';

export const fetchTeamDetailsTest = () => {
    const curry = NBA.findPlayer('Stephen Curry');
    console.log(curry);

    NBA.stats.playerInfo({ PlayerID: curry.playerId }).then(console.log);
}