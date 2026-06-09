"use client";

import Map from "@/components/dashboard/Map";
import LiveTimingList from "@/components/dashboard/LiveTimingList";

export default function TrackMap() {
	return (
		<div className="flex flex-col-reverse md:h-full md:flex-row">
			<LiveTimingList />

			<div className="md:flex-1">
				<Map />
			</div>
		</div>
	);
}
