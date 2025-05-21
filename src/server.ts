import { join } from "path";
import { parseJsonFile } from "./parser";
import { generateCode } from "./generator";
import type { Server } from "bun";
import { statSync, existsSync } from "fs";
import { spawn } from "child_process";

// 启动API服务器
export async function startApiServer(port: string | number) {
  const PORT = Number(port);

  // 创建API服务器
  const server = Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);

      // 处理API请求
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

          // 解析提供的JSON数据
          const abiEntries = await parseJsonFile("", json);

          // 生成TypeScript代码
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

      // 其他请求返回404
      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`API Server running at http://localhost:${PORT}`);

  return server;
}

// 使用Vite启动Vue前端
export async function startViteServer(port: string | number) {
  const PORT = Number(port);
  const projectRoot = join(import.meta.dir, "..");

  console.log(`Starting Vite development server on port ${PORT}...`);

  // 使用子进程启动vite
  const viteProcess = spawn("npx", ["vite", "--port", PORT.toString()], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: true,
  });

  viteProcess.on("error", (error) => {
    console.error(`Failed to start Vite server: ${error.message}`);
  });

  console.log(`Vite server should be running at http://localhost:${PORT}`);

  return viteProcess;
}

// 兼容旧的API，现在调用新的startServer函数
export async function startServer(port: string | number) {
  const vitePort = Number(port);
  const apiPort = vitePort + 1;

  // 启动API服务器
  const apiServer = await startApiServer(apiPort);

  // 启动Vite服务器
  const viteServer = await startViteServer(vitePort);

  console.log(`Vue UI is available at http://localhost:${vitePort}`);
  console.log(`API Server is running at http://localhost:${apiPort}`);

  return {
    apiServer,
    viteServer,
    port: vitePort,
  };
}
