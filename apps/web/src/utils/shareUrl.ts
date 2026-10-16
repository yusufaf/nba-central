import { appUrl } from './appUrl';

// The public page lives at /t/:uuid on whatever origin served the app, so
// a dev-server link points at the dev server, production at the site and a
// PR preview at that preview.
export const shareUrlFor = (teamUUID: string): string => appUrl(`/t/${teamUUID}`);
