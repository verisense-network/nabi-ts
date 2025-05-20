import type { AbiEntry } from "./types";

export async function parseJsonFile(filePath: string): Promise<AbiEntry[]> {
  const entries: AbiEntry[] = [];

  try {
    const file = Bun.file(filePath);
    const content = await file.text();

    try {
      const parsedJson = JSON.parse(content);

      if (Array.isArray(parsedJson)) {
        entries.push(...(parsedJson as AbiEntry[]));
      } else if (typeof parsedJson === "object" && parsedJson !== null) {
        entries.push(parsedJson as AbiEntry);
      } else {
        throw new Error("JSON file content is not valid");
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse JSON file: ${errorMessage}`);
    }

    console.log(`Successfully parsed ${entries.length} JSON entries`);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      !error.message.includes("Failed to parse ABI entry")
    ) {
      throw new Error(`Failed to read ABI file: ${error.message}`);
    }
    throw error;
  }

  return entries;
}
