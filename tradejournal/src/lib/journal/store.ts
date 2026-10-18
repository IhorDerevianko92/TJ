import { create } from "zustand";
import { newId, round2 } from "./engine";
import { DEFAULT_STARTING_EQUITY, freezeOpenTrade, normalizeTrade } from "./seed";
import { normalizeFill } from "./portfolio";
import { computeBooks, fitsAmount, normalizeTransfer, transferable } from "./books";
import { loadJournal, saveJournal } from "./api";
import type { BookId, CashMove, Direction, JournalPayload, Market, SpotFill, Trade, Transfer } from "./types";

const CACHE_KEYS = ["trade-journal-v8", "trade-journal-v7", "trade-journal-v5", "trade-journal-v4"] as const;
const HYDRATE_MS = 8000;

type JournalStore = {
  startingEquity: number;
  trades: Trade[];
  cashMoves: CashMove[];
  spots: SpotFill[];
  transfers: Transfer[];
  hydrated: boolean;
  hydrating: boolean;
  persistError: string | null;
  setStartingEquity: (n: number) => void;
  openTrade: (input: {
    pair: string;
    date: string;
    direction: Direction;
    riskPct: number;
    accountSize: number;
    entryPrice: number;
    stopPrice: number;
    takeProfit: number;
    feeOpen: number;
    feeClose: number;
    stopPct?: number | null;
    note?: string;
    market?: Market;
    volume?: number | null;
  }) => Trade;
  addRealization: (input: {
    tradeId: string;
    amount: number;
    note: string;
    date: string;
    moveToBe: boolean;
    close: boolean;
  }) => void;
  addCash: (input: { date: string; amount: number; note: string }) => void;
  deleteCash: (id: string) => void;
  deleteTrade: (id: string) => void;
  buySpot: (input: { coin: string; date: string; usd: number; price: number; note?: string }) => boolean;
  sellSpot: (input: { coin: string; date: string; qty: number; price: number; note?: string }) => void;
  deleteSpot: (id: string) => void;
  transfer: (input: { from: BookId; to: BookId; amount: number; note: string; date: string }) => boolean;
  allocate: (book: "journal" | "forex" | "portfolio", target: number) => boolean;
  deleteTransfer: (id: string) => boolean;
  replaceJournal: (payload: JournalPayload) => Promise<void>;
  hydrate: () => Promise<void>;
};

function cleanTransfers(raw: Transfer[] | undefined): Transfer[] {
  const out: Transfer[] = [];
  for (const row of raw ?? []) {
    const next = normalizeTransfer({ ...row, id: row?.id || newId() });
    if (next) out.push(next);
  }
  return out;
}

function emptyJournal(): JournalPayload {
  return {
    startingEquity: DEFAULT_STARTING_EQUITY,
    trades: [],
    cashMoves: [],
    spots: [],
    transfers: [],
  };
}

function cleanPayload(src: JournalPayload | null): JournalPayload {
  if (!src) return emptyJournal();
  return {
    startingEquity: src.startingEquity || DEFAULT_STARTING_EQUITY,
    trades: src.trades,
    cashMoves: src.cashMoves ?? [],
    spots: (src.spots ?? []).map(normalizeFill).filter((f): f is SpotFill => f != null),
    transfers: cleanTransfers(src.transfers),
  };
}

function readLocalCache(): JournalPayload | null {
  if (typeof window === "undefined") return null;
  for (const key of CACHE_KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        state?: JournalPayload;
        startingEquity?: number;
        trades?: Trade[];
        cashMoves?: CashMove[];
        spots?: SpotFill[];
        transfers?: Transfer[];
      };
      const src = parsed.state ?? parsed;
      const trades = src.trades;
      if (!Array.isArray(trades)) continue;
      return {
        startingEquity: src.startingEquity ?? DEFAULT_STARTING_EQUITY,
        trades: trades.map(normalizeTrade),
        cashMoves: src.cashMoves ?? [],
        spots: (src.spots ?? []).map(normalizeFill).filter((f): f is SpotFill => f != null),
        transfers: cleanTransfers(src.transfers),
      };
    } catch {
      /* ignore corrupt cache */
    }
  }
  return null;
}

function writeLocalCache(payload: JournalPayload) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      "trade-journal-v8",
      JSON.stringify({ state: payload, version: 8 }),
    );
  } catch {
    /* quota */
  }
}

