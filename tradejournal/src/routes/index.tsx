import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Banknote, Plus, X } from "lucide-react";
import { CashForm } from "@/components/journal/cash-form";
import { CashTable } from "@/components/journal/cash-table";
import { CloseTradeForm } from "@/components/journal/close-trade-form";
import { EquityChart } from "@/components/journal/equity-chart";
import { JournalBackup } from "@/components/journal/backup";
import { MonthPnl } from "@/components/journal/month-pnl";
import { OpenTradeForm } from "@/components/journal/open-trade-form";
import { OpenTrades } from "@/components/journal/open-trades";
import { Overview } from "@/components/journal/overview";
import { PortfolioView } from "@/components/journal/portfolio-view";
import { StatsBar } from "@/components/journal/stats-bar";
import { TradeInfoCard } from "@/components/journal/trade-info";
import { TradeTable } from "@/components/journal/trade-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { computeJournal } from "@/lib/journal/engine";
import { journalCashMoves, forexTransferMoves } from "@/lib/journal/books";
import { useJournal } from "@/lib/journal/store";
import type { ComputedRow } from "@/lib/journal/types";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <JournalSkeleton />;
  if (!user) return <RedirectToSignIn />;
  return <JournalApp />;
}

function JournalSkeleton() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 h-16 max-w-md animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-card" />
        ))}
      </div>
      <div className="mt-4 h-56 animate-pulse rounded-xl bg-card" />
    </main>
  );
}

function navClass(active: boolean) {
  return active
    ? "bg-primary text-primary-foreground"
    : "text-muted-foreground hover:bg-muted hover:text-foreground";
}

const SECTIONS = [
  { id: "overview", label: "Общее" },
  { id: "journal", label: "Журнал крипто" },
  { id: "forex", label: "Журнал форекс" },
  { id: "portfolio", label: "Портфель" },
  { id: "copy", label: "Копитрейдинг" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function EmptySection({ title }: { title: string }) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-card px-5 py-16 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Пока пусто. Журнал крипто сюда не попадает.</p>
    </section>
  );
}

