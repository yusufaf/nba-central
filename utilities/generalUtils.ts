import * as path from "path";

/**
 * Capitalizes the first letter of a string.
 */
export const capitalizeFirstLetter = (string: string) => {
    return `${string.charAt(0).toUpperCase()}${string.slice(1)}`;
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
