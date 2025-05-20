import { initApi, cc, use_codec, E, registry } from "../output/data.ts";

const e = new E(registry, { a: [1, 2, 3], b: 4, c: 5 });

console.log("e", e.toHex());
