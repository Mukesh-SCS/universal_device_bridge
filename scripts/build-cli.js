import esbuild from "esbuild";
import fs from "node:fs";

if (!fs.existsSync("dist")) {
  fs.mkdirSync("dist");
}

await esbuild.build({
  entryPoints: ["cli/src/udb.js"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  outfile: "dist/cli-bundle.cjs",
  sourcemap: false,
});

console.log("CLI bundled to dist/cli-bundle.cjs");
