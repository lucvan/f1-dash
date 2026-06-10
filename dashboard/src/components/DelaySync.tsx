"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { utc, duration } from "moment";

import { useDataStore } from "@/stores/useDataStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useF1tvStore } from "@/stores/useF1tvStore";

// Delay auto-sync (beta). Grabs a frame from the F1 TV video (readable because
// the stream is same-origin via /f1tv-stream), OCRs the qualifying countdown
// clock from a calibrated crop region, and sets the app delay so the timing
// data lines up with the broadcast:
//
//   delay = R_tv - R_live      (clamped >= 0)
//
// where R_tv is the OCR'd on-screen remaining time and R_live is f1-dash's
// un-delayed extrapolated remaining (ExtrapolatedClock). The clock is only on
// screen during qualifying/practice; outside that, reads simply won't match the
// time pattern and nothing is applied.

const TESSERACT_SRC = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

type Tesseract = {
	recognize: (
		image: HTMLCanvasElement | string,
		lang: string,
		options?: Record<string, unknown>,
	) => Promise<{ data: { text: string } }>;
};

let tessLoader: Promise<Tesseract | null> | null = null;

function loadTesseract(): Promise<Tesseract | null> {
	if (typeof window === "undefined") return Promise.resolve(null);
	const existing = (window as unknown as { Tesseract?: Tesseract }).Tesseract;
	if (existing) return Promise.resolve(existing);
	if (!tessLoader) {
		tessLoader = new Promise((resolve) => {
			const s = document.createElement("script");
			s.src = TESSERACT_SRC;
			s.onload = () => resolve((window as unknown as { Tesseract?: Tesseract }).Tesseract ?? null);
			s.onerror = () => resolve(null);
			document.head.appendChild(s);
		});
	}
	return tessLoader;
}

// "1:23:45" / "23:45" / "18:00" -> seconds. null if no time-like token.
function parseClockSeconds(text: string): number | null {
	const m = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
	if (!m) return null;
	const a = parseInt(m[1], 10);
	const b = parseInt(m[2], 10);
	const c = m[3] !== undefined ? parseInt(m[3], 10) : null;
	return c !== null ? a * 3600 + b * 60 + c : a * 60 + b;
}

function fmt(sec: number): string {
	const s = Math.max(0, Math.round(sec));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const ss = s % 60;
	const pad = (n: number) => n.toString().padStart(2, "0");
	return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}

