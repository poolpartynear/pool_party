import { storage, context, env, u128, ContractPromise, ContractPromiseBatch, logging } from "near-sdk-as"
import { PoolInfo, UserAmountParams, winners, Winner } from "./model"

import * as Prize from './prize'
import * as External from './external'
import * as DAO from './dao'
import * as Users from './users'
import { TGAS, get_callback_result } from "./aux"


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
  const prize: u128 = Prize.get_pool_prize()

  const reserve: u128 = Users.get_staked_for(DAO.get_guardian())

  const withdraw_external_ready: bool = External.can_withdraw_external()

  return new PoolInfo(tickets, reserve, prize, next_raffle, withdraw_external_ready)
}


export function get_account(account_id: string): Users.User {
  // Returns information for the account 'account_id'
  if (!Users.is_registered(account_id)) {
    return new Users.User(u128.Zero, u128.Zero, 0, false)
  }

  const tickets: u128 = Users.get_staked_for(account_id)
  const unstaked: u128 = Users.get_unstaked_for(account_id)

  const when: u64 = Users.get_withdraw_turn_for(account_id)
  const now: u64 = External.get_current_turn()

  // Compute remaining time for withdraw to be ready
  const remaining: u64 = (when > now) ? when - now : 0

  const available: bool = unstaked > u128.Zero && now >= when

  return new Users.User(tickets, unstaked, remaining, available)
}


// Deposit and stake ----------------------------------------------------------
export function deposit_and_stake(): void {
  assert(!DAO.is_emergency(), 'We will be back soon')

  assert(context.prepaidGas >= 80 * TGAS, "Please use at least 80Tgas")

  const amount: u128 = context.attachedDeposit
  const min_amount = DAO.get_min_deposit()
  assert(amount >= min_amount, `Please attach at least ${min_amount} NEAR(s)`)

  // Get the total number of users
  const N: i32 = storage.getPrimitive<i32>('total_users', 0)
  assert(N < DAO.get_max_users(), "Maximum users reached, please user other pool")

  const user: string = context.predecessor

  // The guardian must deposit first
  if (N == 0) {
    assert(user == DAO.get_guardian(), "Let the GUARDIAN deposit first")
  }

  if (!Users.is_registered(user)) {
    logging.log(`Staking on NEW user`)
    Users.add_new_user(user);
  }

  const max_amount = DAO.get_max_deposit()
  assert(Users.get_staked_for(user) + amount <= max_amount,
    `Surpassed the limit of ${max_amount} tickets that a user can have`)

  // Deposit the money in the external pool

  // Add the tickets to the pool, but not yet to the user (rollback if failed)
  // This keeps the prize update consistent
  set_tickets(get_tickets() + amount)

  // We add 100yn to cover the cost of staking in an external pool
  const promise: ContractPromise = ContractPromise.create(
    DAO.get_external_pool(), "deposit_and_stake", "{}", 12 * TGAS, amount + u128.from(100)
  )

  // Create a callback to _deposit_and_stake
  const args: UserAmountParams = new UserAmountParams(user, amount)

  const callbackPromise = promise.then(
    context.contractName,
    "deposit_and_stake_callback",
    args.encode(),
    45 * TGAS
  )
}

export function deposit_and_stake_callback(user: string, amount: u128): void {
  const response = get_callback_result()

  if (response.status == 1) {
    // It worked, give tickets to the user
    logging.log(
      `EVENT_JSON:{"standard": "nep297", "version": "1.0.0", "event": "stake_for_user", "data": {"pool": "${context.contractName}", "user": "${user}", "amount": "${amount}"}}`
    );
    Users.stake_tickets_for(user, amount)
  } else {
    // It failed, remove tickets from the pool and return the money
    set_tickets(get_tickets() - amount)

    logging.log("Failed attempt to deposit in the pool, returning money to the user")
    ContractPromiseBatch.create(user).transfer(amount)
  }
}


// Unstake --------------------------------------------------------------------
export function unstake(amount: u128): bool {
  assert(!DAO.is_emergency(), 'We will be back soon')

  const user: string = context.predecessor
  assert(Users.is_registered(user), "User not registered in the pool")

  const user_tickets = Users.get_staked_for(user)

  // Check if it has enough money
  assert(amount <= user_tickets, "Not enough money")

  const withdraw_all: bool = (user_tickets - amount) < DAO.get_min_deposit();
  if (withdraw_all) {
    amount = user_tickets
  }

  // add to the amount we will unstake from external next time
  External.set_to_unstake(External.get_to_unstake() + amount)

  // the user will be able to withdraw in the next withdraw_turn
  Users.set_withdraw_turn(user, External.get_next_withdraw_turn())

  // update user info
  Users.unstake_tickets_for(user, amount)

  logging.log(
    `EVENT_JSON:{"standard": "nep297", "version": "1.0.0", "event": "unstake", "data": {"pool": "${context.contractName}", "user": "${user}", "amount": "${amount}", "all": "${withdraw_all}"}}`
  );

  return true
}


