import type { Class } from "~/Types/Class";

/**
 * Extracts r/g/b from an 'rgba(...)' or 'rgb(...)' string, ignoring alpha,
 * then converts to '#RRGGBB' format. Finally, searches for a matching class color.
 */
export function getClassFromColor(classes: Class[], rgbaColor: string): Class | undefined {
  // e.g., rgba(123, 45, 67, 0.35) or rgb(123, 45, 67)
  const match = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\)$/.exec(rgbaColor.trim());
  if (!match) {
    return undefined; // Not a recognized format
  }

  const [/* entire */, rs, gs, bs] = match;
  const r = Math.min(255, parseInt(rs, 10));
  const g = Math.min(255, parseInt(gs, 10));
  const b = Math.min(255, parseInt(bs, 10));

  // Convert to hex (#RRGGBB)
  const hexColor = `#${r.toString(16).padStart(2, "0")}${
    g.toString(16).padStart(2, "0")
  }${b.toString(16).padStart(2, "0")}`.toUpperCase();

  // Return the matching class if one is found
  return classes.find((cls) => cls.color.toUpperCase() === hexColor);
} 