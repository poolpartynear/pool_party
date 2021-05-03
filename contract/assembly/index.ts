import {storage, context, env, u128, ContractPromise, ContractPromiseBatch,
        ContractPromiseResult, logging, math, PersistentVector} from "near-sdk-as";
import {user_to_idx, idx_to_user, user_tickets, accum_weights,
        user_unstaked, user_withdraw_turn, winners,
        Pool, User, Winner} from "./model"

// The raffle happens once per day
const raffle_wait:u64 = 86400000000000

// We take a 5% of the raffle
const fees:u128 = u128.from(20)

// The minimum gas needed to call each function
const MIN_GAS:u64 = 300000000000000

// Amount of epochs to wait before unstaking again
const UNSTAKE_EPOCH:u64 = 4

// The external pool stakes around 100yn less than what the user stakes
const STAKE_PRICE:u128 = u128.from(100)

// The external pool
const POOL:string = "blazenet.pool.f863973.m0"

// The first guardian
const GUARDIAN:string = 'pooltest.testnet'


// Getters --------------------------------------------------------------------
// ----------------------------------------------------------------------------
export function get_account(account_id: string): User{
  // Returns information for the account 'account_id'
  if(!user_to_idx.contains(account_id)){
    return new User(u128.Zero, u128.Zero, false)
  }

  const idx:i32 = user_to_idx.getSome(account_id)
  const tickets:u128 = user_tickets[idx]
  const unstaked:u128 = user_unstaked[idx]

  const when:u64 = user_withdraw_turn[idx]
  let now:u64 = get_current_turn()
  
  // Compute remining time for withdraw to be ready
  let remining:u64 = 0
  if(when >= now){ remining = when - now }

  const available:bool = unstaked > u128.Zero && now >= when

  return new User(tickets, unstaked, remining, available)
}

export function get_current_turn():u64{
  // The current_turn increases by 1 each time we withdraw from external
  return storage.getPrimitive<u64>('current_turn', 0)
}

export function next_withdraw_turn():u64{
  // The withdraw_turn increases by 1 each time we unstake from external
  // when a user unstakes, we asign them the withdraw turn. The user can
  // withdraw when current_turn is equal to their asigned turn 
  return storage.getPrimitive<u64>('next_withdraw_turn', 1)
}

export function get_pool_info():Pool{
  // Returns the: amount of tickets in the pool, current prize, 
  // next timestamp to do the raffle, and if we should call the external pool
  const tickets:u128 = get_pool_tickets() - get_to_unstake()
  const next_raffle:u64 = storage.getPrimitive<u64>('nxt_raffle_tmstmp', 0)
  const prize:u128 = get_pool_prize()
  
  const current_epoch:u64 = context.epochHeight
  const withdraw_epoch:u64 = storage.getPrimitive<u64>('next_withdraw_epoch',
                                                       context.epochHeight)
  let reserve: u128 = u128.Zero
  if(user_tickets.length > 0){ reserve = user_tickets[0] }

  const withdraw_from_external:bool = current_epoch >= withdraw_epoch
  return new Pool(tickets, reserve, prize, next_raffle, withdraw_from_external)
}

export function get_pool_prize():u128{
  if(storage.contains('prize')){return storage.getSome<u128>('prize')}
  return u128.Zero
}

export function get_pool_tickets():u128{
  if(storage.contains('pool_tickets')){
    return storage.getSome<u128>('pool_tickets')
  }
  return u128.Zero
}

export function get_to_unstake():u128{
  if(storage.contains('to_unstake')){return storage.getSome<u128>('to_unstake')}
  return u128.Zero
}

export function get_winners():Array<Winner>{
  // Returns the last 10 winners
  let size:i32 = winners.length

  let lower:i32 = 0
  if(size >= 10){ lower = size - 10 }

  let to_return:Array<Winner> = new Array<Winner>()
  for(let i:i32=lower; i < size; i++){to_return.push(winners[i])}
 
  return to_return
}

export function get_user_tickets(idx:i32):u128{ return user_tickets[idx] }

export function get_accum_weights(idx:i32):u128{ return accum_weights[idx] }


// Check internal function ----------------------------------------------------
// ----------------------------------------------------------------------------
function check_internal():void{
  // Check that callback functions are called by this contract
  assert(context.predecessor == context.contractName, "Just don't")
}

