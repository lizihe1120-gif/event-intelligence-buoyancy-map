// @ts-nocheck -- Bundled by Vite for Node; the application tsconfig intentionally has no Node globals.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import analysisData from "../../../../data/demo/analysis.json";
import companiesData from "../../../../data/demo/companies.json";
import eventsData from "../../../../data/demo/events.json";
import marketData from "../../../../data/demo/market-reactions.json";
import sourcesData from "../../../../data/demo/sources.json";
import toolCallsData from "../../../../data/demo/tool-calls.json";
import { generateDemoRun } from "./generateDemoRun";

const outputDirectory = resolve(process.cwd(), "../../data/demo-runs/material-analysis-001");
await mkdir(outputDirectory, { recursive: true });
const artifacts = await generateDemoRun({ companiesData, eventsData, sourcesData, analysisData, marketData, toolCallsData });
await Promise.all(Object.entries(artifacts).map(([name, value]) =>
  writeFile(resolve(outputDirectory, name), `${JSON.stringify(value, null, 2)}\n`, "utf8")
));
process.stdout.write(`Generated ${Object.keys(artifacts).length} artifacts in ${outputDirectory}\n`);
