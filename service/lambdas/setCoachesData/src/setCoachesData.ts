import { EventBridgeEvent, Handler } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { capitalizeFirstLetter } from "utilities/generalUtils";

const { staticDataBucket = "" } = process.env;

const s3Client = new S3Client();

const ATTRIBUTE_MAPPING = new Map([
    ["ranker", "rank"],
    ["coach", "name"],
    ["year_min", "from"],
    ["year_max", "to"],
    ["years", "years"],
    ["g", "games"],
    ["wins", "wins"],
    ["losses", "losses"],
    ["win_loss_pct", "winLossPercent"],
    ["wins_over_500", "winsOver500"],
    ["g_playoffs", "playoffGames"],
    ["wins_playoffs", "playoffWins"],
    ["losses_playoffs", "playoffLosses"],
    ["win_loss_pct_playoffs", "playoffWinLossPercent"],
    ["years_conference_champion", "conferenceTitles"],
    ["years_league_champion", "championships"],
]);

const LABEL_MAPPING = new Map([
    ["years", "Years Coached"],
    ["winLossPercent", "Win Loss %"],
    ["winsOver500", "Wins Over .500"],
    ["playoffGames", "Playoff Games"],
    ["playoffWins", "Playoff Wins"],
    ["playoffLosses", "Playoff Losses"],
    ["playoffWinLossPercent", "Playoff Win Loss %"],
    ["conferenceTitles", "Conference Titles"],
]);

export const handler: Handler = async (
    event: EventBridgeEvent<any, any>,
    context
): Promise<any> => {
    console.log(JSON.stringify({ event, context }, null, 4));

    try {
        const response = await fetch(
            "https://www.basketball-reference.com/coaches/NBA_stats.html"
        );
        const body = await response.text();

        const $ = cheerio.load(body);

        const theadElement = $("#coaches > thead");
        const theadChildren = theadElement.children();
        const headerRow = theadChildren[1];

        const attributes = [];
        for (const th of headerRow.children) {
            const thElement = $(th);
            const dataStatValue = thElement.data("stat") as string;
            if (!dataStatValue) {
                continue;
            }
            const dataTooltipValue = thElement.data("tip") as string;

            const property = ATTRIBUTE_MAPPING.get(dataStatValue)!;
            attributes.push({
                description: dataTooltipValue ?? "",
                label:
                    LABEL_MAPPING.get(property) ??
                    capitalizeFirstLetter(property),
                property: ATTRIBUTE_MAPPING.get(dataStatValue),
            });
        }

        const tbodyElement = $("#coaches > tbody");
        const data = [];
        for (const tr of tbodyElement.children()) {
            const trElement = $(tr);
            if (trElement.hasClass("thead")) {
                continue;
            }

            const coachData: { [key: string]: any } = {};
            for (const td of trElement.children()) {
                const tdElement = $(td);
                const dataStatValue = tdElement.data("stat") as string;
                if (!dataStatValue) {
                    continue;
                }
                const property = ATTRIBUTE_MAPPING.get(dataStatValue)!;
                const tdText = tdElement.text().trim();
                let value: string | number = parseFloat(tdText || "0");
                if (property === "name") {
                    const anchorElement = tdElement.children()[0];
                    const href = $(anchorElement).attr("href");

                    value = tdText;
                    if (href) {
                        coachData.href = href;
                    }
                }
                coachData[property] = value;
            }
            data.push(coachData);
        }

        const coachesDataJSON = {
            attributes,
            data,
        };

        const putObjectCommand = new PutObjectCommand({
            Bucket: staticDataBucket,
            Key: "coaches.json",
            Body: JSON.stringify(coachesDataJSON, null, 4),
        });
        const putObjectResponse = await s3Client.send(putObjectCommand);
    } catch (err) {
        console.error(err);
    }
};
