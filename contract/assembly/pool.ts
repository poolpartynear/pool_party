import { storage, context, env, u128, ContractPromise, ContractPromiseBatch, logging } from "near-sdk-as"
import { user_to_idx, idx_to_user, user_unstaked,
         user_withdraw_turn, winners, PoolInfo, User, Winner } from "./model"

import * as Prize from './prize'
import * as External from './external'
import * as DAO from './dao'
import * as Utils from './utils'
import * as Tree from './tree'
import { TGAS } from "./constants"


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

  const reserve: u128 = Tree.tickets_of(0)

  const withdraw_external_ready: bool = External.can_withdraw_external()

  return new PoolInfo(tickets, reserve, prize, next_raffle, withdraw_external_ready)
}


export function get_account(account_id: string): User {
  // Returns information for the account 'account_id'
  if (!user_to_idx.contains(account_id)) {
    return new User(u128.Zero, u128.Zero, 0, false)
  }

  const idx: i32 = user_to_idx.getSome(account_id)
  const tickets: u128 = Tree.tickets_of(idx)
  const unstaked: u128 = user_unstaked[idx]

  const when: u64 = user_withdraw_turn[idx]
  const now: u64 = External.get_current_turn()

  // Compute remaining time for withdraw to be ready
  const remaining: u64 = (when > now)? when - now : 0

  const available: bool = unstaked > u128.Zero && now >= when

  return new User(tickets, unstaked, remaining, available)
}


// Deposit and stake ----------------------------------------------------------
function add_new_user(user: string): i32{
  const N: i32 = storage.getPrimitive<i32>('total_users', 0)

  user_to_idx.set(user, N)
  idx_to_user.set(N, user)
  Tree.add_user(N)
  user_unstaked.push(u128.Zero)
  user_withdraw_turn.push(0)

  storage.set<i32>('total_users', N + 1)

  return N;
}

function give_tickets_to(idx: i32, amount: u128): void {
  // Add amount of tickets to the user in the position idx  
  Tree.add_to(idx, amount)

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

  assert(!DAO.is_emergency(), 'We will be back soon')

  const amount: u128 = context.attachedDeposit
  const min_amount = DAO.get_min_deposit()
  assert(amount >= min_amount, `Please attach at least ${min_amount} NEAR(s)`)

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
    logging.log(`Staking on existing user #${idx}`)
  } else {
    idx = add_new_user(user);
    logging.log(`Staking on NEW user #${idx}`)
  }

  const max_amount = DAO.get_max_deposit()
  assert(Tree.tickets_of(idx) + amount <= max_amount,
         `Surpassed the limit of ${max_amount} tickets that a user can have`)

  // Deposit the money in the external pool
  // We add 100yn to cover the cost of staking in an external pool
  const promise: ContractPromise = ContractPromise.create(
    DAO.get_external_pool(), "deposit_and_stake", "{}", 50 * TGAS, amount + u128.from(100)
  )

  // Create a callback to _deposit_and_stake
  const args: IdxAmount = new IdxAmount(idx, amount)

  const callbackPromise = promise.then(
    context.contractName,
    "deposit_and_stake_callback",
    args.encode(),
    100 * TGAS
  )

  callbackPromise.returnAsResult();
}

export function deposit_and_stake_callback(idx: i32, amount: u128): bool {
  const response = Utils.get_callback_result()

  if(response.status == 1){
    // It worked, give tickets to the user
    give_tickets_to(idx, amount)
    return true
  }else{
    // It failed, return their money
    logging.log("Failed attempt to deposit in the pool, returning money to the user")
    const account = idx_to_user.getSome(idx)
    ContractPromiseBatch.create(account).transfer(amount)
    return false
  }
}


// Unstake --------------------------------------------------------------------
export function unstake(amount: u128): bool {
  assert(user_to_idx.contains(context.predecessor), "User dont exist")

  assert(!DAO.is_emergency(), 'We will be back soon')

  // Get user info
  let idx: i32 = user_to_idx.getSome(context.predecessor)

  // The guardian cannot unstake (it can only transfer tickets)
  assert(idx != 0, "The GUARDIAN cannot unstake money!")

  // Check if it has enough money
  assert(amount <= Tree.tickets_of(idx), "Not enough money")

  logging.log(`Unstaking ${amount} from user ${idx}`)

  // add to the amount we will unstake from external next time
  External.set_to_unstake(External.get_to_unstake() + amount)

  // the user will be able to withdraw in the next withdraw_turn
  user_withdraw_turn[idx] = External.get_next_withdraw_turn()

  // update binary tree
  Tree.remove_from(idx, amount)

  // update user info
  user_unstaked[idx] = user_unstaked[idx] + amount

  return true
}


