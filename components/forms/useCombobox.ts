"use client";
// The ARIA combobox pattern (an input that owns a listbox), shared by LocationInput and SearchTypeahead.
// Arrows move, Enter picks, Esc closes (a second Esc clears), Tab closes without picking. The input keeps focus;
// aria-activedescendant points at the highlighted option.
import { KeyboardEvent, MouseEvent as ReactMouseEvent, useCallback, useEffect, useId, useRef, useState } from "react";

export function useCombobox<T>({ items, onPick, onEscapeEmpty }: { items: T[]; onPick: (item: T) => void; onEscapeEmpty?: () => void }) {
  const base = useId().replace(/:/g, "");
  const listId = `${base}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const shown = open && items.length > 0;

  // New suggestions: nothing highlighted until the person arrows down (so Enter still submits what they typed).
  useEffect(() => setActive(-1), [items]);

  // Click or tap outside closes.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const optionId = useCallback((i: number) => `${base}-opt-${i}`, [base]);

  const pick = useCallback(
    (i: number) => {
      const it = items[i];
      if (!it) return;
      onPick(it);
      setOpen(false);
      setActive(-1);
    },
    [items, onPick],
  );

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((a) => (items.length ? (a + 1) % items.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((a) => (items.length ? (a <= 0 ? items.length - 1 : a - 1) : -1));
    } else if (e.key === "Enter") {
      if (shown && active >= 0) {
        e.preventDefault();
        pick(active);
      } else setOpen(false);
    } else if (e.key === "Escape") {
      if (shown) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      } else onEscapeEmpty?.();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  // Keep the highlighted option in view in a scrolling list.
  useEffect(() => {
    if (active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  }, [active, optionId]);

  const inputProps = {
    role: "combobox" as const,
    "aria-expanded": shown,
    "aria-controls": listId,
    "aria-autocomplete": "list" as const,
    "aria-activedescendant": shown && active >= 0 ? optionId(active) : undefined,
    onKeyDown,
  };

  const listProps = { id: listId, role: "listbox" as const };

  const optionProps = (i: number) => ({
    id: optionId(i),
    role: "option" as const,
    "aria-selected": i === active,
    // mousedown, not click: picking must happen before the input's blur closes the list.
    onMouseDown: (e: ReactMouseEvent) => {
      e.preventDefault();
      pick(i);
    },
    onMouseMove: () => active !== i && setActive(i),
  });

  return { open, setOpen, shown, active, setActive, wrapRef, inputProps, listProps, optionProps, pick };
}
