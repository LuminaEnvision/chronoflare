import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";

// A regression heuristic, not general-purpose language detection. André's
// explicitly localized handoff documents are the only documentation exception.
const portugueseTerms = [
  "calendário",
  "metodologia",
  "validação",
  "cobertura",
  "proveniência",
  "incêndio",
  "incêndios",
  "dados",
  "carregando",
  "observações",
  "não",
  "simulado",
  "simulada",
  "sintético",
  "sintética",
  "estimativa",
  "estimativas",
  "extrapolação",
  "período",
  "períodos",
  "limiares",
  "referência",
  "falha",
  "registro",
  "registros",
  "aprovada",
  "aprovado",
  "detecções",
  "harmonização",
  "aguardando",
  "entrega",
  "pesquisa",
  "região",
  "início",
  "escolher",
  "análise",
  "necessário",
  "responsável",
  "arquivos",
  "mensagem",
  "verificação",
];
const pattern = new RegExp(
  `(?<![\\p{L}\\p{N}_])(?:${portugueseTerms.join("|")})(?![\\p{L}\\p{N}_])`,
  "giu",
);
const extensions = new Set([
  ".ts",
  ".tsx",
  ".md",
  ".html",
  ".json",
  ".yml",
  ".yaml",
  ".py",
  ".css",
  ".sh",
  ".txt",
]);
const files = [
  ...new Set(
    execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean),
  ),
];
const failures: string[] = [];
let checked = 0;
for (const file of files) {
  // The checker itself necessarily contains the detection vocabulary.
  if (file === "scripts/check-language.ts" || file.startsWith("docs/handoff/"))
    continue;
  if (!extensions.has(extname(file)) || !existsSync(file)) continue;
  checked++;
  const content = readFileSync(file, "utf8");
  for (const [index, line] of content.split("\n").entries()) {
    pattern.lastIndex = 0;
    const matches = [...line.matchAll(pattern)];
    if (matches.length)
      failures.push(
        `${file}:${index + 1}: ${[...new Set(matches.map((m) => m[0]))].join(", ")}`,
      );
  }
  if (/\b(?:pt-BR|pt-PT)\b/.test(content))
    failures.push(
      `${file}: Portuguese locale found; use the English project locale.`,
    );
}
if (failures.length) {
  console.error(
    "English working-language check failed:\n" + failures.join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(
    `English working-language check passed (${checked} text files; André handoff translations excluded).`,
  );
}
