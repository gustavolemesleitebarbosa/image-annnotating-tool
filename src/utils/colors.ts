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


export function getAlpha(rgba: string): number | null {
  const match = /rgba?\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/.exec(rgba);
  if (match) {
    // @ts-expect-errorts-ignore this line
    return parseFloat(match[1]); // Convert to float
  }
  return null; // Return null if there's no match
}
