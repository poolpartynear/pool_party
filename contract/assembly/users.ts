import { u128, math, PersistentMap, PersistentVector, storage, logging } from 'near-sdk-as'

// Memory persistent structures
export const user_to_uid = new PersistentMap<string, i32>('users-a')
export const uid_to_user = new PersistentMap<i32, string>('users-b')
export let user_staked = new PersistentVector<u128>('users-c')
export let accum_weights = new PersistentVector<u128>('users-d') // accumulated number of tickets for a node and their child
export let user_unstaked = new PersistentVector<u128>('users-e')
export let user_withdraw_turn = new PersistentVector<u64>('users-f')

export let vacancies = new PersistentVector<i32>('users-g') // When a user leaves, anyone can take their place


// User structure
@nearBindgen
export class User {
  constructor(public staked_balance: u128,
    public unstaked_balance: u128,
    public available_when: u64 = 0,
    public available: bool = false) { }
}


// Getters
export function is_registered(user: string): bool {
  return user_to_uid.contains(user)
}

export function get_user_uid(user: string): i32 {
  return user_to_uid.getSome(user)
}

export function get_staked_for(user: string): u128 {
  if (is_registered(user)) {
    const uid: i32 = get_user_uid(user)
    return user_staked[uid]
  }
  return u128.Zero
}

export function get_unstaked_for(user: string): u128 {
  if (is_registered(user)) {
    const uid: i32 = get_user_uid(user)
    return user_unstaked[uid]
  }
  return u128.Zero
}

export function get_withdraw_turn_for(user: string): u64 {
  const uid: i32 = get_user_uid(user)
  return user_withdraw_turn[uid]
}

export function get_total_users(): i32 {
  return storage.getPrimitive<i32>('total_users', 0)
}

// Setters
export function take_over_guardian(new_guardian: string): void {
  user_to_uid.set(new_guardian, 0)
  uid_to_user.set(0, new_guardian)
}

export function set_withdraw_turn(user: string, turn: u64): void {
  const uid: i32 = user_to_uid.getSome(user)
  user_withdraw_turn[uid] = turn
}

// Add a user, Stake, Unstake and Withdraw all
export function add_new_user(user: string): i32 {
  let uid: i32 = 0

  if (vacancies.length > 0) {
    // We take the spot of someone that left
    logging.log("Taking the spot of someone that left")
    uid = vacancies.pop()
  } else {
    // We set the structures needed for a new user
    uid = storage.getPrimitive<i32>('total_users', 0)
    storage.set<i32>('total_users', uid + 1)

    user_unstaked.push(u128.Zero)
    user_withdraw_turn.push(0)
    accum_weights.push(u128.Zero)
    user_staked.push(u128.Zero)
  }

  user_to_uid.set(user, uid)
  uid_to_user.set(uid, user)

  return uid
}

export function stake_tickets_for(user: string, amount: u128): void {
  let uid: i32 = get_user_uid(user)

  user_staked[uid] = user_staked[uid] + amount
  accum_weights[uid] = accum_weights[uid] + amount

  while (uid != 0) {
    uid = (uid - 1) / 2
    accum_weights[uid] = accum_weights[uid] + amount
  }
}

export function remove_tickets_from(user: string, amount: u128): void {
  let uid: i32 = get_user_uid(user)
  user_staked[uid] = user_staked[uid] - amount
  accum_weights[uid] = accum_weights[uid] - amount

  while (uid != 0) {
    uid = (uid - 1) / 2
    accum_weights[uid] = accum_weights[uid] - amount
  }
}

export function unstake_tickets_for(user: string, amount: u128): void {
  let uid: i32 = get_user_uid(user)

  remove_tickets_from(user, amount)
  user_unstaked[uid] = user_unstaked[uid] + amount
}

export function withdraw_all_for(user: string): void {
  const uid: i32 = get_user_uid(user)

  user_unstaked[uid] = u128.Zero

  // Check if the user has tickets left, if not, we "remove" them
  if (user_staked[uid] == u128.Zero) {
    user_to_uid.delete(user)
    uid_to_user.delete(uid)
    user_withdraw_turn[uid] = 0
    vacancies.push(uid)
  }
}


// Functions to choose a random winner
export function random_u128(min_inc: u128, max_exc: u128): u128 {
  // Returns a random number between min (included) and max (excluded)
  return u128.from(math.randomBuffer(16)) % (max_exc - min_inc) + min_inc
}

export function choose_random_winner(): string {
  let winning_ticket: u128 = u128.Zero

  // accum_weights[0] has the total of tickets in the pool
  // user_staked[0] is the tickets of the pool

  if (accum_weights[0] > user_staked[0]) {
    // There are more tickets in the pool than just the reserve
    // Choose a winner excluding the reserve. i.e. Exclude range [0, user_staked[0])
    winning_ticket = random_u128(user_staked[0], accum_weights[0])
  }

  const uid: i32 = find_user_with_ticket(winning_ticket)
  return uid_to_user.getSome(uid)
}

export function find_user_with_ticket(winning_ticket: u128): i32 {
  // Gets the user with the winning ticket by searching in the binary tree.
  // This function enumerates the users in pre-order. This does NOT affect
  // the probability of winning, which is nbr_tickets_owned / tickets_total.
  let uid: i32 = 0

  while (true) {
    let left: i32 = uid * 2 + 1
    let right: i32 = uid * 2 + 2

    if (winning_ticket < user_staked[uid]) {
      return uid
    }

    if (winning_ticket < user_staked[uid] + accum_weights[left]) {
      winning_ticket = winning_ticket - user_staked[uid]
      uid = left
    } else {
      winning_ticket = winning_ticket - user_staked[uid] - accum_weights[left]
      uid = right
    }
  }
}