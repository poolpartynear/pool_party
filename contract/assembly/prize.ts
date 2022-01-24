import { storage, context, u128, ContractPromise, logging } from "near-sdk-as";
import * as DAO from "./dao";
import * as Utils from './utils'
import * as Pool from './pool'
import { TGAS } from './constants'
import { User } from "./model"


// Prize to distribute in next raffle
export function pool_prize(): u128 {
  if (storage.contains('prize')) { return storage.getSome<u128>('prize') }
  return u128.Zero
}

function set_pool_prize(prize: u128): void {
  storage.set<u128>('prize', prize)
}


@nearBindgen
class PoolArgs {
  constructor(public account_id: string) { }
}

export function update_prize(): void {
  // Ask how many NEARs we have staked in the external pool
  const args: PoolArgs = new PoolArgs(context.contractName)

  const promise = ContractPromise.create(
    DAO.get_external_pool(), "get_account", args.encode(), 15 * TGAS, u128.Zero
  )
  const callbackPromise = promise.then(
    context.contractName, "update_prize_callback", "", 15 * TGAS
  )
  callbackPromise.returnAsResult();
}

export function update_prize_callback(): bool {
  let info = Utils.get_callback_result()

  if (info.status != 1) {
    // We didn't manage to get information from the pool
    return false
  }

  const our_user_in_pool = decode<User>(info.buffer);
  const tickets: u128 = Pool.get_tickets()

  // The difference between the staked_balance in the external pool and the
  // tickets we have in our pool is the prize
  let prize: u128 = u128.Zero
  if (our_user_in_pool.staked_balance > tickets) {
    prize = our_user_in_pool.staked_balance - tickets
  }

  logging.log("prize: " + prize.toString())
  set_pool_prize(prize)

  return true
}