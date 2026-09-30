import { useCallback, useReducer, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { COLOURS, STYLES, type PlanId } from "@/lib/plans";
import { previewKey } from "@/lib/booking-rules";
import { makePreview } from "@/lib/booking.functions";

export type Draft = {
  booking: { id: string; vehicle: string } | null;
  photo: string | null;
  plan: PlanId | null;
  colour: string;
  style: string;
  mobile: boolean;
  pin: { lat: number; lng: number } | null;
  building: string;
  floor: string;
  parking: string;
  guard: boolean;
  water: boolean;
  slot: { date: string; time: string } | null;
  name: string;
  phone: string;
  email: string;
  manageToken: string;
};

export const initialDraft: Draft = {
  booking: null,
  photo: null,
  plan: null,
  colour: COLOURS[0].name,
  style: STYLES[0],
  mobile: true,
  pin: null,
  building: "",
  floor: "",
  parking: "",
  guard: false,
  water: true,
  slot: null,
  name: "",
  phone: "",
  email: "",
  manageToken: "",
};

type Action = { type: "patch"; patch: Partial<Draft> } | { type: "reset" };

export function draftReducer(state: Draft, a: Action): Draft {
  if (a.type === "reset") return { ...initialDraft, name: state.name, phone: state.phone, email: state.email };
  return { ...state, ...a.patch };
}

export type SetDraft = (patch: Partial<Draft>) => void;

export function useBookingDraft() {
  const [draft, dispatch] = useReducer(draftReducer, initialDraft);
  const set = useCallback<SetDraft>((patch) => dispatch({ type: "patch", patch }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  return { draft, set, reset };
}

/** Background AI previews keyed by plan (+colour/style for Signature); each key is generated once. */
export function usePreviews(bookingId: string | undefined) {
  const preview = useServerFn(makePreview);
  const [cache, setCache] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(new Set<string>());

  const run = useCallback(
    async (p: PlanId, c?: string, s?: string) => {
      if (!bookingId) return;
      const k = previewKey(p, c, s);
      if (started.current.has(k)) return;
      started.current.add(k);
      setPending(k);
      setError(null);
      try {
        const r = await preview({ data: { bookingId, plan: p, colour: c, style: s } });
        if (r.previewUrl) setCache((m) => ({ ...m, [k]: r.previewUrl! }));
      } catch (e) {
        started.current.delete(k);
        setError((e as Error).message);
      } finally {
        setPending((cur) => (cur === k ? null : cur));
      }
    },
    [bookingId, preview],
  );

  const seed = useCallback((k: string, url: string) => {
    started.current.add(k);
    setCache({ [k]: url });
  }, []);
  const clear = useCallback(() => {
    started.current.clear();
    setCache({});
    setError(null);
  }, []);

  return { cache, pending, error, run, seed, clear };
}
