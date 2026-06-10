import { persist, createJSONStorage } from "zustand/middleware";
import { create } from "zustand";

// Whether the floating F1 TV mini-player is shown on dashboard pages.
// Off by default; the choice is remembered per browser.
// The crop region (percentages of the video frame) where the qualifying
// countdown clock appears — used by the OCR delay-sync tool. Calibrated once
// and remembered.
export type ClockCrop = { x: number; y: number; w: number; h: number };

type F1tvStore = {
	floatingOpen: boolean;
	floatWidth: number; // px; the mini-player keeps a 16:9 ratio, so width drives size
	clockCrop: ClockCrop;
	toggle: () => void;
	close: () => void;
	setFloatWidth: (floatWidth: number) => void;
	setClockCrop: (clockCrop: ClockCrop) => void;
};

export const useF1tvStore = create<F1tvStore>()(
	persist(
		(set) => ({
			floatingOpen: false,
			floatWidth: 288, // = w-72, the previous fixed width
			clockCrop: { x: 0, y: 0, w: 33, h: 22 }, // default top-left band; calibrate per feed
			toggle: () => set((state) => ({ floatingOpen: !state.floatingOpen })),
			close: () => set({ floatingOpen: false }),
			setFloatWidth: (floatWidth) => set({ floatWidth }),
			setClockCrop: (clockCrop) => set({ clockCrop }),
		}),
		{
			name: "f1tv-storage",
			storage: createJSONStorage(() => localStorage),
		},
	),
);
