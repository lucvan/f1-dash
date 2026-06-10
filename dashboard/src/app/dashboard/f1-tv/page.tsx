"use client";

import { useRef } from "react";

import LiveTimingList from "@/components/dashboard/LiveTimingList";
import StreamPlayer from "@/components/StreamPlayer";
import DelaySync from "@/components/DelaySync";

// Laid out like Track Map, but the map is replaced by the live Sky Sports F1
// video stream (served through this app's /f1tv-stream proxy). Below the video
// sits the OCR delay auto-sync tool (reads the quali clock).
export default function F1Tv() {
	const videoRef = useRef<HTMLVideoElement>(null);

	return (
		<div className="flex flex-col-reverse md:h-full md:flex-row">
			<LiveTimingList />

			<div className="flex min-w-0 flex-col gap-2 md:h-full md:flex-1">
				<StreamPlayer
					ref={videoRef}
					className="max-h-[60vh] w-full rounded-lg bg-black object-contain md:max-h-none md:min-h-0 md:flex-1"
				/>
				<DelaySync videoRef={videoRef} />
			</div>
		</div>
	);
}
