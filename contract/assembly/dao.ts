import { u128, context, storage, env } from "near-sdk-as";
import * as Users from './users'

// The raffle happens once per day
const RAFFLE_WAIT: u64 = 86400000000000

// We take a 5% of the raffle
const POOL_FEES: u8 = 5

// If the tree gets too high (>13 levels) traversing it gets expensive,
// lets cap the max number of users, so traversing the tree is at max 90TGAS
const MAX_USERS: i32 = 8191

// The users cannot have more than a certain amount of NEARs,
// to limit whale's size in the pool. Default: Ten thousand NEARs
const MAX_DEPOSIT: u128 = u128.from("10000000000000000000000000000")

// The users cannot have deposit less than a certain amount of
// NEARs, to limit sybill attacks. Default: 1 NEAR
const MIN_DEPOSIT: u128 = u128.from("1000000000000000000000000")

// Amount of epochs to wait before unstaking (changed for testing)
const UNSTAKE_EPOCH: u64 = 4

// Minimum amount to Raffle (0.1 NEAR)
const MIN_TO_RAFFLE: u128 = u128.from("100000000000000000000000")

// Maximum amount to Raffle (50 NEAR)
const MAX_TO_RAFFLE: u128 = u128.from("50000000000000000000000000")


export function init(external_pool: string, guardian: string, dao: string, days_to_1st_raffle:u64): bool {
  // Initialize the EXTERNAL, GUARDIAN and DAO
  // - The EXTERNAL is the pool on which we stake all the NEAR
  // - The GUARDIAN can distribute tickets from the reserve to the users
  // - The DAO is the user than can change all the pool parameters

  // Only the contract can call this function
  assert(context.predecessor == context.contractName, `${context.predecessor} is not ${context.contractName}`)

  const initialized = storage.getPrimitive<bool>('initialized', false)
  assert(!initialized, "Already initialized")
  storage.set<bool>('initialized', true)

  storage.set<string>('external_pool', external_pool)
  storage.set<string>('dao', dao)
  storage.set<string>("dao_guardian", guardian)

  const DAY: u64 = 86400000000000
  const first_raffle: u64 = env.block_timestamp() + days_to_1st_raffle*DAY
  storage.set<u64>('nxt_raffle_tmstmp', first_raffle)

  return true
}


// Getters ---------------------------------------------------
export function DAO(): string {
  return storage.getPrimitive<string>('dao', '')
}

export function get_guardian(): string {
  return storage.getPrimitive<string>('dao_guardian', '')
}

export function get_time_between_raffles(): u64 {
  return storage.getPrimitive<u64>('dao_raffle_wait', RAFFLE_WAIT)
}

export function get_pool_fees(): u8 {
  return storage.getPrimitive('dao_pool_fees', POOL_FEES)
}

export function get_external_pool(): string {
  return storage.getPrimitive<string>('external_pool', '')
}

export function get_max_users(): i32 {
  return storage.getPrimitive<i32>('dao_max_users', MAX_USERS)
}

export function get_max_deposit(): u128 {
  if (storage.contains('dao_max_deposit')) {
    return storage.getSome<u128>('dao_max_deposit')
  }
  return MAX_DEPOSIT
}

export function get_min_deposit(): u128 {
  if (storage.contains('dao_min_deposit')) {
    return storage.getSome<u128>('dao_min_deposit')
  }
  return MIN_DEPOSIT
}

export function get_min_raffle(): u128 {
  if (storage.contains('dao_min_raffle')) {
    return storage.getSome<u128>('dao_min_raffle')
  }
  return MIN_TO_RAFFLE
}

export function get_max_raffle(): u128 {
  if (storage.contains('dao_max_raffle')) {
    return storage.getSome<u128>('dao_max_raffle')
  }
  return MAX_TO_RAFFLE
}

export function get_epoch_wait(): u64{
  return storage.getPrimitive<u64>('dao_epoch_wait', UNSTAKE_EPOCH)
}

// Setters ---------------------------------------------------
function fail_if_not_dao(): void {
  assert(context.predecessor == DAO(), "Only the DAO can call this function")
}

export function change_max_users(new_amount: u32): bool {
  fail_if_not_dao()
  storage.set<i32>('dao_max_users', <i32>new_amount)
  return true
}

export function change_time_between_raffles(new_wait: u64): bool {
  fail_if_not_dao()
  storage.set<u64>('dao_raffle_wait', new_wait)
  return true
}

export function change_pool_fees(new_fees: u8): bool {
  fail_if_not_dao()

  assert(new_fees <= 100, "Fee must be between 0 - 100")

  storage.set<u8>('dao_pool_fees', new_fees)
  return true
}

export function change_max_deposit(new_max_deposit: u128): bool {
  fail_if_not_dao()
  storage.set<u128>('dao_max_deposit', new_max_deposit)
  return true
}

export function change_min_deposit(new_min_deposit: u128): bool {
  fail_if_not_dao()
  storage.set<u128>('dao_min_deposit', new_min_deposit)
  return true
}

export function change_min_raffle(new_min_raffle: u128): bool {
  fail_if_not_dao()
  storage.set<u128>('dao_min_raffle', new_min_raffle)
  return true
}

export function change_max_raffle(new_max_raffle: u128): bool {
  fail_if_not_dao()
  storage.set<u128>('dao_max_raffle', new_max_raffle)
  return true
}

export function change_epoch_wait(epochs: u64): bool {
  fail_if_not_dao()
  storage.set<u64>('dao_epoch_wait', epochs)
  return true
}

export function propose_new_guardian(new_guardian: string): bool {
  fail_if_not_dao()
  storage.set<string>('dao_proposed_guardian', new_guardian)
  return true
}

export function accept_being_guardian(): bool {
  const proposed = storage.getPrimitive<string>('dao_proposed_guardian', get_guardian())

  assert(context.predecessor == proposed,
    "Only the proposed guardian can accept to be guardian")

  const new_guardian = context.predecessor
  assert(!Users.is_registered(new_guardian),
    "For simplicity, we don't allow an existing user to be guardian")

  storage.set<string>("dao_guardian", proposed)
  Users.take_over_guardian(new_guardian)

  return true
}

// Functions to start and stop an emergency (halts the contract)
export function emergency_start(): bool {
  fail_if_not_dao()
  storage.set<bool>('emergency', true)
  return true
}

export function emergency_stop(): bool {
  fail_if_not_dao()
  storage.set<bool>('emergency', false)
  return true
}

export function is_emergency(): bool {
  return storage.getPrimitive<bool>('emergency', false)
}