function get_callback_result():ContractPromiseResult{
  // Return the result from the external pool
  let results = ContractPromise.getResults()

  if(results.length > 0){ return results[0] }
  
  // Function is being called directly by our contract => TESTING
  return new ContractPromiseResult(1)
}


// Update Pool Prize ----------------------------------------------------------
// ----------------------------------------------------------------------------
@nearBindgen
class PoolArgs{
  constructor(public account_id:string){}
}

export function update_prize():void{
  assert(context.prepaidGas >= MIN_GAS, "Not enough gas")
  
  // Ask how many NEARs we have staked in the external pool
  let args:PoolArgs = new PoolArgs(context.contractName)

  let promise = ContractPromise.create(POOL, "get_account", args.encode(),
                                       12000000000000, u128.Zero)
  let callbackPromise = promise.then(context.contractName, "_update_prize",
                                     "", 15000000000000)
  callbackPromise.returnAsResult();
}

export function _update_prize():bool{
  check_internal()
  let info = get_callback_result()

  if(info.status != 1){
    // We didn't manage to get information from the pool
    return false
  }

  const our_user_in_pool = decode<User>(info.buffer);
  const tickets:u128 = get_pool_tickets()

  // The difference between the staked_balance in the external pool and the
  // tickets we have in our pool is the prize
  let prize:u128 = u128.Zero
  if(our_user_in_pool.staked_balance > tickets){
      prize = our_user_in_pool.staked_balance - tickets 
  }

  logging.log("prize: " + prize.toString())
  storage.set<u128>('prize', prize)
  return true
}


// Deposit and stake ----------------------------------------------------------
// ----------------------------------------------------------------------------
function stake_tickets_for(idx:i32, amount:u128):void{
  // Add amount of tickets to the user in the position idx  
  user_tickets[idx] = user_tickets[idx] + amount
  accum_weights[idx] = accum_weights[idx] + amount

  // Update the accumulative weights in the binary tree
  while(idx != 0){
    idx = (idx-1)/2
    accum_weights[idx] = accum_weights[idx] + amount
  }

  // Update pool tickets
  storage.set<u128>('pool_tickets', get_pool_tickets() + amount)
}

@nearBindgen
class AmountArg{
  constructor(public user:string, public amount:u128){}
}

export function deposit_and_stake():void{
  // Function called by users to buy tickets
  assert(context.prepaidGas >= MIN_GAS, "Not enough gas")

  const N:i32 = storage.getPrimitive<i32>('total_users', 0)

  if(N == 0){
    assert(context.predecessor == GUARDIAN, "Let the GUARDIAN deposit first")
  }

  let amount: u128 = context.attachedDeposit 

  // Deposit the money in the external pool
  // We add 100yn to cover the cost of staking in an external pool
  let promise:ContractPromise = ContractPromise.create(
      POOL, "deposit_and_stake", "{}", 100000000000000, amount + STAKE_PRICE
  )
  
  // Create a callback to _deposit_and_stake
  let ret_args:AmountArg = new AmountArg(context.predecessor, amount)
  let callbackPromise = promise.then(context.contractName, "_deposit_and_stake",
                                     ret_args.encode(), 100000000000000)
  callbackPromise.returnAsResult();
}

export function _deposit_and_stake(user:string, amount:u128):bool{
  check_internal()

  let response = get_callback_result()
 
  // Assert the response is successful, so the user gets back the money if not
  assert(response.status == 1, "Error when interacting with external pool")

  // We add the users in Level Order so the tree is always balanced
  let idx:i32 = 0

  if(user_to_idx.contains(user)){
    logging.log("Staking on existing user: " + idx.toString())
    idx = user_to_idx.getSome(user)
  }else{
    idx = storage.getPrimitive<i32>('total_users', 0)
    storage.set<i32>('total_users', idx+1)
    
    logging.log("Creating user: " + idx.toString())
    user_to_idx.set(user, idx)
    idx_to_user.set(idx, user)
    user_tickets.push(u128.Zero)
    accum_weights.push(u128.Zero)
    user_unstaked.push(u128.Zero)
    user_withdraw_turn.push(0)
  }
  
  // Update binary tree and pool
  stake_tickets_for(idx, amount)

  return true
}


