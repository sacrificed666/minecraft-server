// The server list renders § codes; showing the raw string would be showing the
// markup instead of the thing the card promises.

const COLOUR: Record<string, string> = {
  "0": "#000000", "1": "#0000aa", "2": "#00aa00", "3": "#00aaaa",
  "4": "#aa0000", "5": "#aa00aa", "6": "#ffaa00", "7": "#aaaaaa",
  "8": "#555555", "9": "#5555ff", a: "#55ff55", b: "#55ffff",
  c: "#ff5555", d: "#ff55ff", e: "#ffff55", f: "#ffffff",
};

type Style = { color: string; bold: boolean; italic: boolean; underline: boolean; strike: boolean };
const PLAIN: Style = { color: COLOUR.f, bold: false, italic: false, underline: false, strike: false };

function apply(style: Style, code: string): Style {
  if (COLOUR[code]) return { ...PLAIN, color: COLOUR[code] };
  if (code === "l") return { ...style, bold: true };
  if (code === "o") return { ...style, italic: true };
  if (code === "n") return { ...style, underline: true };
  if (code === "m") return { ...style, strike: true };
  return PLAIN; // r, and anything unknown
}

function parse(line: string): { text: string; style: Style }[] {
  const runs: { text: string; style: Style }[] = [];
  let style = PLAIN;
  let text = "";
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "§" && i + 1 < line.length) {
      if (text) runs.push({ text, style });
      style = apply(style, line[++i].toLowerCase());
      text = "";
    } else {
      text += line[i];
    }
  }
  if (text) runs.push({ text, style });
  return runs;
}

export function Motd({ value }: { value: string }) {
  // server.properties stores the break as the two characters \ and n
  const lines = value.split("\\n");
  return (
    <div className="rounded-xl bg-[#1a1a1a] px-4 py-3 font-mono text-sm leading-relaxed">
      {lines.map((line, i) => (
        <div key={i} className="wrap-break-word">
          {parse(line).map((run, j) => (
            <span
              key={j}
              style={{
                color: run.style.color,
                fontWeight: run.style.bold ? 700 : 400,
                fontStyle: run.style.italic ? "italic" : "normal",
                textDecoration:
                  [run.style.underline && "underline", run.style.strike && "line-through"]
                    .filter(Boolean)
                    .join(" ") || "none",
              }}
            >
              {run.text}
            </span>
          ))}
          {!line && " "}
        </div>
      ))}
    </div>
  );
}
