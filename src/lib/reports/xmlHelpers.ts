import { saveAs } from "file-saver";

/** Escape XML special characters */
export function escXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Wrap a value in XML tags. Returns empty string if value is null/undefined. */
export function xmlTag(name: string, value: string | number | null | undefined, attrs?: Record<string, string>): string {
  if (value === null || value === undefined) return "";
  const attrStr = attrs
    ? " " + Object.entries(attrs).map(([k, v]) => `${k}="${escXml(v)}"`).join(" ")
    : "";
  const escaped = typeof value === "number" ? String(value) : escXml(value);
  return `<${name}${attrStr}>${escaped}</${name}>`;
}

/** Standard XML declaration */
export function xmlDeclaration(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>`;
}

/** Round to whole euro (Revenue uses integers for most monetary fields) */
export function wholeEuro(n: number): number {
  return Math.round(n);
}

/** Format to cent precision (RCT uses cent precision) */
export function centEuro(n: number): string {
  return n.toFixed(2);
}

/** Convert ISO date string to DD/MM/YYYY for Revenue */
export function fmtRevDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Trigger browser download of an XML string */
export function saveXml(xml: string, filename: string): void {
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  saveAs(blob, filename);
}
