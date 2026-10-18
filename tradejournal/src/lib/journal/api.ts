import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { normalizeTrade } from "./seed";
import { normalizeFill } from "./portfolio";
import { normalizeTransfer } from "./books";
import type { CashMove, JournalPayload, SpotFill, Trade, Transfer } from "./types";

type JournalRow = {
  starting_equity: string | number;
  trades: Trade[] | string;
  cash_moves: CashMove[] | string;
  spots?: SpotFill[] | string | null;
  transfers?: Transfer[] | string | null;
};

function parseJson<T>(value: T[] | string | null | undefined): T[] {
  if (value == null) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as T[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

function cleanTransfers(raw: Transfer[]): Transfer[] {
  const out: Transfer[] = [];
  for (const row of raw) {
    const next = normalizeTransfer(row);
    if (next?.id) out.push(next);
  }
  return out;
}

function toPayload(row: JournalRow): JournalPayload {
  return {
    startingEquity: Number(row.starting_equity) || 0,
    trades: parseJson<Trade>(row.trades).map(normalizeTrade),
    cashMoves: parseJson<CashMove>(row.cash_moves),
    spots: parseJson<SpotFill>(row.spots).map(normalizeFill).filter((f): f is SpotFill => f != null),
    transfers: cleanTransfers(parseJson<Transfer>(row.transfers)),
  };
}

async function ensureJournalTable(sql: {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
}) {
  await sql.query(`
    create table if not exists journal_state (
      user_id          text primary key,
      starting_equity  numeric not null default 4000,
      trades           jsonb not null default '[]'::jsonb,
      cash_moves       jsonb not null default '[]'::jsonb,
      updated_at       timestamptz not null default now()
    )
  `);
  await sql.query(
    `alter table journal_state add column if not exists spots jsonb not null default '[]'::jsonb`,
  );
  await sql.query(
    `alter table journal_state add column if not exists transfers jsonb not null default '[]'::jsonb`,
  );
}

export const loadJournal = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await ensureJournalTable(sql);
    const rows = await sql.query<JournalRow>(
      "select starting_equity, trades, cash_moves, spots, transfers from journal_state where user_id = $1",
      [context.userId],
    );
    const row = rows[0];
    if (!row) return null;
    return toPayload(row);
  });

export const saveJournal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: JournalPayload) => ({
    startingEquity: Number(data.startingEquity) || 0,
    trades: (data.trades ?? []).map(normalizeTrade),
    cashMoves: data.cashMoves ?? [],
    spots: (data.spots ?? []).map(normalizeFill).filter((f): f is SpotFill => f != null),
    transfers: cleanTransfers(data.transfers ?? []),
  }))
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await ensureJournalTable(sql);
    await sql.query(
      `insert into journal_state (user_id, starting_equity, trades, cash_moves, spots, transfers, updated_at)
       values ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, now())
       on conflict (user_id) do update set
         starting_equity = excluded.starting_equity,
         trades = excluded.trades,
         cash_moves = excluded.cash_moves,
         spots = excluded.spots,
         transfers = excluded.transfers,
         updated_at = now()`,
      [
        context.userId,
        data.startingEquity,
        JSON.stringify(data.trades),
        JSON.stringify(data.cashMoves),
        JSON.stringify(data.spots ?? []),
        JSON.stringify(data.transfers ?? []),
      ],
    );
    return { ok: true as const };
  });