// Unstake --------------------------------------------------------------------
// ----------------------------------------------------------------------------
export function unstake(amount:u128):bool{
  assert(context.prepaidGas >= MIN_GAS, "Not enough gas")

  assert(user_to_idx.contains(context.predecessor), "User dont exist")

  // Get user info
  let idx:i32 = user_to_idx.getSome(context.predecessor)

  // Check if it has enough money
  assert(amount <= user_tickets[idx], "Not enough money")

  logging.log("Unstaking "+ amount.toString() +" from user "+ idx.toString())

  // add to the amount we will unstake next time
  storage.set<u128>('to_unstake', get_to_unstake() + amount)

  // the user will be able to in the next withdraw_turn
  user_withdraw_turn[idx] = next_withdraw_turn()

  // update user info
  user_tickets[idx] = user_tickets[idx] - amount
  user_unstaked[idx] = user_unstaked[idx] + amount

  // update binary tree
  accum_weights[idx] = accum_weights[idx] - amount

  while(idx != 0){
    idx = (idx-1)/2
    accum_weights[idx] = accum_weights[idx] - amount
  }

  return true
}


// Withdraw all ---------------------------------------------------------------
// ----------------------------------------------------------------------------
@nearBindgen
class IntArgs{
  constructor(public idx:i32, public amount:u128){}
}

export function withdraw_all():void{
  // Function called by the user to withdraw their staked NEARs
  assert(context.prepaidGas >= MIN_GAS, "Not enough gas")

  assert(user_to_idx.contains(context.predecessor), "User dont exist")

  let idx:i32 = user_to_idx.getSome(context.predecessor)

  assert(get_current_turn() >= user_withdraw_turn[idx], "Withdraw not ready")

  let amount:u128 = user_unstaked[idx] 
  assert(amount > u128.Zero, "Nothing to unstake")

  user_unstaked[idx] = u128.Zero

  // Send money to the user and callback _withdraw_all to see it succeded
  let iargs:IntArgs = new IntArgs(idx, amount) 
  ContractPromiseBatch.create(context.predecessor)
  .transfer(amount)
  .then(context.contractName)
  .function_call("_withdraw_all", iargs.encode(), u128.Zero, 100000000000000)
}

export function _withdraw_all(idx:i32, amount:u128):void{
  check_internal()

  let response = get_callback_result()

  if(response.status == 1){
    logging.log("Sent " + amount.toString() + " to " + idx_to_user[idx])
  }else{
    user_unstaked[idx] = amount  // It failed, add unstaked back to user
  }
}


// Interact external ----------------------------------------------------------
// ----------------------------------------------------------------------------
export function interact_external():void{
  const current_action:string = storage.getPrimitive<string>('external_action',
                                                             'unstake')
  if(current_action == 'withdraw'){
    withdraw_external()
  }else{
    unstake_external()
  }

}

function fail_if_already_interacting():void{
  const interacting:bool = storage.getPrimitive<bool>('interacting', false)
  assert(interacting == false, "Already interacting with external pool")
}


// Withdraw external ----------------------------------------------------------
// ----------------------------------------------------------------------------
function withdraw_external():void{
  // Function to call every 4 epochs to withdraw NEARs from the external pool
  const withdraw_epoch:u64 = storage.getPrimitive<u64>('next_withdraw_epoch',
                                                       context.epochHeight)
  assert(context.epochHeight >= withdraw_epoch, "Not enough time has passed")

  // Check if we are already interacting, if not, set it to true
  fail_if_already_interacting()
  storage.set<bool>('interacting', true)

  // withdraw money from external pool
  let promise = ContractPromise.create(POOL, "withdraw_all", "",
                                       120000000000000, u128.Zero)
  let callbackPromise = promise.then(context.contractName, "_withdraw_external",
                                     "", 120000000000000)
  callbackPromise.returnAsResult()
}

export function _withdraw_external():bool{
  check_internal()

  const response = get_callback_result()

  if(response.status == 1){
    // Everything worked, next time we want to unstake
    storage.set<string>('external_action', 'unstake')
    storage.set<u64>('current_turn', get_current_turn() + 1)
  }

  storage.set<bool>('interacting', false)
  return true
}


