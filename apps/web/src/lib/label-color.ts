/**
 * Picks a legible text color (black or white) to sit on top of a solid
 * hex background — used for label chips, which are filled with the
 * user-chosen label color.
 *
 * Accepts "#rgb" or "#rrggbb" (with or without the leading "#"); falls
 * back to white text for anything it can't parse.
 */
export function readableTextColor(hexColor: string): "#000000" | "#ffffff" {
  const hex = hexColor.replace("#", "").trim();
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return "#ffffff";
  }

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  // Perceived brightness (sRGB luma). Above ~0.6 the color is light
  // enough that black text reads better than white.
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.6 ? "#000000" : "#ffffff";
}
