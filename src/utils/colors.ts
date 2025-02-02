export function hexToRgba(hex: string, alpha: number) {
  if (!/^#?[0-9A-Fa-f]{6}$/.test(hex)) {
      throw new Error("Invalid HEX format. Use #RRGGBB or RRGGBB.");
  }

  hex = hex.replace(/^#/, "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


export function rgbaToHex(rgbaStr: string): string {
  // Example format: "rgba(123, 45, 67, 0.8)" or "rgb(123, 45, 67)"
  const regex = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\)$/;
  const match = regex.exec(rgbaStr.trim());

  if (!match) {
    throw new Error(`Invalid RGBA string: ${rgbaStr}`);
  }

  const [, r, g, b, a] = match; // note that a might be undefined if it's just "rgb(...)"

  // clamp 0..255 for r/g/b
  const red = Math.min(255, parseInt(r, 10));
  const green = Math.min(255, parseInt(g, 10));
  const blue = Math.min(255, parseInt(b, 10));
  
  // Convert to hex parts (#RRGGBB)
  const rr = red.toString(16).padStart(2, "0");
  const gg = green.toString(16).padStart(2, "0");
  const bb = blue.toString(16).padStart(2, "0");

  // If alpha is present, convert it to [0..255] then to hex
  if (a !== undefined) {
    const alphaFloat = Math.max(0, Math.min(1, parseFloat(a)));
    const alphaHex = Math.round(alphaFloat * 255).toString(16).padStart(2, "0");
    return `#${rr}${gg}${bb}${alphaHex}`.toUpperCase();
  }

  return `#${rr}${gg}${bb}`.toUpperCase();
}

/**
 * Convert an RGB string (e.g., "rgb(255, 255, 255)")
 * into a hex string (#RRGGBB).
 * 
 * Ex: rgbToHex("rgb(255, 255, 0)") => "#FFFF00"
 */
export function rgbToHex(rgbStr: string): string {
  // Matches: "rgb(123, 45, 67)" with optional spaces
  const regex = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;
  const match = regex.exec(rgbStr.trim());

  if (!match) {
    throw new Error(`Invalid RGB string: ${rgbStr}`);
  }

  const [, rs, gs, bs] = match;
  const r = Math.min(255, parseInt(rs, 10));
  const g = Math.min(255, parseInt(gs, 10));
  const b = Math.min(255, parseInt(bs, 10));

  const rr = r.toString(16).padStart(2, "0");
  const gg = g.toString(16).padStart(2, "0");
  const bb = b.toString(16).padStart(2, "0");

  return `#${rr}${gg}${bb}`.toUpperCase();
}