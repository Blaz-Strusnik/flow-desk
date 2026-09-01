import { create } from "zustand";

interface BoardStore {
  /** id of the card currently being dragged, for the drag overlay — purely
   * transient UI state, never persisted, so it doesn't belong in React Query. */
  activeCardId: string | null;
  setActiveCardId: (id: string | null) => void;
}

export const useBoardStore = create<BoardStore>((set) => ({
  activeCardId: null,
  setActiveCardId: (id) => set({ activeCardId: id }),
}));
