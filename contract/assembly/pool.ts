import { storage, context, env, u128, ContractPromise, ContractPromiseBatch, logging } from "near-sdk-as"
import { user_to_idx, idx_to_user, user_tickets, accum_weights, user_unstaked,
         user_withdraw_turn, winners, PoolInfo, User, Winner } from "./model"

import * as Prize from './prize'
import * as External from './external'
import * as DAO from './dao'
import * as Utils from './utils'
import { TGAS } from "./constants"
import * as Raffle from './raffle'


// Total number of tickets in the pool
export function get_tickets(): u128 {
  if (storage.contains('pool_tickets')) {
    return storage.getSome<u128>('pool_tickets')
  }
  return u128.Zero
}

export function set_tickets(tickets: u128): void {
  storage.set<u128>('pool_tickets', tickets)
}

export function get_info(): PoolInfo {
  // Returns the: amount of tickets in the pool, current prize, 
  // next timestamp to do the raffle, and if we should call the external pool
  const tickets: u128 = get_tickets() - External.get_to_unstake()
  const next_raffle: u64 = storage.getPrimitive<u64>('nxt_raffle_tmstmp', 0)
  const prize: u128 = Prize.pool_prize()

  const reserve: u128 = (user_tickets.length > 0)? user_tickets[0] : u128.Zero

  const withdraw_external_ready: bool = External.can_withdraw_external()

  return new PoolInfo(tickets, reserve, prize, next_raffle, withdraw_external_ready)
}


export function get_account(account_id: string): User {
  // Returns information for the account 'account_id'
  if (!user_to_idx.contains(account_id)) {
    return new User(u128.Zero, u128.Zero, 0, false)
  }

  const idx: i32 = user_to_idx.getSome(account_id)
  const tickets: u128 = user_tickets[idx]
  const unstaked: u128 = user_unstaked[idx]

  const when: u64 = user_withdraw_turn[idx]
  const now: u64 = External.get_current_turn()

  // Compute remaining time for withdraw to be ready
  const remaining: u64 = (when > now)? when - now : 0

  const available: bool = unstaked > u128.Zero && now >= when

  return new User(tickets, unstaked, remaining, available)
}


// Deposit and stake ----------------------------------------------------------
function stake_tickets_for(idx: i32, amount: u128): void {
  // Add amount of tickets to the user in the position idx  
  user_tickets[idx] = user_tickets[idx] + amount
  accum_weights[idx] = accum_weights[idx] + amount

  // Update the accumulative weights in the binary tree
  while (idx != 0) {
    idx = (idx - 1) / 2
    accum_weights[idx] = accum_weights[idx] + amount
  }

  // Update pool tickets
  set_tickets(get_tickets() + amount)
}


@nearBindgen
class IdxAmount {
  constructor(public idx: i32, public amount: u128) { }
}

export function deposit_and_stake(): void {
  // Function called by users to buy tickets
  assert(context.prepaidGas >= 190 * TGAS, "Not enough gas")

  let amount: u128 = context.attachedDeposit
  assert(amount > u128.Zero, "Please attach some NEARs")

  // Get the total number of users
  const N: i32 = storage.getPrimitive<i32>('total_users', 0)
  assert(N < DAO.get_max_users(), "Maximum users reached, please user other pool")

  // The guardian must deposit first
  if (N == 0) {
    assert(context.predecessor == DAO.get_guardian(), "Let the GUARDIAN deposit first")
  }

  // We add the users in Level Order so the tree is always balanced
  let idx: i32 = 0
  const user: string = context.predecessor

  if (user_to_idx.contains(user)) {
    idx = user_to_idx.getSome(user)
    logging.log("Staking on existing user: " + idx.toString())
  } else {
    idx = N

    logging.log("Creating new user: " + idx.toString())
    user_to_idx.set(user, idx)
    idx_to_user.set(idx, user)
    user_tickets.push(u128.Zero)
    accum_weights.push(u128.Zero)
    user_unstaked.push(u128.Zero)
    user_withdraw_turn.push(0)

    storage.set<i32>('total_users', N + 1)
  }

  // Deposit the money in the external pool
  // We add 100yn to cover the cost of staking in an external pool
  let promise: ContractPromise = ContractPromise.create(
    DAO.get_external_pool(), "deposit_and_stake", "{}", 50 * TGAS, amount + u128.from(100)
  )

  // Create a callback to _deposit_and_stake
  let args: IdxAmount = new IdxAmount(idx, amount)
  let callbackPromise = promise.then(context.contractName, "deposit_and_stake_callback",
    args.encode(), 100 * TGAS)
  callbackPromise.returnAsResult();
}

