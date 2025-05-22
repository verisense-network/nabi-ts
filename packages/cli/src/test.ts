import { HttpProvider } from "@polkadot/rpc-provider";
import {
  registry,
  initApi,
  cc,
  E,
  should_not_call_put,
  A,
} from "../output/data.ts";

export async function getRpcClient() {
  const provider = new HttpProvider("http://localhost:9944");

  if (!provider.isConnected) {
    await provider.connect();
    console.log("provider reconnected");
    if (!provider.isConnected) {
      throw new Error("provider not connected");
    }
  }
  return provider;
}

const nucleusId = "kGfsp8zVbB4GfiwSjpejLTLM8R4JbsPtniKhu1ycVjJpLYLZp";

try {
  const provider = await getRpcClient();

  const e = new E(registry, { a: [1, 2, 3], b: 4, c: 5 });
  console.log("e", e.toHex());

  const a = new A(registry, { a: 1 });
  console.log("a", a.toHex());

  const response = await provider.send<any>("nucleus_post", [
    nucleusId,
    "a",
    a,
  ]);
  console.log("response", response);

  // const result = await should_not_call_put(nucleusId);
  // console.log("result", result);
} catch (error) {
  console.error("Error:", error);
}
