// The public page lives at /t/:uuid on whatever origin served the app, so
// a dev-server link points at the dev server and production at the site.
export const shareUrlFor = (teamUUID: string): string =>
    `${window.location.origin}/t/${teamUUID}`;