export function deposit_and_stake_callback(idx: i32, amount: u128): bool {
  let response = Utils.get_callback_result()

  // Assert the response is successful, so the user gets back the money if not
  assert(response.status == 1, "Error when interacting with external pool")

  // Update binary tree and pool
  stake_tickets_for(idx, amount)

  return true
}


// Unstake --------------------------------------------------------------------
export function unstake(amount: u128): bool {
  assert(user_to_idx.contains(context.predecessor), "User dont exist")

  // Get user info
  let idx: i32 = user_to_idx.getSome(context.predecessor)

  // Check if it has enough money
  assert(amount <= user_tickets[idx], "Not enough money")

  logging.log("Unstaking " + amount.toString() + " from user " + idx.toString())

  // add to the amount we will unstake from external next time
  External.set_to_unstake(External.get_to_unstake() + amount)

  // the user will be able to in the next withdraw_turn
  user_withdraw_turn[idx] = External.get_next_withdraw_turn()

  // update user info
  user_tickets[idx] = user_tickets[idx] - amount
  user_unstaked[idx] = user_unstaked[idx] + amount

  // update binary tree
  accum_weights[idx] = accum_weights[idx] - amount

  while (idx != 0) {
    idx = (idx - 1) / 2
    accum_weights[idx] = accum_weights[idx] - amount
  }

  return true
}


// Withdraw all ---------------------------------------------------------------
export function withdraw_all(): void {
  // Function called by the user to withdraw their staked NEARs
  assert(context.prepaidGas >= 60 * TGAS, "Not enough gas")

  assert(user_to_idx.contains(context.predecessor), "User dont exist")

  let idx: i32 = user_to_idx.getSome(context.predecessor)

  assert(External.get_current_turn() >= user_withdraw_turn[idx], "Withdraw not ready")

  let amount: u128 = user_unstaked[idx]
  assert(amount > u128.Zero, "Nothing to unstake")

  // Set user's unstake amount to 0 to avoid reentracy attacks
  user_unstaked[idx] = u128.Zero

  // Send money to the user and callback to see it succeded
  let args: IdxAmount = new IdxAmount(idx, amount)

  ContractPromiseBatch.create(context.predecessor)
    .transfer(amount)
    .then(context.contractName)
    .function_call("withdraw_all_callback", args.encode(), u128.Zero, 20 * TGAS)
}

export function withdraw_all_callback(idx: i32, amount: u128): void {
  let response = Utils.get_callback_result()

  if (response.status == 1) {
    logging.log("Sent " + amount.toString() + " to " + idx_to_user.getSome(idx))
  } else {
    user_unstaked[idx] = amount  // It failed, add unstaked back to user
  }
}


// Raffle ---------------------------------------------------------------------
export function raffle(): i32 {
  // Function to make the raffle
  let now: u64 = env.block_timestamp()

  let next_raffle: u64 = storage.getPrimitive<u64>('nxt_raffle_tmstmp', 0)

  assert(now >= next_raffle, "Not enough time has passed")

  // If the total amount of accumulated tickets is equal to the tickets of
  // the reserve, then nobody is playing. Pick the ticket 0 so the reserve wins
  let winning_ticket: u128 = u128.Zero

  if (accum_weights[0] > user_tickets[0]) {
    // Raffle between all the tickets, excluding those from the reserve
    // i.e. exclude the tickets numbered from 0 to user_tickets[0]
    winning_ticket = Raffle.random_u128(user_tickets[0], accum_weights[0])
  }

  // Retrieve the winning user from the binary tree
  let winner: i32 = Raffle.select_winner(winning_ticket)
  let prize: u128 = Prize.pool_prize()

  // A part goes to the reserve
  let reserve: u128 = prize / DAO.get_pool_fees()
  stake_tickets_for(0, reserve)

  // We give most to the user
  let user_prize: u128 = prize - reserve
  stake_tickets_for(winner, user_prize)

  logging.log("Reserve: " + reserve.toString() + " Prize: " + user_prize.toString())

  // Set next raffle time
  storage.set<u64>('nxt_raffle_tmstmp', now + DAO.get_raffle_wait())
  storage.set<u128>('prize', u128.Zero)

  let winner_name: string = idx_to_user.getSome(winner)
  winners.push(new Winner(winner_name, user_prize))
  return winner
}

export function get_winners(): Array<Winner> {
  // Returns the last 10 winners
  let size: i32 = winners.length

  let lower: i32 = 0
  if (size >= 10) { lower = size - 10 }

  let to_return: Array<Winner> = new Array<Winner>()
  for (let i: i32 = lower; i < size; i++) { to_return.push(winners[i]) }

  return to_return
}