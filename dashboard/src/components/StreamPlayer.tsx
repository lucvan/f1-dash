"use client";

import { forwardRef, useEffect, useRef } from "react";

// Plays the F1 TV stream served by this app's own /f1tv-stream proxy (same
// origin). Uses native HLS on Safari/iOS, hls.js (loaded from CDN) elsewhere.
// Mirrors the tuning + error-recovery used by the TV app's own player.
//
// Forwards a ref to the underlying <video> so callers (e.g. the delay-sync
// calibration tool) can grab frames — readable because the media is same-origin.

const SRC = "/f1tv-stream/index.m3u8";

type HlsInstance = {
	loadSource(src: string): void;
	attachMedia(el: HTMLMediaElement): void;
	recoverMediaError(): void;
	destroy(): void;
	on(event: string, cb: (e: unknown, data: { fatal: boolean; type: string }) => void): void;
};

type HlsCtor = {
	new (config?: Record<string, unknown>): HlsInstance;
	isSupported(): boolean;
	Events: { ERROR: string };
	ErrorTypes: { NETWORK_ERROR: string; MEDIA_ERROR: string };
};

let hlsLoader: Promise<HlsCtor | null> | null = null;

function loadHls(): Promise<HlsCtor | null> {
	if (typeof window === "undefined") return Promise.resolve(null);
	const existing = (window as unknown as { Hls?: HlsCtor }).Hls;
	if (existing) return Promise.resolve(existing);
	if (!hlsLoader) {
		hlsLoader = new Promise((resolve) => {
			const s = document.createElement("script");
			s.src = "https://cdn.jsdelivr.net/npm/hls.js@1";
			s.onload = () => resolve((window as unknown as { Hls?: HlsCtor }).Hls ?? null);
			s.onerror = () => resolve(null);
			document.head.appendChild(s);
		});
	}
	return hlsLoader;
}

const StreamPlayer = forwardRef<HTMLVideoElement, { className?: string }>(function StreamPlayer(
	{ className },
	forwardedRef,
) {
	const innerRef = useRef<HTMLVideoElement | null>(null);

	const setRefs = (el: HTMLVideoElement | null) => {
		innerRef.current = el;
		if (typeof forwardedRef === "function") forwardedRef(el);
		else if (forwardedRef) forwardedRef.current = el;
	};

	useEffect(() => {
		const video = innerRef.current;
		if (!video) return;

		let hls: HlsInstance | null = null;
		let cancelled = false;
		let retry: ReturnType<typeof setTimeout> | null = null;

		const startNative = () => {
			video.src = SRC;
			video.load();
		};

		const start = async () => {
			if (cancelled) return;
			if (video.canPlayType("application/vnd.apple.mpegurl")) {
				startNative();
				return;
			}
			const Hls = await loadHls();
			if (cancelled) return;
			if (Hls && Hls.isSupported()) {
				if (hls) {
					try {
						hls.destroy();
					} catch {}
				}
				hls = new Hls({
					liveSyncDurationCount: 6,
					liveMaxLatencyDurationCount: 15,
					maxBufferLength: 30,
					maxMaxBufferLength: 60,
					backBufferLength: 30,
					lowLatencyMode: false,
				});
				hls.loadSource(SRC);
				hls.attachMedia(video);
				hls.on(Hls.Events.ERROR, (_e, data) => {
					if (!data?.fatal) return;
					if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
						retry = setTimeout(start, 4000);
					} else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
						try {
							hls?.recoverMediaError();
						} catch {
							retry = setTimeout(start, 4000);
						}
					} else {
						retry = setTimeout(start, 4000);
					}
				});
			} else {
				startNative();
			}
		};

		start();

		return () => {
			cancelled = true;
			if (retry) clearTimeout(retry);
			if (hls) {
				try {
					hls.destroy();
				} catch {}
			}
		};
	}, []);

	return <video ref={setRefs} className={className} controls autoPlay muted playsInline crossOrigin="anonymous" />;
});

export default StreamPlayer;
