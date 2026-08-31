import * as path from "path";

/**
 * Capitalizes the first letter of a string.
 */
export const capitalizeFirstLetter = (string: string) => {
    return `${string.charAt(0).toUpperCase()}${string.slice(1)}`;
};

/**
 * Widths Wikimedia will serve for a directly hotlinked thumbnail. Requests for
 * any other width are rejected with a 400.
 *
 * @see https://www.mediawiki.org/wiki/Common_thumbnail_sizes
 */
const WIKIMEDIA_THUMBNAIL_WIDTHS = [
    20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840,
];

/**
 * Rewrites a Wikimedia image URL to a thumbnail at a width Wikimedia will
 * actually serve, rounding up to the next standard width if needed. Accepts
 * protocol-relative sources (as scraped from Wikipedia) and full-size
 * originals, and drops any tracking query params.
 */
export const toWikimediaThumbnail = (source: string, desiredWidth = 500) => {
    const width =
        WIKIMEDIA_THUMBNAIL_WIDTHS.find((candidate) => candidate >= desiredWidth) ??
        WIKIMEDIA_THUMBNAIL_WIDTHS[WIKIMEDIA_THUMBNAIL_WIDTHS.length - 1];

    const url = new URL(source.startsWith("//") ? `https:${source}` : source);
    url.search = "";

    // /wikipedia/commons/thumb/a/ab/File.jpg/120px-File.jpg
    const thumbnailMatch = url.pathname.match(
        /^(\/wikipedia\/[^/]+)\/thumb\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)\/[^/]+$/
    );
    // /wikipedia/commons/a/ab/File.jpg
    const originalMatch = url.pathname.match(
        /^(\/wikipedia\/[^/]+)\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/
    );

    const match = thumbnailMatch ?? originalMatch;
    if (!match) {
        return url.toString();
    }

    const [, wiki, hashHead, hashPrefix, fileName] = match;
    url.pathname = `${wiki}/thumb/${hashHead}/${hashPrefix}/${fileName}/${width}px-${fileName}`;
    return url.toString();
};

export const getDefaultExportForLambda = async (lambdaName: string) => {
    // Construct the absolute file path to the lambda folder, this should recognize the index.ts
    const filePath = path.resolve(
        __dirname,
        `../service/lambdas/${lambdaName}`
    );
    const module = await import(filePath);
    const defaultExport = module.default;
    return defaultExport;
};
