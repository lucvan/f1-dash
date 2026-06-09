"use client";

import LiveTimingList from "@/components/dashboard/LiveTimingList";
import StreamPlayer from "@/components/StreamPlayer";

// Laid out like Track Map, but the map is replaced by the live Sky Sports F1
// video stream (served through this app's /f1tv-stream proxy).
export default function F1Tv() {
	return (
		<div className="flex flex-col-reverse md:h-full md:flex-row">
			<LiveTimingList />

			<div className="flex md:h-full md:flex-1">
				<StreamPlayer className="h-full max-h-[60vh] w-full rounded-lg bg-black object-contain md:max-h-full" />
			</div>
		</div>
	);
}
