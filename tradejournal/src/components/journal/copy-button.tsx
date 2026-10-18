import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { plainNum } from "@/lib/journal/format";

export async function copyValue(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyButton({
  value,
  label,
}: {
  value: number | string | null | undefined;
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  if (value == null || value === "") return null;
  const text = typeof value === "number" ? plainNum(value) : value;
  if (!text) return null;

  return (
    <button
      type="button"
      aria-label={`Скопировать ${label}`}
      title={copied ? "Скопировано" : `Скопировать ${label}`}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[color,background-color] duration-150 hover:bg-muted hover:text-foreground"
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await copyValue(text);
        if (!ok) return;
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
    >
      {copied ? <Check className="size-3.5 text-long" /> : <Copy className="size-3.5" />}
    </button>
  );
}
