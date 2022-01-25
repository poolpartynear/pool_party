import { u128, math } from 'near-sdk-as'
import { user_tickets, accum_weights } from "./model"

// Notes:
// user_tickets has the tickets of each user
// accum_weights has the accumulated number of tickets
//               for a user and their child nodes

export function tickets_of(idx:i32): u128{
  if(user_tickets.length > idx){
    return user_tickets[idx]
  }
  return u128.Zero  
}

export function add_user(idx: i32): void{
  assert(idx == user_tickets.length, "internal error")
  accum_weights.push(u128.Zero)
  user_tickets.push(u128.Zero)
}


// Add and remove
export function remove_from(idx: i32, amount: u128): void{
  user_tickets[idx] = user_tickets[idx] - amount
  accum_weights[idx] = accum_weights[idx] - amount

  while (idx != 0) {
    idx = (idx - 1) / 2
    accum_weights[idx] = accum_weights[idx] - amount
  }
}

export function add_to(idx: i32, amount: u128): void{
  user_tickets[idx] = user_tickets[idx] + amount
  accum_weights[idx] = accum_weights[idx] + amount

  while (idx != 0) {
    idx = (idx - 1) / 2
    accum_weights[idx] = accum_weights[idx] + amount
  }
}

// Functions to choose a random winner

export function random_u128(min_inc: u128, max_exc: u128): u128 {
  // Returns a random number between min (included) and max (excluded)
  return u128.from(math.randomBuffer(16)) % (max_exc - min_inc) + min_inc
}

export function choose_random_winner(): i32{
  let winning_ticket: u128 = u128.Zero

  // accum_weights[0] has the total of tickets in the pool
  // user_tickets[0] is the tickets of the pool

  if (accum_weights[0] > user_tickets[0]) {
    // There are more tickets in the pool than just the reserve
    // Choose a winner excluding the reserve
    // i.e. Exclude numberes from 0 to user_tickets[0]
    winning_ticket = random_u128(user_tickets[0], accum_weights[0])
  }

  return find_user_with_ticket(winning_ticket)
}

export function find_user_with_ticket(winning_ticket: u128): i32 {
  // Gets the user with the winning ticket by searching in the binary tree.
  // This function enumerates the users in pre-order. This does NOT affect
  // the probability of winning, which is nbr_tickets_owned / tickets_total.
  let idx: i32 = 0

  while (true) {
    let left: i32 = idx*2 + 1
    let right: i32 = idx*2 + 2

    if (winning_ticket < user_tickets[idx]) {
      return idx
    }

    if (winning_ticket < user_tickets[idx] + accum_weights[left]) {
      winning_ticket = winning_ticket - user_tickets[idx]
      idx = left
    } else {
      winning_ticket = winning_ticket - user_tickets[idx] - accum_weights[left]
      idx = right
    }
  }
}