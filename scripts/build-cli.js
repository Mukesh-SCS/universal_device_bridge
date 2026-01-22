import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const outDir = "cli";
const outFile = path.join(outDir, "cli-bundle.cjs");

await esbuild.build({
  entryPoints: ["cli/src/udb.js"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  outfile: outFile,
});

console.log("CLI bundled to cli/cli-bundle.cjs");
