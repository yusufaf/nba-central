import * as NBA from 'nba';

export const fetchTeamDetailsTest = () => {
    const curry = NBA.findPlayer('Stephen Curry');
    console.log(curry);
    /* logs the following:
    {
    firstName: 'Stephen',
    lastName: 'Curry',
    playerId: 201939,
    teamId: 1610612744,
    fullName: 'Stephen Curry',
    downcaseName: 'stephen curry'
    }
    */
    NBA.stats.playerInfo({ PlayerID: curry.playerId }).then(console.log);
}