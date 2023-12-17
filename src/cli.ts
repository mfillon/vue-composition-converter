import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { convertSrc } from "./lib/converter";
import fs from "fs";
import hljs from "highlight.js/lib/core";
import prettier from "prettier";
import parserTypeScript from "prettier/parser-typescript";

const argv = yargs(hideBin(process.argv)).alias("p", "path")
  .argv as unknown as {
  path: string;
};

const input = fs.readFileSync(argv.path, { encoding: "utf8", flag: "r" });
const res = hljs.highlightAuto(
  prettier.format(convertSrc(input), {
    parser: "typescript",
    plugins: [parserTypeScript],
  })
).value;

fs.writeFileSync(argv.path, res);
