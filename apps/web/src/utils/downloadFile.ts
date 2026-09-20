// Streams a same-site or CORS-enabled URL into a browser download without
// navigating away; the object URL is revoked once the click has fired.
export const downloadUrlAsFile = async (url: string, filename: string): Promise<void> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
};

export const slugFilename = (name: string, ext: string): string =>
    `${(name.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "team")}.${ext}`;
