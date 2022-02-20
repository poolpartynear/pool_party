import { context, ContractPromise, ContractPromiseResult, u128 } from "near-sdk-as";

// Unit of TGAS
export const TGAS: u64 = 1000000000000

// Amount of epochs to wait before unstaking again
export const UNSTAKE_EPOCH: u64 = 4

// Check that callback functions are called by this contract
// and return results
export function get_callback_result(): ContractPromiseResult {
  assert(context.predecessor == context.contractName, "Just don't")

  // Return the result from the external pool
  const results = ContractPromise.getResults()

  if (results.length > 0) { return results[0] }

  // Function is being called directly by our contract => TESTING
  return new ContractPromiseResult(1)
}