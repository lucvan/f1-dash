import { persist, createJSONStorage } from "zustand/middleware";
import { create } from "zustand";

// Whether the floating F1 TV mini-player is shown on dashboard pages.
// Off by default; the choice is remembered per browser.
type F1tvStore = {
	floatingOpen: boolean;
	toggle: () => void;
	close: () => void;
};

export const useF1tvStore = create<F1tvStore>()(
	persist(
		(set) => ({
			floatingOpen: false,
			toggle: () => set((state) => ({ floatingOpen: !state.floatingOpen })),
			close: () => set({ floatingOpen: false }),
		}),
		{
			name: "f1tv-storage",
			storage: createJSONStorage(() => localStorage),
		},
	),
);
