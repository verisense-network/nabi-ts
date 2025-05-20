import { parseJsonFile } from "./parser";
import { generateCode } from "./generator";
import { basename, extname, join } from "path";
import { Command } from "commander";

import packageJson from "../package.json";

async function execute(jsonFilePath: string, outputDir: string, options: any) {
  const startTime = performance.now();

  try {
    if (outputDir) {
      try {
        await Bun.write(Bun.file(`${outputDir}/.placeholder`), "");
      } catch (e) {
        const proc = Bun.spawn(["mkdir", "-p", outputDir]);
        await proc.exited;

        if (proc.exitCode !== 0) {
          throw new Error(`Failed to create directory: ${outputDir}`);
        }
      }
    }

    if (!jsonFilePath) {
      throw new Error("JSON file path is required");
    }

    const jsonFile = Bun.file(jsonFilePath);
    if (!(await jsonFile.exists())) {
      throw new Error(`JSON file does not exist: ${jsonFilePath}`);
    }

    const abiEntries = await parseJsonFile(jsonFilePath);

    const tsCode = await generateCode(abiEntries);

    const versionedCode =
      tsCode + "\n// Generated Version: " + Date.now() + "\n";

    const fileBasename = basename(jsonFilePath, extname(jsonFilePath));
    const tsFilePath = join(outputDir, `${fileBasename}.ts`);
    await Bun.write(Bun.file(tsFilePath), versionedCode);
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`Successfully generated TypeScript file at ${outputDir}`);
    console.log(`- TypeScript file: ${tsFilePath}`);
    console.log(`Processing completed, took ${duration} seconds`);

    return 0;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("error:", errorMessage);
    return 1;
  }
}

async function main() {
  const program = new Command();

  program
    .name("nabi-ts")
    .description("from JSON ABI definition generate TypeScript code")
    .version(packageJson.version);

  program
    .argument("<json-file>", "input JSON ABI file path")
    .argument("[output-dir]", "output directory path", "./output")
    .action(async (jsonFilePath, outputDir, options) => {
      const exitCode = await execute(jsonFilePath, outputDir, options);
      process.exit(exitCode);
    });

  await program.parseAsync();
}

main().catch((error) => {
  console.error("runtime error:", error);
  process.exit(1);
});
