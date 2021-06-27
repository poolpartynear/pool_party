import { storage, context, u128, ContractPromise, logging } from "near-sdk-as";
import { TGAS, UNSTAKE_EPOCH } from './constants'
import * as DAO from './dao'
import * as Utils from './utils'
import * as Pool from './pool'


// Semaphore to interact with external pool
function is_interacting_with_external(): bool {
  return storage.getPrimitive<bool>('interacting', false)
}

function start_interacting_with_external(): void {
  storage.set<bool>('interacting', true)
}

function stop_interacting_with_external(): void {
  storage.set<bool>('interacting', false)
}

function fail_if_interacting_external(): void {
  assert(!is_interacting_with_external(), "Already interacting with external pool")
}


// Setters / Getters ----------------------------------------------------------
// ----------------------------------------------------------------------------
export function get_to_unstake(): u128 {
  // Amount of tickets waiting to be unstaked
  if (storage.contains('to_unstake')) { return storage.getSome<u128>('to_unstake') }
  return u128.Zero
}

export function set_to_unstake(tickets: u128): void {
  fail_if_interacting_external()
  storage.set<u128>('to_unstake', tickets)
}

export function get_current_turn(): u64 {
  // The current_turn increases by 1 each time we withdraw from external
  return storage.getPrimitive<u64>('current_turn', 0)
}

export function get_next_withdraw_turn(): u64 {
  // The withdraw_turn increases by 1 each time we unstake from external.
  // When a user unstakes, we asign them the withdraw turn. The user can
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
// ----------------------------------------------------------------------------
export function interact_external(): void {
  const external_action: string = storage.getPrimitive<string>('external_action',
    'unstake')
  if (external_action == 'withdraw') {
    withdraw_external()
  } else {
    unstake_external()
  }
}


// Withdraw external ----------------------------------------------------------
// ----------------------------------------------------------------------------
function withdraw_external(): void {
  assert(context.prepaidGas >= 300 * TGAS, "Not enough gas")

  // Check that 4 epochs passed from the last unstake from external
  const withdraw_epoch: u64 = get_next_withdraw_epoch()
  assert(context.epochHeight >= withdraw_epoch, "Not enough time has passed")

  // Check if we are already interacting, if not, set it to true
  fail_if_interacting_external()
  start_interacting_with_external()

  // withdraw money from external pool
  let promise = ContractPromise.create(DAO.get_external_pool(), "withdraw_all", "",
    120 * TGAS, u128.Zero)
  let callbackPromise = promise.then(context.contractName, "withdraw_external_cb",
    "", 120 * TGAS)
  callbackPromise.returnAsResult()
}

export function withdraw_external_cb(): bool {
  Utils.check_internal()

  const response = Utils.get_callback_result()

  if (response.status == 1) {
    // Everything worked, next time we want to unstake
    storage.set<string>('external_action', 'unstake')
    storage.set<u64>('current_turn', get_current_turn() + 1)
  }

  stop_interacting_with_external()
  return true
}


// Unstake external -----------------------------------------------------------
// ----------------------------------------------------------------------------
@nearBindgen
class AmountArg {
  constructor(public user: string, public amount: u128) { }
}

function unstake_external(): void {
  assert(context.prepaidGas >= 300 * TGAS, "Not enough gas")

  // Check if we are already interacting, if not, set it to true
  fail_if_interacting_external()
  start_interacting_with_external()

  const to_unstake: u128 = get_to_unstake()

  if (to_unstake == u128.Zero) {
    logging.log("Nobody asked to unstake their tickets, we will wait")
    stop_interacting_with_external()
    return
  } else {
    // There are tickets to unstake  
    let args: AmountArg = new AmountArg("", to_unstake)


    let promise = ContractPromise.create(DAO.get_external_pool(), "unstake", args.encode(),
      120 * TGAS, u128.Zero)

    let callbackPromise = promise.then(context.contractName, "unstake_external_cb",
      "", 120 * TGAS)
    callbackPromise.returnAsResult();
  }
}

export function unstake_external_cb(): bool {
  Utils.check_internal()

  const response = Utils.get_callback_result()

  if (response.status == 1) {
    // remove tickets from pool
    const to_unstake: u128 = get_to_unstake()
    const pool_tickets: u128 = Pool.get_tickets()

    // update the number of tickets in the pool
    assert(pool_tickets >= to_unstake, "Underflow error, please contact @poolparty")
    Pool.set_pool_tickets(pool_tickets - to_unstake)

    // update the epoch in which we can withdraw
    storage.set<u64>('next_withdraw_epoch', context.epochHeight + UNSTAKE_EPOCH)

    // next time we want to withdraw
    storage.set<string>('external_action', 'withdraw')

    // A turn passed
    storage.set<u64>('next_withdraw_turn', get_next_withdraw_turn() + 1)

    // We unstaked from external, set to_unstake back to 0
    set_to_unstake(u128.Zero)
  }

  stop_interacting_with_external()

  return true
}