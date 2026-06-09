"use client";

import { useEffect, useRef } from "react";
import { motion, useDragControls } from "motion/react";

import StreamPlayer from "@/components/StreamPlayer";
import { useF1tvStore } from "@/stores/useF1tvStore";

// Draggable + resizable floating Sky Sports F1 mini-player, shown on dashboard
// pages when toggled on. Rendered from the dashboard layout so it survives
// client-side navigation between pages (continuous playback).
//
// Resize: native CSS `resize: horizontal` (grip at the bottom-right). The player
// keeps a 16:9 ratio, so width drives the overall size and the video never
// distorts. The width is remembered (persisted in the store).
//
// Drag is bound to the header only (via dragControls), so dragging the resize
// grip or the video controls doesn't move the window.
export default function FloatingPlayer() {
	const close = useF1tvStore((state) => state.close);
	const floatWidth = useF1tvStore((state) => state.floatWidth);
	const setFloatWidth = useF1tvStore((state) => state.setFloatWidth);

	const controls = useDragControls();
	const ref = useRef<HTMLDivElement | null>(null);

	// Persist the width the user drags the native resize grip to.
	useEffect(() => {
		const el = ref.current;
		if (!el || typeof ResizeObserver === "undefined") return;
		const ro = new ResizeObserver(() => {
			const w = Math.round(el.getBoundingClientRect().width);
			if (w > 0) setFloatWidth(w);
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, [setFloatWidth]);

	return (
		<motion.div
			ref={ref}
			drag
			dragListener={false}
			dragControls={controls}
			dragMomentum={false}
			dragElastic={0}
			style={{ width: floatWidth, resize: "horizontal" }}
			className="fixed right-4 bottom-4 z-50 flex min-w-[12rem] max-w-[90vw] flex-col overflow-hidden rounded-xl border border-zinc-700 bg-black shadow-2xl"
		>
			<div
				onPointerDown={(e) => controls.start(e)}
				className="flex shrink-0 cursor-move touch-none items-center justify-between bg-zinc-900 px-2 py-1 select-none"
			>
				<span className="text-xs text-zinc-400">F1 TV · Sky Sports F1</span>
				<button
					onPointerDown={(e) => e.stopPropagation()}
					onClick={close}
					className="rounded px-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
					aria-label="Close F1 TV mini-player"
				>
					✕
				</button>
			</div>

			<StreamPlayer className="aspect-video w-full bg-black" />
		</motion.div>
	);
}
