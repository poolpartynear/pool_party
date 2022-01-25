import { context, ContractPromise, ContractPromiseResult } from "near-sdk-as";

export function get_callback_result(): ContractPromiseResult {
  // Check that callback functions are called by this contract
  assert(context.predecessor == context.contractName, "Just don't")

  // Return the result from the external pool
  const results = ContractPromise.getResults()

  if (results.length > 0) { return results[0] }

  // Function is being called directly by our contract => TESTING
  return new ContractPromiseResult(1)
}