function snapshot(get: () => JournalStore): JournalPayload {
  const s = get();
  return {
    startingEquity: s.startingEquity,
    trades: s.trades,
    cashMoves: s.cashMoves,
    spots: s.spots,
    transfers: s.transfers,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export const useJournal = create<JournalStore>()((set, get) => {
  const persist = async () => {
    if (!get().hydrated) return;
    const data = snapshot(get);
    writeLocalCache(data);
    try {
      await saveJournal({ data });
      set({ persistError: null });
    } catch {
      set({ persistError: "Сервер не сохранил журнал. Данные есть на этом устройстве." });
      throw new Error("persist-failed");
    }
  };

  return {
    startingEquity: DEFAULT_STARTING_EQUITY,
    trades: [],
    cashMoves: [],
    spots: [],
    transfers: [],
    hydrated: false,
    hydrating: false,
    persistError: null,
    setStartingEquity: (n) => {
      set({ startingEquity: n });
      void persist().catch(() => {});
    },
    openTrade: (input) => {
      const market = input.market === "forex" ? "forex" : "crypto";
      const books = computeBooks({
        startingEquity: get().startingEquity,
        trades: get().trades,
        cashMoves: get().cashMoves,
        spots: get().spots,
        transfers: get().transfers,
      });
      const trade = freezeOpenTrade({
        ...input,
        market,
        currentEquity: market === "forex" ? books.forex : books.journal,
        accountSize:
          input.accountSize || (market === "forex" ? books.forexFree : books.journalFree),
      });
      set({ trades: [...get().trades, trade] });
      void persist().catch(() => {});
      return trade;
    },
    addRealization: ({ tradeId, amount, note, date, moveToBe, close }) => {
      const pnl = Number.isFinite(amount) ? round2(amount) : 0;
      set({
        trades: get().trades.map((t) => {
          if (t.id !== tradeId) return t;
          const realizations = [...t.realizations];
          if (close || pnl !== 0) {
            realizations.push({
              id: newId(),
              date,
              amount: pnl,
              note,
              kind: close ? "close" : "partial",
            });
          }
          const total = realizations.reduce((s, r) => s + r.amount, 0);
          const atBreakeven = moveToBe || close || t.atBreakeven;
          const outcome = close
            ? total > 0
              ? "win"
              : total < 0
                ? "loss"
                : "be"
            : t.outcome;
          return {
            ...t,
            realizations,
            atBreakeven,
            remainingRiskUsd: atBreakeven || close ? 0 : t.remainingRiskUsd,
            status: close ? ("closed" as const) : t.status,
            outcome,
            riskUsd: t.riskUsd,
            equityAtEntry: t.equityAtEntry,
          };
        }),
      });
      void persist().catch(() => {});
    },
    addCash: ({ date, amount, note }) => {
      if (!amount) return;
      set({
        cashMoves: [
          ...get().cashMoves,
          { id: newId(), date, amount: round2(amount), note: note.trim() },
        ],
      });
      void persist().catch(() => {});
    },
    deleteCash: (id) => {
      set({ cashMoves: get().cashMoves.filter((c) => c.id !== id) });
      void persist().catch(() => {});
    },
    deleteTrade: (id) => {
      set({ trades: get().trades.filter((t) => t.id !== id) });
      void persist().catch(() => {});
    },
    buySpot: ({ coin, date, usd, price, note }) => {
      const books = computeBooks({
        startingEquity: get().startingEquity,
        trades: get().trades,
        cashMoves: get().cashMoves,
        spots: get().spots,
        transfers: get().transfers,
      });
      if (!fitsAmount(usd, books.portfolioCash)) return false;
      const fill = normalizeFill({
        coin,
        date,
        side: "buy",
        usd,
        price,
        qty: price > 0 ? usd / price : 0,
        note,
        wallet: "portfolio",
      });
      if (!fill) return false;
      set({ spots: [...get().spots, fill] });
      void persist().catch(() => {});
      return true;
    },
    sellSpot: ({ coin, date, qty, price, note }) => {
      const fill = normalizeFill({
        coin,
        date,
        side: "sell",
        price,
        qty,
        usd: qty * price,
        note,
      });
      if (!fill) return;
      set({ spots: [...get().spots, fill] });
      void persist().catch(() => {});
    },
    deleteSpot: (id) => {
      set({ spots: get().spots.filter((s) => s.id !== id) });
      void persist().catch(() => {});
    },
    transfer: ({ from, to, amount, note, date }) => {
      const books = computeBooks({
        startingEquity: get().startingEquity,
        trades: get().trades,
        cashMoves: get().cashMoves,
        spots: get().spots,
        transfers: get().transfers,
      });
      if (from === to || !fitsAmount(amount, transferable(books, from))) return false;
      const row = normalizeTransfer({
        id: newId(),
        date,
        from,
        to,
        amount: round2(amount),
        note: note.trim(),
        status: "done",
      });
      if (!row) return false;
      set({ transfers: [...get().transfers, row] });
      void persist().catch(() => {});
      return true;
    },
    allocate: (book, target) => {
      const read = (transfers: Transfer[]) =>
        computeBooks({
          startingEquity: get().startingEquity,
          trades: get().trades,
          cashMoves: get().cashMoves,
          spots: get().spots,
          transfers,
        });
      const books = read(get().transfers);
      const current =
        book === "journal" ? books.journal : book === "forex" ? books.forex : books.portfolioCash;
      const extra = Math.max(0, books.free);
      const min = book === "journal" ? books.openRisk : book === "forex" ? books.forexOpenRisk : 0;
      const max = round2(Math.max(current, 0) + extra);
      const goal = round2(target);
      if (goal < min - 0.001 || goal > max + 0.001) return false;
      let delta = round2(goal - current);
      if (Math.abs(delta) < 0.009) return true;
      const today = new Date().toISOString().slice(0, 10);
      const rows = [...get().transfers];
      const pull = (from: BookId, to: BookId, amount: number) => {
        const row = normalizeTransfer({
          id: newId(),
          date: today,
          from,
          to,
          amount,
          note: "",
          status: "done",
        });
        if (row) rows.push(row);
      };
      if (delta > 0) {
        const can = round2(transferable(read(rows), "free"));
        const take = round2(Math.min(delta, Math.max(0, can)));
        if (take > 0) pull("free", book, take);
        if (round2(delta - take) > 0.02) return false;
      } else {
        pull(book, "free", round2(-delta));
      }
      const check = read(rows);
      if (check.free < -0.009 || check.portfolioCash < -0.009) return false;
      if (check.journal + 0.009 < check.openRisk) return false;
      if (check.forex + 0.009 < check.forexOpenRisk) return false;
      set({ transfers: rows });
      void persist().catch(() => {});
      return true;
    },
    deleteTransfer: (id) => {
      const next = get().transfers.filter((t) => t.id !== id);
      if (next.length === get().transfers.length) return false;
      const books = computeBooks({
        startingEquity: get().startingEquity,
        trades: get().trades,
        cashMoves: get().cashMoves,
        spots: get().spots,
        transfers: next,
      });
      if (books.free < -0.009 || books.portfolioCash < -0.009) return false;
      if (books.journal + 0.009 < books.openRisk) return false;
      if (books.forex + 0.009 < books.forexOpenRisk) return false;
      set({ transfers: next });
      void persist().catch(() => {});
      return true;
    },
    replaceJournal: async (payload) => {
      const next = cleanPayload({
        startingEquity: payload.startingEquity,
        trades: payload.trades.map(normalizeTrade),
        cashMoves: payload.cashMoves ?? [],
        spots: payload.spots ?? get().spots,
        transfers: payload.transfers ?? get().transfers,
      });
      set({
        startingEquity: next.startingEquity,
        trades: next.trades,
        cashMoves: next.cashMoves,
        spots: next.spots ?? [],
        transfers: next.transfers ?? [],
        hydrated: true,
        hydrating: false,
        persistError: null,
      });
      await persist();
    },
    hydrate: async () => {
      if (get().hydrated || get().hydrating) return;
      set({ hydrating: true });
      const apply = (raw: JournalPayload | null, persistRemote: boolean) => {
        if (get().hydrated) return;
        const next = cleanPayload(raw);
        set({
          startingEquity: next.startingEquity,
          trades: next.trades,
          cashMoves: next.cashMoves,
          spots: next.spots ?? [],
          transfers: next.transfers ?? [],
          hydrated: true,
          hydrating: false,
        });
        writeLocalCache(next);
        if (persistRemote) void saveJournal({ data: next }).catch(() => {});
      };
      try {
        const remote = await withTimeout(loadJournal(), HYDRATE_MS);
        if (get().hydrated) return;
        if (remote) {
          apply(remote, false);
          return;
        }
        apply(readLocalCache(), true);
      } catch {
        if (get().hydrated) return;
        apply(readLocalCache(), false);
      } finally {
        if (!get().hydrated) apply(readLocalCache(), false);
        else if (get().hydrating) set({ hydrating: false });
      }
    },
  };
});