// Withdraw all ---------------------------------------------------------------
export function withdraw_all(): void {
  assert(!DAO.is_emergency(), 'We will be back soon')

  assert(context.prepaidGas >= 20 * TGAS, "Use at least 20Tgas")

  const user: string = context.predecessor

  assert(user != DAO.get_guardian(), "The guardian cannot withdraw money")

  assert(Users.is_registered(user), "User is not registered")

  assert(External.get_current_turn() >= Users.get_withdraw_turn_for(user), "Withdraw not ready")

  const amount: u128 = Users.get_unstaked_for(user)
  assert(amount > u128.Zero, "Nothing to unstake")

  Users.withdraw_all_for(user)

  // Send money to the user, always succeed
  ContractPromiseBatch.create(context.predecessor).transfer(amount)

  logging.log(
    `EVENT_JSON:{"standard": "nep297", "version": "1.0.0", "event": "transfer", "data": {"pool": "${context.contractName}", "user": "${user}", "amount": "${amount}"}}`
  );
}


// Raffle ---------------------------------------------------------------------
export function raffle(): string {
  assert(!DAO.is_emergency(), 'We will be back soon')

  // Function to make the raffle
  const now: u64 = env.block_timestamp()

  const next_raffle: u64 = storage.getPrimitive<u64>('nxt_raffle_tmstmp', 0)

  assert(now >= next_raffle, "Not enough time has passed")

  // Check if there is a prize to be raffled
  const prize: u128 = Prize.get_pool_prize()

  if (prize < DAO.get_min_raffle()) { return "" }

  // Pick a random ticket as winner
  const winner: string = Users.choose_random_winner()

  // A part goes to the reserve
  const fees: u128 = u128.from(DAO.get_pool_fees())
  const reserve_prize: u128 = (prize * fees) / u128.from(100)

  const guardian: string = DAO.get_guardian()
  Users.stake_tickets_for(guardian, reserve_prize)

  // We give most to the user
  const user_prize: u128 = prize - reserve_prize
  Users.stake_tickets_for(winner, user_prize)

  set_tickets(get_tickets() + prize)

  logging.log(
    `EVENT_JSON:{"standard": "nep297", "version": "1.0.0", "event": "prize-user", "data": {"pool": "${context.contractName}", "user": "${winner}", "amount": "${user_prize}"}}`
  );

  logging.log(
    `EVENT_JSON:{"standard": "nep297", "version": "1.0.0", "event": "prize-reserve", "data": {"pool": "${context.contractName}", "user": "${guardian}", "amount": "${reserve_prize}"}}`
  );

  // Set next raffle time
  storage.set<u64>('nxt_raffle_tmstmp', now + DAO.get_time_between_raffles())
  storage.set<u128>('prize', u128.Zero)

  winners.push(new Winner(winner, user_prize, now))
  return winner
}

export function number_of_winners(): i32 {
  // Returns the number of winners so far
  return winners.length
}

export function get_winners(from: u32, until: u32): Array<Winner> {
  assert(<i32>until <= number_of_winners(), "'until' must be <= number_of_winners")

  let to_return: Array<Winner> = new Array<Winner>()
  for (let i: i32 = <i32>from; i < <i32>until; i++) {
    to_return.push(winners[i])
  }

  return to_return
}


// The TOKEN contract can give part of the reserve to a user
export function give_from_reserve(to: string, amount: u128): void {
  assert(context.prepaidGas >= 120 * TGAS, "This function requires at least 120TGAS")

  const guardian: string = DAO.get_guardian()

  assert(context.predecessor == guardian, "Only the GUARDIAN can use the reserve")

  assert(Users.is_registered(to), "User is not registered in the pool")

  assert(Users.get_staked_for(guardian) >= amount, "Not enough tickets in the reserve")

  // Remove from reserve
  Users.remove_tickets_from(guardian, amount)

  // Give to the user, note that updating the tree can cost up to 90 TGAS
  Users.stake_tickets_for(to, amount)
}