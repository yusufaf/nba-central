// ESPN's site API turns away clients that don't look like a browser.
export const ESPN_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

// Leaves the proxy Lambdas' 10 s timeout room to answer 502.
export const ESPN_PROXY_TIMEOUT_MS = 8_000;

export type EspnJson =
	| { ok: true; text: string; body: unknown }
	| { ok: false; status: number | null; reason: string };

// Never throws. `text` is ESPN's body as sent, so a proxy can pass it through
// without re-serializing ~400 KB.
export const fetchEspnJson = async (url: string): Promise<EspnJson> => {
	let res: Response;
	try {
		res = await fetch(url, {
			headers: { "User-Agent": ESPN_USER_AGENT, Accept: "application/json" },
			signal: AbortSignal.timeout(ESPN_PROXY_TIMEOUT_MS),
		});
	} catch (err) {
		return { ok: false, status: null, reason: err instanceof Error ? err.message : String(err) };
	}
	if (!res.ok) {
		await res.body?.cancel().catch(() => {});
		return { ok: false, status: res.status, reason: `ESPN returned ${res.status}` };
	}
	try {
		const text = await res.text();
		return { ok: true, text, body: JSON.parse(text) };
	} catch {
		return { ok: false, status: null, reason: "invalid JSON" };
	}
};
