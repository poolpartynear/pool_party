import { PersistentVector, u128 } from "near-sdk-as";


@nearBindgen
export class PoolInfo {
  constructor(
    public total_staked: u128,
    public reserve: u128,
    public prize: u128,
    public next_prize_tmstmp: u64,
    public withdraw_ready: bool
  ) { }
}

@nearBindgen
export class UserAmountParams {
  constructor(public user: string, public amount: u128) { }
}

@nearBindgen
export class Winner {
  constructor(
    public account_id: string,
    public amount: u128,
    public when: u64
  ) { }
}

export let winners = new PersistentVector<Winner>('winners-a')