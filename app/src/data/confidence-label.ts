/** Explain source codes without changing any observation or quality decision. */
export function confidenceLabel(raw: string | number) {
  const text = String(raw).trim();
  const classes: Record<string, string> = {
    l: "Low",
    low: "Low",
    n: "Nominal",
    nominal: "Nominal",
    h: "High",
    high: "High",
  };
  const named = classes[text.toLowerCase()];
  if (named) return `${named} (${text})`;
  if (
    text !== "" &&
    Number.isFinite(Number(text)) &&
    Number(text) >= 0 &&
    Number(text) <= 100
  ) {
    const value = Number(text);
    return `${value < 30 ? "Low" : value < 80 ? "Nominal" : "High"} (${text}/100)`;
  }
  return text ? `Unrecognized (${text})` : "Not supplied";
}
