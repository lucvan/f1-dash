"use client";

import { motion } from "motion/react";

import StreamPlayer from "@/components/StreamPlayer";
import { useF1tvStore } from "@/stores/useF1tvStore";

// Draggable floating Sky Sports F1 mini-player, shown on dashboard pages when
// toggled on. Rendered from the dashboard layout so it survives client-side
// navigation between pages (continuous playback).
export default function FloatingPlayer() {
	const close = useF1tvStore((state) => state.close);

	return (
		<motion.div
			drag
			dragMomentum={false}
			dragElastic={0}
			className="fixed right-4 bottom-4 z-50 w-72 overflow-hidden rounded-xl border border-zinc-700 bg-black shadow-2xl"
		>
			<div className="flex cursor-move items-center justify-between bg-zinc-900 px-2 py-1">
				<span className="text-xs text-zinc-400">F1 TV · Sky Sports F1</span>
				<button
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
