import type { AbiEntry } from "./types";

export async function parseJsonFile(filePath: string, jsonContent?: string): Promise<AbiEntry[]> {
  const entries: AbiEntry[] = [];

  try {
    let content: string;
    
    if (jsonContent) {
      // 使用直接提供的JSON内容
      content = jsonContent;
    } else if (filePath) {
      // 从文件读取JSON内容
      const file = Bun.file(filePath);
      content = await file.text();
    } else {
      throw new Error("Either file path or JSON content must be provided");
    }

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
