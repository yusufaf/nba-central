// Saves a Blob as a browser download without navigating away. The object
// URL is revoked on a delay, not right after click(): Firefox can abort an
// in-progress download if the blob URL is revoked synchronously.
export const downloadBlobAsFile = (blob: Blob, filename: string): void => {
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
};

// Streams a same-site or CORS-enabled URL into a browser download.
export const downloadUrlAsFile = async (url: string, filename: string): Promise<void> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    downloadBlobAsFile(await res.blob(), filename);
};

export const slugFilename = (name: string, ext: string): string =>
    `${(name.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "team")}.${ext}`;
