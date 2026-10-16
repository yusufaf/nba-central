import { IS_PREVIEW } from './preview';

export interface AppUrlOptions {
    origin?: string;
    // Vite's BASE_URL: "/" in production, "/nba-central/pr-preview/pr-<N>/" in a PR preview.
    base?: string;
    // Previews use hash history, so the route goes after "#".
    hash?: boolean;
}

// Absolute URL for an in-app route, e.g. a share link that has to work outside the app.
export const appUrl = (
    routePath: string,
    {
        origin = window.location.origin,
        base = import.meta.env.BASE_URL,
        hash = IS_PREVIEW,
    }: AppUrlOptions = {},
): string => {
    // Collapsing leading slashes keeps "//host/x" from becoming a
    // protocol-relative URL; concatenating (not new URL(path, origin)) keeps
    // the result on this origin whatever the route contains.
    const route = '/' + routePath.replace(/^\/+/, '');
    const root = base.endsWith('/') ? base : `${base}/`;
    return hash ? `${origin}${root}#${route}` : `${origin}${root}${route.slice(1)}`;
};
