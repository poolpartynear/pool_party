import { u128 } from "near-sdk-as";
import { accum_weights, user_tickets } from './model'


export function random_u128(min_inc: u128, max_exc: u128): u128 {
  // Returns a random number between min (included) and max (excluded)
  return u128.from(math.randomBuffer(16)) % (max_exc - min_inc) + min_inc
}

export function select_winner(winning_ticket: u128): i32 {
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