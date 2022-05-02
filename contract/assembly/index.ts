import { u128 } from "near-sdk-as"
import { PoolInfo, Winner } from "./model"
import * as Users from './users'

import * as Pool from "./pool"
import * as External from "./external"
import * as DAO from './dao'
import * as Prize from "./prize"

export function init(external_pool: string, guardian: string, dao: string, first_raffle: u64): bool {
  return DAO.init(external_pool, guardian, dao, first_raffle)
}

export function get_pool_info(): PoolInfo {
  return Pool.get_info()
}

export function get_account(account_id: string): Users.User {
  return Pool.get_account(account_id)
}

// Functions to start and stop an emergency (halts the contract)
export function emergency_start(): bool {
  return DAO.emergency_start()
}

export function emergency_stop(): bool {
  return DAO.emergency_stop()
}

// Interact with pool
export function deposit_and_stake(): void {
  Pool.deposit_and_stake()
}

export function deposit_and_stake_callback(user: string, amount: u128): void {
  Pool.deposit_and_stake_callback(user, amount)
}

export function unstake(amount: u128): bool {
  return Pool.unstake(amount)
}

export function withdraw_all(): void {
  Pool.withdraw_all()
}

// Interact with external
export function interact_external(): void {
  External.interact_external()
}

export function withdraw_external_callback(): bool {
  return External.withdraw_external_callback()
}

export function unstake_external_callback(amount: u128): bool {
  return External.unstake_external_callback(amount)
}


// Raffle and prize
export function update_prize(): void {
  Prize.update_prize();
}

export function update_prize_callback(): u128 {
  return Prize.update_prize_callback()
}

export function raffle(): string {
  return Pool.raffle()
}

export function get_winners(from: u32, until: u32): Array<Winner> {
  return Pool.get_winners(from, until)
}

export function number_of_winners(): i32 {
  return Pool.number_of_winners()
}

export function number_of_users(): i32 {
  return Users.get_total_users()
}


// Getters mostly for testing
export function get_user_tickets(idx: i32): u128 {
  return Users.user_staked[idx]
}

export function get_accum_weights(idx: i32): u128 {
  return Users.accum_weights[idx]
}

export function get_user_by_id(idx: i32): string {
  if (Users.uid_to_user.contains(idx)) { return Users.uid_to_user.getSome(idx) }
  return ""
}

export function get_to_unstake(): u128 {
  return External.get_to_unstake()
}


// DAO
export function get_pool_fees(): u8 {
  return DAO.get_pool_fees()
}

export function change_pool_fees(fees: u8): bool {
  return DAO.change_pool_fees(fees);
}

export function get_time_between_raffles(): u64 {
  return DAO.get_time_between_raffles()
}

export function change_time_between_raffles(time: u64): bool {
  return DAO.change_time_between_raffles(time);
}

export function get_epoch_wait(): u64 {
  return DAO.get_epoch_wait()
}

export function change_epoch_wait(epochs: u64): bool {
  return DAO.change_epoch_wait(epochs);
}

export function get_max_users(): i32 {
  return DAO.get_max_users()
}

export function change_max_users(max_users: i32): bool {
  return DAO.change_max_users(max_users);
}

export function get_min_deposit(): u128 {
  return DAO.get_min_deposit()
}

export function change_min_deposit(new_min_deposit: u128): bool {
  return DAO.change_min_deposit(new_min_deposit);
}

export function get_min_raffle(): u128 {
  return DAO.get_min_raffle()
}

export function change_min_raffle(new_min_raffle: u128): bool {
  return DAO.change_min_raffle(new_min_raffle);
}

export function get_max_raffle(): u128 {
  return DAO.get_max_raffle()
}

export function change_max_raffle(new_max_raffle: u128): bool {
  return DAO.change_max_raffle(new_max_raffle);
}

export function get_max_deposit(): u128 {
  return DAO.get_max_deposit()
}

export function change_max_deposit(new_max_deposit: u128): bool {
  return DAO.change_max_deposit(new_max_deposit);
}

export function get_guardian(): string {
  return DAO.get_guardian()
}

export function propose_new_guardian(guardian: string): bool {
  return DAO.propose_new_guardian(guardian)
}

export function accept_being_guardian(): bool {
  return DAO.accept_being_guardian()
}

// TOKEN
export function give_from_reserve(to: string, amount: u128): void {
  Pool.give_from_reserve(to, amount)
}