// Unstake external -----------------------------------------------------------
// ----------------------------------------------------------------------------
function unstake_external():void{
  assert(context.prepaidGas >= MIN_GAS, "Not enough gas")
    
  // Check if we are already interacting, if not, set it to true
  fail_if_already_interacting()
  storage.set<bool>('interacting', true)

  const to_unstake:u128 = get_to_unstake()

  if(to_unstake == u128.Zero){
    logging.log("Nobody asked to unstake their tickets, we will wait")
    storage.set<bool>('interacting', false)
    return
  }else{
    // There are tickets to unstake  
    let args:AmountArg = new AmountArg("", to_unstake)

    // Reset to_unstake, to avoid multiple unstakes. **Rollback if fails**
    storage.set<u128>('to_unstake', u128.Zero)

    let promise = ContractPromise.create(POOL, "unstake", args.encode(),
                                         120000000000000, u128.Zero)

    let callbackPromise = promise.then(context.contractName, "_unstake_external",
                                       args.encode(), 120000000000000)
    callbackPromise.returnAsResult();
  }
}

export function _unstake_external(_user:string, amount:u128):bool{
  check_internal()

  const response = get_callback_result()

  if(response.status == 1){
    // remove tickets from pool
    storage.set<u128>('pool_tickets', get_pool_tickets() - amount)

    // update the epoch in which we can withdraw
    storage.set<u64>('next_withdraw_epoch', context.epochHeight + UNSTAKE_EPOCH)

    // next time we want to withdraw
    storage.set<string>('external_action', 'withdraw')

    // A turn passed
    storage.set<u64>('next_withdraw_turn', next_withdraw_turn() + 1)
  }else{
    // Rollback to_unstake
    storage.set<u128>('to_unstake', amount)
  }

  storage.set<bool>('interacting', false)

  return true
}


// Raffle ---------------------------------------------------------------------
// ----------------------------------------------------------------------------
export function random_u128(min_inc:u128, max_exc:u128):u128{
  // Returns a random number between min (included) and max (excluded)
  return u128.from(math.randomBuffer(16)) % (max_exc - min_inc) + min_inc
}

export function raffle():i32{
  // Function to make the raffle
  let now:u64 = env.block_timestamp()

  let next_raffle:u64 = storage.getPrimitive<u64>('nxt_ruffle_tmstmp', 0)

  assert(now >= next_raffle, "Not enough time has passed")

  // If the total amount of accumulated tickets is equal to the tickets of
  // the reserve, then nobody is playing. Pick the ticket 0 so the reserve wins
  let winning_ticket:u128 = u128.Zero

  if(accum_weights[0] > user_tickets[0]){
    // Raffle between all the tickets, excluding those from the reserve
    // i.e. exclude the tickets numbered from 0 to user_tickets[0]
    winning_ticket = random_u128(user_tickets[0], accum_weights[0])
  }

  // Retrieve the winning user from the binary tree
  let winner:i32 = select_winner(winning_ticket)
  let prize:u128 = get_pool_prize()

  // A part goes to the reserve
  let reserve:u128 = prize / fees
  stake_tickets_for(0, reserve)

  // We give most to the user
  let user_prize:u128 = prize - reserve
  stake_tickets_for(winner, user_prize)

  logging.log("Reserve: " + reserve.toString() + " Prize: " + user_prize.toString())

  // Set next raffle time
  storage.set<u64>('nxt_raffle_tmstmp', now + raffle_wait)
  storage.set<u128>('prize', u128.Zero)

  let winner_name:string = idx_to_user.getSome(winner)
  winners.push(new Winner(winner_name, user_prize))
  return winner
}

export function select_winner(winning_ticket:u128):i32{
  // Gets the user with the winning ticket by searching in the binary tree.
  // This function enumerates the users in pre-order. This does NOT affect
  // the probability of winning, which is nbr_tickets_owned / tickets_total.
  let idx:i32 = 0

  while(true){
    let left:i32 = idx*2 + 1
    let right:i32 = idx*2 + 2

    if(winning_ticket < user_tickets[idx]){
      return idx
    }

    if(winning_ticket < user_tickets[idx] + accum_weights[left]){
      winning_ticket = winning_ticket - user_tickets[idx]
      idx = left
    }else{
      winning_ticket = winning_ticket - user_tickets[idx] - accum_weights[left]
      idx = right
    }
  }
}
