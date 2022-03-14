import { storage, context, u128, ContractPromise, logging, env } from "near-sdk-as";
import * as DAO from "./dao";
import * as Pool from './pool'
import * as External from './external'
import { TGAS, get_callback_result } from './aux'
import { User } from "./users"


// Amount of time between prize updates (10 sec)
// To avoid blocking the interaction with external pool
export const PRIZE_UPDATE_INTERVAL: u64 = 10000000000


// Prize to distribute in next raffle
export function get_pool_prize(): u128 {
  if (storage.contains('prize')) { return storage.getSome<u128>('prize') }
  return u128.Zero
}

function set_pool_prize(prize: u128): void {
  storage.set<u128>('prize', prize)
}


// Update prize function
@nearBindgen
class PoolArgs {
  constructor(public account_id: string) { }
}

export function update_prize(): void {
  assert(!DAO.is_emergency(), 'We will be back soon')

  assert(context.prepaidGas >= 40 * TGAS, "Please use at least 40Tgas")

  const now: u64 = env.block_timestamp()
  const next_update: u64 = storage.getPrimitive<u64>('next_update', 0)

  assert(now >= next_update, "Not enough time has passed")

  // Inform external that we are going to interact
  External.start_interacting()

  // Ask how many NEARs we have staked in the external pool
  const args: PoolArgs = new PoolArgs(context.contractName)

  const promise = ContractPromise.create(
    DAO.get_external_pool(), "get_account", args.encode(), 20 * TGAS, u128.Zero
  )
  const callbackPromise = promise.then(
    context.contractName, "update_prize_callback", "", 20 * TGAS
  )
  callbackPromise.returnAsResult();
}

export function update_prize_callback(): u128 {
  External.stop_interacting()

  let info = get_callback_result()

  if (info.status != 1) {
    // We didn't manage to get information from the pool  
    return get_pool_prize()
  }

  const our_user_in_pool = decode<User>(info.buffer);
  const tickets: u128 = Pool.get_tickets()

  // The difference between the staked_balance in the external pool and the
  // tickets we have in our pool is the prize
  let prize: u128 = u128.Zero
  if (our_user_in_pool.staked_balance > tickets) {
    prize = our_user_in_pool.staked_balance - tickets
  }

  if (prize > DAO.get_max_raffle()){
    prize = DAO.get_max_raffle()
  }

  logging.log(`New prize: ${prize.toString()} yN`)
  set_pool_prize(prize)

  // Update last_updated time
  storage.set<u64>('next_update', env.block_timestamp() + PRIZE_UPDATE_INTERVAL)

  return prize
}