import { context, ContractPromise, ContractPromiseResult, math, u128 } from "near-sdk-as";

export function get_callback_result(): ContractPromiseResult {
  // Check that callback functions are called by this contract
  assert(context.predecessor == context.contractName, "Just don't")

  // Return the result from the external pool
  let results = ContractPromise.getResults()

  if (results.length > 0) { return results[0] }

  // Function is being called directly by our contract => TESTING
  return new ContractPromiseResult(1)
}

export function random_u128(min_inc: u128, max_exc: u128): u128 {
  // Returns a random number between min (included) and max (excluded)
  return u128.from(math.randomBuffer(16)) % (max_exc - min_inc) + min_inc
}