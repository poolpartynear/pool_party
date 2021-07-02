import { u128 } from "near-sdk-as";

// The DAO in charge of changing these parameters
const DAO: string = "dao.pooltest.testnet"

// The raffle happens once per day
let RAFFLE_WAIT: u64 = 86400000000000

// We take a 5% of the raffle
let POOL_FEES: u128 = u128.from(20)

// The first guardian
let GUARDIAN: string = 'pooltest.testnet' // "test-account-1625088444921-3359490"

// The external pool
const POOL: string = "blazenet.pool.f863973.m0" // 'test-account-1625088622351-4194423'

// If the tree gets too high (>14 levels) traversing it gets expensive,
// lets cap the max number of users, so traversing the tree is at max 90TGAS
const MAX_USERS: i32 = 8100


export function get_guardian(): string {
  return GUARDIAN
}

export function get_raffle_wait(): u64 {
  return RAFFLE_WAIT
}

export function get_pool_fees(): u128 {
  return POOL_FEES
}

export function get_external_pool(): string {
  return POOL
}

export function get_max_users(): i32 {
  return MAX_USERS
}