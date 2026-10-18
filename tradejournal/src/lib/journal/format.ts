const money = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const money0 = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const priceFmt = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 10,
  useGrouping: false,
});

export function parseNum(v: string) {
  const n = Number(String(v).trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function fmtMoney(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${money.format(n)} $`;
}

export function fmtMoneySigned(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = money.format(Math.abs(n));
  if (n > 0) return `+${abs} $`;
  if (n < 0) return `−${abs} $`;
  return `${abs} $`;
}

export function fmtPct(n: number | null | undefined, digits = 2) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function fmtR(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  const body = Math.abs(n).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (n > 0) return `+${body}R`;
  if (n < 0) return `−${body}R`;
  return `${body}R`;
}

export function fmtDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!d) return iso;
  return `${d}.${m}.${y}`;
}

export function todayIso() {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function fmtCompact(n: number) {
  return money0.format(n);
}

export function fmtPrice(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return trimDecimalsRu(n);
}

export function fmtVolume(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return trimDecimalsRu(n, 8);
}

export function plainNum(n: number) {
  if (!Number.isFinite(n)) return "";
  if (Number.isInteger(n)) return String(n);
  return trimDecimalsDot(n, 10);
}

function trimDecimalsDot(n: number, max = 8) {
  const s = n.toFixed(max);
  return s.replace(/\.?0+$/, "");
}

function trimDecimalsRu(n: number, max = 8) {
  return priceFmt.format(Number(trimDecimalsDot(n, max)));
}
