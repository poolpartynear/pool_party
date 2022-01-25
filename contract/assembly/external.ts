import { storage, context, u128, ContractPromise, logging } from "near-sdk-as";
import { TGAS, UNSTAKE_EPOCH } from './constants'
import * as DAO from './dao'
import * as Utils from './utils'
import * as Pool from './pool'


// Semaphore to interact with external pool
function is_interacting(): bool {
  return storage.getPrimitive<bool>('interacting', false)
}

export function start_interacting(): void {
  assert(!is_interacting(),
         "Already interacting with the validator")

  storage.set<bool>('interacting', true)
}

export function stop_interacting(): void {
  storage.set<bool>('interacting', false)
}

// Getters - Setters
export function get_to_unstake(): u128 {
  // Amount of tickets waiting to be unstaked
  if (storage.contains('to_unstake')) { return storage.getSome<u128>('to_unstake') }
  return u128.Zero
}

export function set_to_unstake(tickets: u128): void {
  storage.set<u128>('to_unstake', tickets)
}

export function get_current_turn(): u64 {
  // The current_turn increases by 1 each time we withdraw from external
  return storage.getPrimitive<u64>('current_turn', 0)
}

export function get_next_withdraw_turn(): u64 {
  // The withdraw_turn increases by 1 each time we unstake from external.
  // When a user unstakes, we asign them a withdraw turn. The user can
  // withdraw when current_turn is equal to their asigned turn
  return storage.getPrimitive<u64>('next_withdraw_turn', 1)
}

function get_next_withdraw_epoch(): u64 {
  return storage.getPrimitive<u64>('next_withdraw_epoch', context.epochHeight)
}

export function can_withdraw_external(): bool {
  return context.epochHeight >= get_next_withdraw_epoch()
}


// Interact external ----------------------------------------------------------
export function interact_external(): void {

  assert(!DAO.is_emergency(), 'We will be back soon')

  const external_action: string = storage.getPrimitive<string>(
    'external_action', 'unstake'
  )
  
  if (external_action == 'withdraw') {
    withdraw_external()
  } else {
    unstake_external()
  }
}

// Withdraw external ----------------------------------------------------------
function withdraw_external(): void {
  assert(context.prepaidGas >= 300 * TGAS, "Not enough gas")

  // Check that 4 epochs passed from the last unstake from external
  const withdraw_epoch: u64 = get_next_withdraw_epoch()
  assert(context.epochHeight >= withdraw_epoch, "Not enough time has passed")

  // Check if we are already interacting, if not, set it to true()
  start_interacting()

  // withdraw money from external pool
  const promise = ContractPromise.create(DAO.get_external_pool(), "withdraw_all", "",
    120 * TGAS, u128.Zero)
  const callbackPromise = promise.then(context.contractName, "withdraw_external_callback",
    "", 120 * TGAS)
  callbackPromise.returnAsResult()
}

export function withdraw_external_callback(): bool {
  const response = Utils.get_callback_result()

  if (response.status == 1) {
    // Everything worked, next time we want to unstake
    storage.set<string>('external_action', 'unstake')
    storage.set<u64>('current_turn', get_current_turn() + 1)
  }

  stop_interacting()
  return true
}


// Unstake external -----------------------------------------------------------
@nearBindgen
class AmountArg {
  constructor(public user: string, public amount: u128) { }
}

function unstake_external(): void {
  assert(context.prepaidGas >= 300 * TGAS, "Not enough gas")

  // Check if we are already interacting, if not, set it to true
  const to_unstake: u128 = get_to_unstake()

  if (to_unstake == u128.Zero) {
    logging.log("Nobody asked to unstake their tickets, we will wait")
  } else {
    start_interacting()

    // There are tickets to unstake  
    const args: AmountArg = new AmountArg("", to_unstake)

    // If someone wants to unstake, they will get the next turn
    storage.set<u64>('next_withdraw_turn', get_next_withdraw_turn() + 1)

    const promise = ContractPromise.create(
      DAO.get_external_pool(), "unstake", args.encode(),
      120 * TGAS, u128.Zero)

    const callbackPromise = promise.then(
      context.contractName, "unstake_external_callback",
      args.encode(), 120 * TGAS
    )

    callbackPromise.returnAsResult();
  }
}

export function unstake_external_callback(_user:string, amount:u128): bool {
  const response = Utils.get_callback_result()

  if (response.status == 1) {
    // update the number of tickets in the pool
    Pool.set_tickets(Pool.get_tickets() - amount)

    // update the epoch in which we can withdraw
    storage.set<u64>('next_withdraw_epoch', context.epochHeight + UNSTAKE_EPOCH)

    // next time we want to withdraw
    storage.set<string>('external_action', 'withdraw')

    // Remove the amount we unstaked
    set_to_unstake(get_to_unstake() - amount)
  }else{
    // Rollback next_withdraw_turn
    storage.set<u64>('next_withdraw_turn', get_next_withdraw_turn() - 1)
  }

  stop_interacting()

  return true
}