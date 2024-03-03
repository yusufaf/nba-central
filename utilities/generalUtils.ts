/**
 * Capitalizes the first letter of a string.
 */
export const capitalizeFirstLetter = (string: string) => {
    return `${string.charAt(0).toUpperCase()}${string.slice(1)}`;
};
