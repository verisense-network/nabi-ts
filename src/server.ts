import { join } from "path";
import { parseJsonFile } from "./parser";
import { generateCode } from "./generator";
import { spawn } from "child_process";

export async function startApiServer(port: string | number) {
  const PORT = Number(port);

  const server = Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/api/convert" && req.method === "POST") {
        try {
          const body = (await req.json()) as { json?: string };
          const json = body.json;

          if (!json) {
            return new Response(
              JSON.stringify({ error: "JSON data is required" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          const abiEntries = await parseJsonFile("", json);
          const tsCode = await generateCode(abiEntries);

          return new Response(
            JSON.stringify({
              success: true,
              code: tsCode,
            }),
            {
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          return new Response(
            JSON.stringify({
              error: errorMessage,
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  console.info(`API Server running at http://localhost:${PORT}`);

  return server;
}

export async function startViteServer(port: string | number) {
  const PORT = Number(port);
  const projectRoot = join(import.meta.dir, "..");

  console.info(`Starting Vite development server on port ${PORT}...`);

  const viteProcess = spawn("npx", ["vite", "--port", PORT.toString()], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: true,
  });

  viteProcess.on("error", (error) => {
    console.error(`Failed to start Vite server: ${error.message}`);
  });

  console.info(`Vite server should be running at http://localhost:${PORT}`);

  return viteProcess;
}

export async function startServer(port: string | number) {
  const vitePort = Number(port);
  const apiPort = vitePort + 1;

  const apiServer = await startApiServer(apiPort);
  const viteServer = await startViteServer(vitePort);

  console.info(`Vue UI is available at http://localhost:${vitePort}`);
  console.info(`API Server is running at http://localhost:${apiPort}`);

  return {
    apiServer,
    viteServer,
    port: vitePort,
  };
}