// Withdraw all ---------------------------------------------------------------
export function withdraw_all(): void {
  // Function called by the user to withdraw their staked NEARs
  assert(context.prepaidGas >= 60 * TGAS, "Not enough gas")

  assert(!DAO.is_emergency(), 'We will be back soon')

  assert(user_to_idx.contains(context.predecessor), "User dont exist")

  const idx: i32 = user_to_idx.getSome(context.predecessor)

  assert(External.get_current_turn() >= user_withdraw_turn[idx], "Withdraw not ready")

  const amount: u128 = user_unstaked[idx]
  assert(amount > u128.Zero, "Nothing to unstake")

  // Set user's unstake amount to 0 to avoid reentracy attacks
  user_unstaked[idx] = u128.Zero

  // Send money to the user, always succeed
  logging.log(`Sending ${amount} to ${context.predecessor}`)
  ContractPromiseBatch.create(context.predecessor).transfer(amount)
}


// Raffle ---------------------------------------------------------------------
export function raffle(): i32 {
  // This function needs 190TGas to work, but we do not
  // assert it since, if it fails, it rollsback

  assert(!DAO.is_emergency(), 'We will be back soon')

  // Function to make the raffle
  const now: u64 = env.block_timestamp()

  const next_raffle: u64 = storage.getPrimitive<u64>('nxt_raffle_tmstmp', 0)

  assert(now >= next_raffle, "Not enough time has passed")

  // Check if there is a prize to be raffled
  const prize: u128 = Prize.pool_prize()

  if(prize == u128.Zero){ return 0 }

  // Pick a random ticket as winner
  const winner: i32 = Tree.choose_random_winner()

  // A part goes to the reserve
  const fees:u128 = u128.from(DAO.get_pool_fees())
  const reserve: u128 = (prize * fees) / u128.from(100)
  give_tickets_to(0, reserve)

  // We give most to the user
  const user_prize: u128 = prize - reserve
  give_tickets_to(winner, user_prize)

  logging.log(`Reserve: ${reserve} - Prize: ${user_prize}`)

  // Set next raffle time
  storage.set<u64>('nxt_raffle_tmstmp', now + DAO.get_raffle_wait())
  storage.set<u128>('prize', u128.Zero)

  const winner_name: string = idx_to_user.getSome(winner)
  winners.push(new Winner(winner_name, user_prize, now))
  return winner
}

export function number_of_winners(): i32 {
  // Returns the number of winners so far
  return winners.length
}

export function get_winners(from:i32, until:i32): Array<Winner> {
  assert(from >= 0, "'from' must be positive")
  assert(until <= winners.length, "'until' must be < number_of_winners")

  let to_return: Array<Winner> = new Array<Winner>()
  for (let i: i32 = from; i < until; i++) {
    to_return.push(winners[i])
  }

  return to_return
}


// The TOKEN contract can give part of the reserve to a user
export function give_from_reserve(to: string, amount: u128): void {
  assert(context.prepaidGas >= 120 * TGAS, "This function requires at least 120TGAS")
  assert(context.predecessor == DAO.get_guardian(), "Only the GUARDIAN can use the reserve")
  assert(Tree.tickets_of(0) >= amount, "Not enough tickets in the reserve")

  let idx = 0
  if (user_to_idx.contains(to)) {
    idx = user_to_idx.getSome(to)
    logging.log(`Giving ${amount} from the reserve to existing user #${idx}`)
  } else {
    idx = add_new_user(to);
    logging.log(`Giving ${amount} from the reserve to new user #${idx}`)
  }

  // Remove from reserve
  Tree.remove_from(0, amount)

  set_tickets(get_tickets() - amount)  // give_tickets_to adds them back

  // Give to the user, note that updating the tree can cost up to 90 TGAS
  give_tickets_to(idx, amount)
}