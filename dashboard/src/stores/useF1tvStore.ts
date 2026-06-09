import { persist, createJSONStorage } from "zustand/middleware";
import { create } from "zustand";

// Whether the floating F1 TV mini-player is shown on dashboard pages.
// Off by default; the choice is remembered per browser.
type F1tvStore = {
	floatingOpen: boolean;
	floatWidth: number; // px; the mini-player keeps a 16:9 ratio, so width drives size
	toggle: () => void;
	close: () => void;
	setFloatWidth: (floatWidth: number) => void;
};

export const useF1tvStore = create<F1tvStore>()(
	persist(
		(set) => ({
			floatingOpen: false,
			floatWidth: 288, // = w-72, the previous fixed width
			toggle: () => set((state) => ({ floatingOpen: !state.floatingOpen })),
			close: () => set({ floatingOpen: false }),
			setFloatWidth: (floatWidth) => set({ floatWidth }),
		}),
		{
			name: "f1tv-storage",
			storage: createJSONStorage(() => localStorage),
		},
	),
);
