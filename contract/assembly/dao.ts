import { u128, context, storage, logging } from "near-sdk-as";
import { user_to_idx, idx_to_user } from "./model";

// The raffle happens once per day
const RAFFLE_WAIT: u64 = 86400000000000

// We take a 5% of the raffle
const POOL_FEES: u128 = u128.from(5)

// If the tree gets too high (>12 levels) traversing it gets expensive,
// lets cap the max number of users, so traversing the tree is at max 90TGAS
const MAX_USERS: i32 = 8100

// The users cannot have more than a certain amount of NEARs,
// to limit whale's size in the pool. Default: A Millon Nears
const MAX_DEPOSIT: u128 = u128.from("1000000000000000000000000000000")

// The users cannot have deposit less than a certain amount of
// NEARs, to limit sybill attacks. Default: 5 NEARS
const MIN_DEPOSIT: u128 = u128.from("5000000000000000000000000")

export function init_dao(pool: string, guardian: string, dao: string): bool{
  // Initialize the POOL, GUARDIAN and DAO
  // - The POOL is the external pool on which we stake all the NEAR
  // - The GUARDIAN can distribute tickets from the reserve to the users
  // - The DAO is the user than can change all the pool parameters
  const initialized = storage.getPrimitive<bool>('initialized', false)
  assert(!initialized, "Already initialized")
  storage.set<bool>('initialized', true)

  storage.set<string>('external_pool', pool)
  storage.set<string>('dao', dao)
  storage.set<string>("dao_guardian", guardian)

  return true
}


// Getters ---------------------------------------------------
export function DAO(): string{
  return storage.getPrimitive<string>('dao', '')
}

export function get_guardian(): string {
  return storage.getPrimitive<string>('dao_guardian', '')
}

export function get_raffle_wait(): u64 {
  return storage.getPrimitive<u64>('dao_raffle_wait', RAFFLE_WAIT)
}

export function get_pool_fees(): u128 {
  if (storage.contains('dao_pool_fees')) {
    return storage.getSome<u128>('dao_pool_fees')
  }
  return POOL_FEES
}

export function get_external_pool(): string {
  return storage.getPrimitive<string>('external_pool', '')
}

export function get_max_users(): u32 {
  return storage.getPrimitive<u32>('dao_max_users', MAX_USERS)
}

export function get_max_deposit(): u128 {
  if (storage.contains('dao_max_deposit')) {
    return storage.getSome<u128>('dao_max_deposit')
  }
  return MAX_DEPOSIT
}


// Setters ---------------------------------------------------
function fail_if_not_dao(): void {
  assert(context.predecessor == DAO(), "Only the DAO can call this function")
}

export function change_max_users(new_amount:u32): bool{
  fail_if_not_dao()

  assert(new_amount <= 8100, "For GAS reasons we enforce to have at max 8100 users")
  storage.set<u32>('dao_max_users', new_amount)
  return true
}

export function change_time_between_raffles(new_wait:u64): bool{
  fail_if_not_dao()
  storage.set<u64>('dao_raffle_wait', new_wait)
  return true
}

export function change_pool_fees(new_fees:u8): bool{
  fail_if_not_dao()

  const new_fees_u128: u128 = u128.from(new_fees)
  assert(new_fees_u128 <= u128.from(100), "Fee must be between 0 - 100")

  storage.set<u128>('dao_pool_fees', new_fees_u128)
  return true
}

export function change_max_deposit(new_max_deposit: u128): bool {
  fail_if_not_dao()
  storage.set<u128>('dao_max_deposit', new_max_deposit)
  return true
}

export function propose_new_guardian(new_guardian:string): bool{
  fail_if_not_dao()
  storage.set<string>('dao_proposed_guardian', new_guardian)
  return true
}

export function accept_being_guardian(): bool{
  const PROPOSED = storage.getPrimitive<string>('dao_proposed_guardian', get_guardian())

  assert(context.predecessor == PROPOSED,
         "Only the proposed guardian can accept to be guardian")

  const new_guardian = context.predecessor
  assert(!user_to_idx.contains(new_guardian),
         "For simplicity, we don't allow an existing user to be guardian")

  storage.set<string>("dao_guardian", PROPOSED)
  user_to_idx.set(new_guardian, 0)
  idx_to_user.set(0, new_guardian)

  return true
}