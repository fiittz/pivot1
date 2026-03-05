import { saveAs } from "file-saver";
export { wholeEuro, centEuro, fmtRevDate } from "../calc";

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

/** Generate a self-closing XML element with attributes. Omits null/undefined values. */
export function xmlEl(name: string, attrs: Record<string, string | number | boolean | null | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    parts.push(`${k}="${escXml(String(v))}"`);
  }
  return parts.length ? `<${name} ${parts.join(" ")}/>` : "";
}

/** Trigger browser download of an XML string */
export function saveXml(xml: string, filename: string): void {
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  saveAs(blob, filename);
}
