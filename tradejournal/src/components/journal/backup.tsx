import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { backupFilename, journalToTxt, txtToJournal } from "@/lib/journal/txt";
import { useJournal } from "@/lib/journal/store";

const row =
  "flex h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted disabled:cursor-wait disabled:opacity-50";

export function JournalBackup() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ReturnType<typeof txtToJournal> | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const replaceJournal = useJournal((s) => s.replaceJournal);
  const startingEquity = useJournal((s) => s.startingEquity);
  const trades = useJournal((s) => s.trades);
  const cashMoves = useJournal((s) => s.cashMoves);
  const spots = useJournal((s) => s.spots);
  const transfers = useJournal((s) => s.transfers);
  const hydrated = useJournal((s) => s.hydrated);

  function exportTxt() {
    const text = journalToTxt({ startingEquity, trades, cashMoves, spots, transfers });
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const parsed = txtToJournal(text);
        setPending(parsed);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Не получилось прочитать файл. Нужен TXT журнала.",
        );
      }
    };
    reader.readAsText(file, "utf-8");
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.json,text/plain,application/json"
        className="sr-only"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        data-menu-close
        onClick={exportTxt}
        disabled={!hydrated}
        className={row}
      >
        <Download className="size-4" />
        Выгрузить
      </button>
      <button type="button" data-menu-close onClick={() => fileRef.current?.click()} className={row}>
        <Upload className="size-4" />
        Загрузить
      </button>

      <Dialog open={Boolean(error)} onOpenChange={(v) => !v && setError(null)}>
        <DialogContent>
          <DialogTitle>Файл не принят</DialogTitle>
          <DialogDescription>{error}</DialogDescription>
          <Button className="mt-4" variant="outline" onClick={() => setError(null)}>
            Понятно
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pending)}
        onOpenChange={(v) => {
          if (!v && !saving) setPending(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Загрузить журнал?</DialogTitle>
          <DialogDescription>
            Текущие сделки заменятся данными из файла
            {pending
              ? ` (${pending.trades.length} сделок, ${pending.cashMoves.length} записей кассы).`
              : "."}
          </DialogDescription>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setPending(null)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => {
                if (!pending) return;
                setSaving(true);
                void replaceJournal(pending)
                  .then(() => setPending(null))
                  .catch(() => {
                    setPending(null);
                    setError(
                      "Сделки открылись на этом устройстве, но сервер их не сохранил. Проверь таблицу journal_state в Supabase (Table Editor) и сделай Redeploy на Vercel.",
                    );
                  })
                  .finally(() => setSaving(false));
              }}
            >
              {saving ? "Сохраняем…" : "Заменить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