export default function DelaySync({ videoRef }: { videoRef: RefObject<HTMLVideoElement | null> }) {
	const clock = useDataStore((state) => state.state?.ExtrapolatedClock);
	const delay = useSettingsStore((state) => state.delay);
	const setDelay = useSettingsStore((state) => state.setDelay);

	const crop = useF1tvStore((state) => state.clockCrop);
	const setClockCrop = useF1tvStore((state) => state.setClockCrop);

	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [auto, setAuto] = useState(false);
	const [thumb, setThumb] = useState<string | null>(null);
	const [status, setStatus] = useState<string>("");
	const [read, setRead] = useState<{ ocr: string; rTv: number | null; rLive: number | null; suggest: number | null }>(
		{ ocr: "", rTv: null, rLive: null, suggest: null },
	);

	// f1-dash's un-delayed live remaining (mirrors SessionInfo's extrapolation, minus the delay term).
	const liveRemainingSec = (): number | null => {
		if (!clock?.Remaining) return null;
		let ms = duration(clock.Remaining).asMilliseconds();
		if (clock.Extrapolating) ms -= utc().diff(utc(clock.Utc));
		return ms / 1000;
	};

	const runOnce = async (autoApply: boolean) => {
		const video = videoRef.current;
		if (!video || video.readyState < 2 || !video.videoWidth) {
			setStatus("video not ready");
			return;
		}

		const vw = video.videoWidth;
		const vh = video.videoHeight;
		const sx = Math.round((crop.x / 100) * vw);
		const sy = Math.round((crop.y / 100) * vh);
		const sw = Math.max(1, Math.round((crop.w / 100) * vw));
		const sh = Math.max(1, Math.round((crop.h / 100) * vh));

		const scale = 3; // upscale the crop to help OCR
		const canvas = document.createElement("canvas");
		canvas.width = sw * scale;
		canvas.height = sh * scale;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			setStatus("no 2d context");
			return;
		}

		let dataUrl: string;
		try {
			ctx.imageSmoothingEnabled = true;
			ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
			dataUrl = canvas.toDataURL("image/png"); // also surfaces a taint error if cross-origin
		} catch {
			setStatus("can't read video pixels (canvas tainted / cross-origin)");
			return;
		}
		setThumb(dataUrl);

		setBusy(true);
		setStatus("reading…");
		try {
			const T = await loadTesseract();
			if (!T) {
				setStatus("OCR failed to load");
				return;
			}
			const { data } = await T.recognize(canvas, "eng");
			const ocr = (data?.text ?? "").trim();
			const rTv = parseClockSeconds(ocr);
			const rLive = liveRemainingSec();
			const suggest = rTv !== null && rLive !== null ? Math.max(0, Math.min(600, Math.round(rTv - rLive))) : null;
			setRead({ ocr, rTv, rLive, suggest });

			if (rTv === null) {
				setStatus("no clock found in crop (only present during quali/practice)");
			} else if (rLive === null) {
				setStatus("no live session clock to compare against");
			} else if (suggest !== null && autoApply) {
				setDelay(suggest);
				setStatus(`synced → delay ${suggest}s`);
			} else {
				setStatus(`read ${fmt(rTv)} → suggested delay ${suggest}s`);
			}
		} finally {
			setBusy(false);
		}
	};

	// keep the interval calling the latest closure
	const runRef = useRef(runOnce);
	runRef.current = runOnce;

	useEffect(() => {
		if (!auto) return;
		const id = setInterval(() => runRef.current(true), 20000);
		runRef.current(true);
		return () => clearInterval(id);
	}, [auto]);

	// Diagnostic: /dashboard/f1-tv?synctest=1 opens the panel and runs one capture
	// after the stream has had time to produce frames (handy to confirm the crop
	// + that pixels are readable).
	useEffect(() => {
		if (typeof window === "undefined") return;
		if (!new URLSearchParams(window.location.search).has("synctest")) return;
		setOpen(true);
		const t = setTimeout(() => runRef.current(false), 6000);
		return () => clearTimeout(t);
	}, []);

	const cropField = (key: keyof typeof crop, label: string) => (
		<label className="flex items-center gap-1 text-xs text-zinc-400">
			{label}
			<input
				type="number"
				min={0}
				max={100}
				value={crop[key]}
				onChange={(e) => setClockCrop({ ...crop, [key]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
				className="w-12 rounded bg-zinc-800 p-1 text-center text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
			/>
		</label>
	);

	return (
		<div className="rounded-lg border border-zinc-800 bg-zinc-950 text-sm">
			<button
				onClick={() => setOpen((o) => !o)}
				className="flex w-full items-center justify-between p-2 text-left text-zinc-300"
			>
				<span>⏱ Delay auto-sync (beta) — quali clock</span>
				<span className="text-xs text-zinc-500">applied delay: {delay}s {open ? "▾" : "▸"}</span>
			</button>

			{open && (
				<div className="flex flex-col gap-2 border-t border-zinc-800 p-2">
					<div className="flex flex-wrap items-center gap-2">
						<button
							onClick={() => runOnce(false)}
							disabled={busy}
							className="rounded-lg bg-zinc-800 px-3 py-1 hover:bg-zinc-700 disabled:opacity-50"
						>
							Capture & read
						</button>
						<button
							onClick={() => read.suggest !== null && setDelay(read.suggest)}
							disabled={read.suggest === null}
							className="rounded-lg bg-sky-800 px-3 py-1 hover:bg-sky-700 disabled:opacity-40"
						>
							Apply {read.suggest !== null ? `${read.suggest}s` : ""}
						</button>
						<label className="flex items-center gap-1 text-xs text-zinc-400">
							<input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
							Keep synced (every 20s)
						</label>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<span className="text-xs text-zinc-500">crop %</span>
						{cropField("x", "x")}
						{cropField("y", "y")}
						{cropField("w", "w")}
						{cropField("h", "h")}
					</div>

					{thumb && (
						<div className="flex items-start gap-3">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img src={thumb} alt="captured clock crop" className="max-h-24 rounded border border-zinc-700" />
							<div className="flex flex-col gap-0.5 text-xs text-zinc-400">
								<span>OCR: &quot;{read.ocr.replace(/\s+/g, " ").slice(0, 40)}&quot;</span>
								<span>broadcast clock: {read.rTv !== null ? fmt(read.rTv) : "—"}</span>
								<span>data live clock: {read.rLive !== null ? fmt(read.rLive) : "—"}</span>
								<span>suggested delay: {read.suggest !== null ? `${read.suggest}s` : "—"}</span>
							</div>
						</div>
					)}

					<p className="text-xs text-zinc-500">{status}</p>
				</div>
			)}
		</div>
	);
}
