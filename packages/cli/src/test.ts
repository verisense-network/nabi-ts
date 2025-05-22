import {
  registry,
  initApi,
  E,
  A,
  B,
  C,
  T,
  IA,
  a as aFn,
  tv as tvFn,
  bbb as bbbFn,
  cc as ccFn,
  should_not_call_put,
  should_call_put,
} from "../output/data.ts";

const nucleusId = "kGfsp8zVbB4GfiwSjpejLTLM8R4JbsPtniKhu1ycVjJpLYLZp";

try {
  await initApi("http://localhost:9944");

  const e = new E(registry, { a: [1, 2, 3], b: 4, c: 5 });

  const aData = {
    b: B.from(registry, {
      c: C.from(registry, { d: [1, 2, 3], e: ["a", "b"] })!,
    })!,
    tuple_field: [1, "a"],
    array_field: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    slice_field: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    ggg: T.from(registry, { a: 1, b: 2 })!,
  } as IA;

  const aRes = await aFn(nucleusId, aData);
  console.log("aRes", aRes.toHuman());

  const tvRes = await tvFn(nucleusId, {
    ok: 1,
    err: "err",
  });
  console.log("tvRes", tvRes.toHuman());

  const bbbRes = await bbbFn(nucleusId, [aData, "abc"]);
  console.log("bbbRes", bbbRes.toHuman());

  const ccRes = await ccFn(nucleusId, "aaa", "bbc");
  console.log("ccRes", ccRes.toHuman());

  // const shouldNotCallPutRes = await should_not_call_put(nucleusId);
  // console.log("shouldNotCallPutRes", shouldNotCallPutRes.toHuman());

  // const shouldCallPutRes = await should_call_put(nucleusId);
  // console.log("shouldCallPutRes", shouldCallPutRes.toHuman());
} catch (error) {
  console.error("Error:", error);
}
