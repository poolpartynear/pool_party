import { u128 } from "near-sdk-as"
import { idx_to_user, user_tickets, accum_weights, winners, PoolInfo, User, Winner } from "./model"

import * as Pool from "./pool"
import * as External from "./external"
import * as DAO from './dao'
import * as Prize from "./prize"


export function get_pool_info(): PoolInfo {
  return Pool.get_info()
}

export function get_account(account_id: string): User {
  return Pool.get_account(account_id)
}


// Interact with pool
export function deposit_and_stake(): void {
  Pool.deposit_and_stake()
}

export function deposit_and_stake_callback(idx:i32, amount:u128): void{
  Pool.deposit_and_stake_callback(idx, amount)
}

export function unstake(amount: u128): bool {
  return Pool.unstake(amount)
}

export function withdraw_all(): void{
  Pool.withdraw_all()
}

export function withdraw_all_callback(idx: i32, amount: u128): void{
  Pool.withdraw_all_callback(idx, amount)
}

// Interact with external
export function interact_external(): void {
  External.interact_external()
}

export function withdraw_external_callback(): bool{
  return External.withdraw_external_callback()
}

export function unstake_external_callback(): bool{
  return External.unstake_external_callback()
}


// Raffle and prize
export function update_prize(): void{
  Prize.update_prize();
}

export function update_prize_callback(): bool{
  return Prize.update_prize_callback()
}

export function raffle(): i32{
  return Pool.raffle()
}

export function get_winners(): Array<Winner> {
  return Pool.get_winners()
}


// Getters mostly for testing
export function get_user_tickets(idx: i32): u128 {
  return user_tickets[idx]
}

export function get_accum_weights(idx: i32): u128 {
  return accum_weights[idx]
}

export function get_user_by_id(idx: i32): string {
  if (idx_to_user.contains(idx)) { return idx_to_user.getSome(idx) }
  return ""
}


// DAO
export function get_pool_fees(): u128{
  return DAO.get_pool_fees()
}

export function change_pool_fees(fees:u128): bool{
  return DAO.change_pool_fees(fees);
}

export function get_raffle_wait(): u64{
  return DAO.get_raffle_wait()
}

export function change_time_between_raffles(time:u64): bool{
  return DAO.change_time_between_raffles(time);
}

export function get_max_users(): i32{
  return DAO.get_max_users()
}

export function change_max_users(max_users:i32): bool{
  return DAO.change_max_users(max_users);
}

export function get_guardian():string{
  return DAO.get_guardian()
}

export function propose_new_guardian(guardian:string): bool{
  return DAO.propose_new_guardian(guardian)
}

export function accept_being_guardian():bool{
  return DAO.accept_being_guardian()
}