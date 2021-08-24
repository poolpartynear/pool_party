import { u128, context, storage } from "near-sdk-as";

// The raffle happens once per day
const RAFFLE_WAIT: u64 = 86400000000000

// We take a 5% of the raffle
const POOL_FEES: u128 = u128.from(5)

// The external pool
const POOL: string = "blazenet.pool.f863973.m0" 

// The first guardian
const GUARDIAN: string = 'pooltest.testnet'

// The DAO in charge of changing these parameters
const DAO: string = "dao.pooltest.testnet"

// If the tree gets too high (>12 levels) traversing it gets expensive,
// lets cap the max number of users, so traversing the tree is at max 90TGAS
const MAX_USERS: i32 = 8100

export function get_guardian(): string {
  return storage.getPrimitive<string>('dao_guardian', GUARDIAN)
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
  return POOL
}

export function get_max_users(): u32 {
  return storage.getPrimitive<u32>('dao_max_users', MAX_USERS)
}


function fail_if_not_dao():void{
  assert(context.predecessor == DAO, "Only the DAO can call this function")
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

export function change_pool_fees(new_fees:u128): bool{
  fail_if_not_dao()
  assert(new_fees <= u128.from(100), "Fee must be between 0 - 100")
  storage.set<u128>('dao_pool_fees', new_fees)
  return true
}

export function propose_new_guardian(new_guardian:string): bool{
  fail_if_not_dao()
  storage.set<string>('dao_proposed_guardian', new_guardian)
  return true
}

export function accept_being_guardian(): bool{
  const PROPOSED = storage.getPrimitive<string>('dao_proposed_guardian', GUARDIAN)
  assert(context.predecessor == PROPOSED,
         "Only the proposed guardian can accept to be guardian")

  storage.set<string>("dao_guardian", PROPOSED)
  return true
}
