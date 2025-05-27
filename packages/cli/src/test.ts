import {
  registry,
  initApi,
  // cc,
  create_community,
  get_invite_fee,
  get_account_count,
  get_accounts
} from "../output/data.ts";

const nucleusId = "kGk1FJCoPv4JTxez4aaWgGVaTPvsc2YPStz6ZWni4e61FVUW6";

try {
  await initApi("http://localhost:9944/");

  // const ccRes = await cc(nucleusId, "123", "bbc");
  // console.log("ccRes", ccRes.toHuman());

  const getAccountCountRes = await get_account_count(nucleusId);
  console.log("getAccountCountRes", getAccountCountRes.toHuman());

  const getAccountsRes = await get_accounts(nucleusId, []);
  console.log("getAccountsRes", getAccountsRes.toHuman());

  const getInviteFeeRes = await get_invite_fee(nucleusId);
  console.log("getInviteFeeRes", getInviteFeeRes.toHuman());

  // const shouldNotCallPutRes = await should_not_call_put(nucleusId);
  // console.log("shouldNotCallPutRes", shouldNotCallPutRes.toHuman());

  // const shouldCallPutRes = await should_call_put(nucleusId);
  // console.log("shouldCallPutRes", shouldCallPutRes.toHuman());
} catch (error) {
  console.error("Error:", error);
}
