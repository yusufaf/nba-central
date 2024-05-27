import { EventBridgeEvent, Handler } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const { staticDataBucket = "" } = process.env;

const s3Client = new S3Client();

const INDEX_TO_ATTRIBUTE = new Map([]);

export const handler: Handler = async (
    event: EventBridgeEvent<any, any>,
    context
): Promise<any> => {
    console.log(JSON.stringify({ event, context }, null, 4));

    try {
        const response = await fetch(
            "https://en.wikipedia.org/wiki/List_of_NBA_arenas"
        );
        const body = await response.text();

        const $ = cheerio.load(body);

        const wikiTables = $(".wikitable");

        const data = [];

        // First table --> Current arenas:
        const arenasTable = wikiTables[0];
        const arenasTableCheerio = $(arenasTable);
        const [theadElement, tbodyElement] = arenasTableCheerio.children();
        console.log({ theadElement, tbodyElement });
        if (!theadElement) {
            return;
        }
        const theadCheerio = $(theadElement);
        console.log({ theadCheerio, theadChildren: theadCheerio.children() });
        for (const tr of theadCheerio.children()) {
            const trCheerio = $(tr);
            for (const th of trCheerio.children()) {
                const thCheerio = $(th);
                console.log("Looking for tr in <thead> ", thCheerio.text());
            }
        }

        const tbodyCheerio = $(tbodyElement);
        for (const tr of tbodyCheerio.children()) {
            const trCheerio = $(tr);
            const tableCells = trCheerio.children();

            for (let i = 0; i < tableCells.length; i++) {
                if (i === 7) {
                    continue;
                }

                const td = tableCells[i];
                const tdCheerio = $(td);
                console.log("Looking for td in <tr> ", tdCheerio.text());
            }
        }

        const arenasDataJson = {
            data,
        };

        const putObjectCommand = new PutObjectCommand({
            Bucket: staticDataBucket,
            Key: "arenas.json",
            Body: JSON.stringify(arenasDataJson, null, 4),
        });
        const putObjectResponse = await s3Client.send(putObjectCommand);
    } catch (err) {
        console.error(err);
    }
};
