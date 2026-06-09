// Server-side HLS proxy for the "F1 TV" feature: it fetches the Sky Sports F1
// stream from the household TV app (iptv-restreamer) using a stream token held
// only in server env, and serves it back through this same f1-dash origin.
//
// Why a proxy:
//  - f1-dash is open to the internet; the TV stream is token-gated. Proxying
//    keeps the token server-side (never sent to the browser).
//  - The channel is hardcoded (F1TV_CHANNEL), so even an admin-scoped token
//    can only ever reach Sky F1 through here — not the rest of the IPTV catalog.
//  - The browser only talks to f1.e49ta.com (same origin) → no CORS / cast quirks.
//
// Caddy routes /api/* to the realtime service, so this MUST live off /api.

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const UPSTREAM = (process.env.F1TV_UPSTREAM ?? "").replace(/\/$/, "");
const CHANNEL = process.env.F1TV_CHANNEL ?? "sky-f1";
const TOKEN = process.env.F1TV_STREAM_TOKEN ?? "";

const contentTypeFor = (leaf: string): string => {
	if (leaf.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
	if (leaf.endsWith(".ts")) return "video/mp2t";
	if (leaf === "init.mp4") return "video/mp4";
	if (leaf.endsWith(".m4s")) return "video/iso.segment";
	return "application/octet-stream";
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
	if (!UPSTREAM || !TOKEN) {
		return new Response("F1 TV not configured", { status: 503 });
	}

	const { path } = await params;
	const leaf = path?.[path.length - 1] ?? "index.m3u8";

	// Only proxy known HLS leaves for the one hardcoded channel.
	const allowed = leaf === "index.m3u8" || /^seg_\d+\.(ts|m4s)$/.test(leaf) || leaf === "init.mp4";
	if (!allowed) {
		return new Response("not found", { status: 404 });
	}

	const upstreamUrl = `${UPSTREAM}/${CHANNEL}/${leaf}?st=${encodeURIComponent(TOKEN)}`;

	let res: Response;
	try {
		res = await fetch(upstreamUrl, { cache: "no-store" });
	} catch {
		return new Response("upstream unreachable", { status: 502 });
	}

	if (!res.ok) {
		return new Response(`upstream ${res.status}`, { status: res.status === 404 ? 404 : 502 });
	}

	const headers = new Headers({ "Cache-Control": "no-store" });

	if (leaf.endsWith(".m3u8")) {
		// Strip the upstream ?st=… token from segment + EXT-X-MAP lines so the
		// browser requests bare relative names (e.g. seg_0.ts) back through this
		// proxy, which re-adds the token server-side.
		const text = (await res.text()).replace(/\?st=[^\s"']*/g, "");
		headers.set("Content-Type", "application/vnd.apple.mpegurl");
		return new Response(text, { status: 200, headers });
	}

	headers.set("Content-Type", contentTypeFor(leaf));
	return new Response(res.body, { status: 200, headers });
}
