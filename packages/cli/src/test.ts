import { registry, initApi, E, A, a as aFn, B, C } from "../output/data.ts";

const nucleusId = "kGfsp8zVbB4GfiwSjpejLTLM8R4JbsPtniKhu1ycVjJpLYLZp";

try {
  await initApi("http://localhost:9944");

  const e = new E(registry, { a: [1, 2, 3], b: 4, c: 5 });

  const response = await aFn(nucleusId, {});

  console.log("response", response);
} catch (error) {
  console.error("Error:", error);
}
