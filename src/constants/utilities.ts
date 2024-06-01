export const range = (start: number, stop: number, step: number = 1) => {
    return Array.from(
        { length: (stop - start) / step + 1 },
        (_, i) => start + i * step,
    );
};

export const roundValueToNPlaces = (value: any, n: number = 1) => {
    return Number(value).toFixed(n);
};

export const getRandomIndex = (data: any[]): number => {
    return Math.floor(Math.random() * data.length);
};