function JournalApp() {
  const startingEquity = useJournal((s) => s.startingEquity);
  const trades = useJournal((s) => s.trades);
  const cashMoves = useJournal((s) => s.cashMoves);
  const spots = useJournal((s) => s.spots);
  const transfers = useJournal((s) => s.transfers);
  const hydrate = useJournal((s) => s.hydrate);
  const hydrated = useJournal((s) => s.hydrated);
  const persistError = useJournal((s) => s.persistError);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const cryptoTrades = useMemo(
    () => trades.filter((t) => t.market !== "forex"),
    [trades],
  );
  const forexTrades = useMemo(
    () => trades.filter((t) => t.market === "forex"),
    [trades],
  );
  const journalCash = useMemo(
    () => journalCashMoves(cashMoves, spots, transfers),
    [cashMoves, spots, transfers],
  );
  const forexCash = useMemo(() => forexTransferMoves(transfers), [transfers]);
  const stats = useMemo(
    () => computeJournal(startingEquity, cryptoTrades, journalCash),
    [startingEquity, cryptoTrades, journalCash],
  );
  const forexStats = useMemo(
    () => computeJournal(0, forexTrades, forexCash),
    [forexTrades, forexCash],
  );
  const [composing, setComposing] = useState(false);
  const [cashForm, setCashForm] = useState(false);
  const [managing, setManaging] = useState<ComputedRow | null>(null);
  const [info, setInfo] = useState<ComputedRow | null>(null);
  const [tab, setTab] = useState("all");
  const [mode, setMode] = useState<SectionId>("overview");
  const [buying, setBuying] = useState(false);

  const activeStats = mode === "forex" ? forexStats : stats;
  const activeCash = mode === "forex" ? forexCash : journalCash;
  const visible =
    tab === "open"
      ? activeStats.rows.filter((r) => r.status === "open")
      : tab === "closed"
        ? activeStats.rows.filter((r) => r.status === "closed")
        : activeStats.rows;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-center gap-3">
        <nav
          className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Разделы"
        >
          <div className="flex w-max gap-1 rounded-xl border border-border bg-card p-1">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  setMode(section.id);
                  setComposing(false);
                  setCashForm(false);
                  if (section.id !== "portfolio") setBuying(false);
                }}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${navClass(mode === section.id)}`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          {mode === "journal" || mode === "forex" ? (
            <Button
              variant={composing ? "outline" : "default"}
              onClick={() => setComposing((v) => !v)}
            >
              {composing ? <X className="size-4" /> : <Plus className="size-4" />}
              {composing ? "Отмена" : "Открыть сделку"}
            </Button>
          ) : null}
          {mode === "portfolio" ? (
            <Button
              variant={buying ? "outline" : "default"}
              onClick={() => setBuying((v) => !v)}
            >
              {buying ? <X className="size-4" /> : <Plus className="size-4" />}
              {buying ? "Отмена" : "Купить"}
            </Button>
          ) : null}
          <UserButton
            menu={
              <>
                <JournalBackup />
                <button
                  type="button"
                  data-menu-close
                  onClick={() => setCashForm(true)}
                  className="flex h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted"
                >
                  <Banknote className="size-4" />
                  Касса
                </button>
              </>
            }
          />
        </div>
      </header>

      {!hydrated ? (
        <JournalSkeleton />
      ) : (
        <>
          {persistError ? (
            <p className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {persistError}
            </p>
          ) : null}
          {mode === "overview" ? (
            <Overview />
          ) : mode === "portfolio" ? (
            <PortfolioView buying={buying} onDone={() => setBuying(false)} />
          ) : mode === "journal" || mode === "forex" ? (
          <>
          <div className="relative overflow-hidden">
            <div
              className={
                composing
                  ? "pointer-events-none absolute inset-x-0 top-0 -translate-y-2 opacity-0 transition-[opacity,transform] duration-200 ease-out"
                  : "translate-y-0 opacity-100 transition-[opacity,transform] duration-200 ease-out"
              }
              aria-hidden={composing}
              inert={composing || undefined}
            >
              <MonthPnl rows={activeStats.rows} />
              <div className="mt-3">
                <StatsBar
                  stats={activeStats}
                  depositHint={mode === "forex" ? "счёт форекса" : "счёт журнала"}
                />
              </div>
              <div className="mt-4">
                <EquityChart
                  startingEquity={activeStats.startingEquity}
                  rows={activeStats.rows}
                  cashMoves={activeCash}
                />
              </div>
            </div>
            <div
              className={
                composing
                  ? "relative translate-y-0 opacity-100 transition-[opacity,transform] duration-200 ease-out"
                  : "pointer-events-none absolute inset-x-0 top-0 translate-y-2 opacity-0 transition-[opacity,transform] duration-200 ease-out"
              }
              aria-hidden={!composing}
              inert={!composing || undefined}
            >
              <OpenTradeForm
                active={composing}
                available={activeStats.available}
                market={mode === "forex" ? "forex" : "crypto"}
                onDone={() => setComposing(false)}
              />
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="mt-5">
            <TabsList className="flex h-auto min-h-10 w-full flex-wrap">
              <TabsTrigger value="all">Все ({activeStats.tradeCount})</TabsTrigger>
              <TabsTrigger value="open">Открытые ({activeStats.openCount})</TabsTrigger>
              <TabsTrigger value="closed">
                Закрытые ({activeStats.tradeCount - activeStats.openCount})
              </TabsTrigger>
              <TabsTrigger value="cash">Касса ({activeCash.length})</TabsTrigger>
            </TabsList>
            {tab === "cash" ? (
              <TabsContent value="cash">
                <CashTable book={mode === "forex" ? "forex" : "journal"} />
              </TabsContent>
            ) : tab === "open" ? (
              <TabsContent value="open">
                <OpenTrades rows={visible} onManage={setManaging} onInfo={setInfo} />
              </TabsContent>
            ) : (
              <TabsContent value={tab}>
                <TradeTable
                  rows={visible}
                  onManage={setManaging}
                  dateMode={tab === "closed" ? "close" : "open"}
                />
              </TabsContent>
            )}
          </Tabs>
          </>
          ) : (
            <EmptySection title="Копитрейдинг" />
          )}
        </>
      )}

      <CashForm open={cashForm} onOpenChange={setCashForm} />
      <CloseTradeForm trade={managing} onClose={() => setManaging(null)} />
      <TradeInfoCard trade={info} onClose={() => setInfo(null)} />
    </main>
  );
}
