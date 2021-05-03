import { PersistentVector, PersistentMap, u128, math } from "near-sdk-as";

// pool_tickets: u128
// last_prize_tmstmp: u64
// total_users: u64

@nearBindgen
export class Pool{
  constructor(public total_staked:u128,
              public reserve:u128,
              public prize:u128,
              public next_prize_tmstmp:u64,
              public withdraw_ready:true){}
}

@nearBindgen
export class User{
  constructor(public staked_balance:u128,
              public unstaked_balance:u128,
              public available_when:u64=0,
              public available:bool=false){}
}

@nearBindgen
export class Winner{
  constructor(public account_id:string,
              public amount:u128){}
}

export const user_to_idx = new PersistentMap<string, i32>('a')
export const idx_to_user = new PersistentMap<i32, string>('g')
export let user_tickets = new PersistentVector<u128>('b')
export let accum_weights = new PersistentVector<u128>('c')
export let user_unstaked = new PersistentVector<u128>('d')
export let user_withdraw_turn = new PersistentVector<u64>('e')
export let winners = new PersistentVector<Winner>('f')
