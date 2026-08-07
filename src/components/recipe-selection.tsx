"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/**
 * Multi-select state for the recipe list, shared by the card overlays and the
 * batch action bar.
 *
 * Deliberately a provider rendered *by* `RecipeBrowser` rather than state
 * inside it: paging is a same-route navigation, so the provider keeps its
 * position in the element tree and the selection survives moving between pages.
 * Selecting on page 1, paging to page 2, selecting more, then applying tags to
 * all of them works.
 *
 * Selection mode is an explicit toggle because a card tap has to keep meaning
 * "open this recipe" the rest of the time — especially on a phone.
 */
type SelectionContextValue = {
  active: boolean;
  setActive: (on: boolean) => void;
  selected: ReadonlySet<string>;
  toggle: (id: string) => void;
  selectMany: (ids: string[]) => void;
  clear: () => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function RecipeSelectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [active, setActiveState] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectMany = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const setActive = useCallback((on: boolean) => {
    setActiveState(on);
    // Leaving selection mode drops the selection: a hidden selection that
    // reappears later is a good way to tag the wrong recipes.
    if (!on) setSelected(new Set());
  }, []);

  const value = useMemo(
    () => ({ active, setActive, selected, toggle, selectMany, clear }),
    [active, setActive, selected, toggle, selectMany, clear],
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection(): SelectionContextValue {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("useSelection must be used within a RecipeSelectionProvider");
  }
  return context;
}
