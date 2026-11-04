// The handler logs a failed source as `<source> Fetch Error`, and the
// soft-failure metric filter in ../index.ts counts lines containing this text.
// One constant keeps the two from drifting apart.
export const FETCH_ERROR = "Fetch Error";
