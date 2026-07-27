import { EventBridgeEvent, Handler } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const { staticDataBucket = "" } = process.env;

const s3Client = new S3Client();

const ATTRIBUTE_MAPPING = new Map([
    ["exec", "name"],
    ["teams", "teams"],
]);

export const handler: Handler = async (
    event: EventBridgeEvent<any, any>,
    context
): Promise<any> => {
    console.log(JSON.stringify({ event, context }, null, 4));

    try {
        const response = await fetch(
            "https://www.basketball-reference.com/executives/"
        );
        const body = await response.text();

        const $ = cheerio.load(body);

        const tbodyElement = $("#executives-index > tbody");
        console.log("Tbody\n", tbodyElement);
        const data: { [key: string]: any }[] = [];
        for (const tr of tbodyElement.children()) {
            const trElement = $(tr);
            if (trElement.hasClass("thead")) {
                continue;
            }

            const execData: { [key: string]: any } = {};
            for (const element of trElement.children()) {
                const cheerioElement = $(element);
                const dataStatValue = cheerioElement.data("stat") as string;
                if (!dataStatValue) {
                    continue;
                }
                const property = ATTRIBUTE_MAPPING.get(dataStatValue)!;
                const tdText = cheerioElement
                    .text()
                    .trim()
                    .replace(/[.\u00A0]/g, "");
                console.log({ tdText, children: cheerioElement.children() });

                switch (property) {
                    case "name":
                        // Find href, can be optionally wrapped in a <strong>
                        // Active executives are listed in bold.
                        const strongElement = cheerioElement.find("strong");
                        // Check if there are any <strong> elements
                        const isActive = strongElement.length > 0;
                        execData.active = isActive;

                        const anchorElement = cheerioElement.find("a");
                        const href = $(anchorElement).attr("href");
                        execData.href = href ?? "";

                        break;
                    case "teams":
                        break;
                }

                execData[property] = tdText;
            }
            data.push(execData);
        }

        const execsDataJSON = {
            attributes: [
                {
                    label: "Name",
                    property: "name",
                },
                {
                    label: "Team(s)",
                    property: "teams",
                },
            ],
            data,
        };

        const putObjectCommand = new PutObjectCommand({
            Bucket: staticDataBucket,
            Key: "execs.json",
            Body: JSON.stringify(execsDataJSON, null, 4),
        });
        const putObjectResponse = await s3Client.send(putObjectCommand);
    } catch (err) {
        console.error(err);
    }
};
