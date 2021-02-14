import {storage, context, env, u128, ContractPromise, ContractPromiseBatch,
        ContractPromiseResult, logging, math, PersistentVector} from "near-sdk-as";
import {user_to_idx, idx_to_user, user_tickets, accum_weights,
        user_unstaked, user_unstaked_tmstmp, winners, Pool, User} from "./model"

// Definitions ----------------------------------------------------------------
// ----------------------------------------------------------------------------
const unstake_wait:u64 = 259200000000000
const raffle_wait:u64 = 86400000000000
const fees:u128 = u128.from(100)
const POOL:string = "01node.pool.f863973.m0" //"test-account-1613037087253-4569549"
const MIN_GAS:u64 = 300000000000000

function check_internal():ContractPromiseResult{
  assert(context.predecessor == context.contractName, "Just don't")

  let results = ContractPromise.getResults() // Verify previous action succeed
  assert(results[0].status == 1, "Interaction with Pool failed, please try again later")
  return results[0]
}

function add_tickets_to_user_and_pool(idx:i32, amount:u128):void{
  user_tickets[idx] = user_tickets[idx] + amount
  accum_weights[idx] = accum_weights[idx] + amount

  while(idx != 0){
    idx = (idx-1)/2
    accum_weights[idx] = accum_weights[idx] + amount
  }

  // Update pool tickets
  storage.set<u128>('pool_tickets', get_pool_tickets() + amount)
}


// Getters for testing --------------------------------------------------------
// ----------------------------------------------------------------------------
export function get_pool_prize():u128{
  if(storage.contains('prize')){return storage.getSome<u128>('prize')}
  return u128.Zero
}

export function get_pool_tickets():u128{
  if(storage.contains('pool_tickets')){return storage.getSome<u128>('pool_tickets')}
  return u128.Zero
}

export function get_user_tickets(idx:i32):u128{
  return user_tickets[idx]
}

export function get_accum_weights(idx:i32):u128{
  return accum_weights[idx]
}

export function get_winners():Array<string>{
  let size:i32 = winners.length
  
  let lower:i32 = 0
  if(size >= 10){ let lower:i32 = size - 10 }

  let to_return:Array<string> = []
  for(let i:i32=lower; i < size; i++){to_return.push(winners[i])}
  return to_return
}

// Get Pool Info --------------------------------------------------------------
// ----------------------------------------------------------------------------
export function get_pool_info():Pool{
  const tickets:u128 = get_pool_tickets()
  const next_raffle:u64 = storage.getPrimitive<u64>('nxt_raffle_tmstmp', 0)
  const prize:u128 = get_pool_prize()
  return new Pool(tickets, prize, next_raffle)
}


// Update Pool Prize ----------------------------------------------------------
// ----------------------------------------------------------------------------
@nearBindgen
class PoolArgs{
  constructor(public account_id:string){}
}

export function update_prize():void{
  assert(context.prepaidGas >= MIN_GAS, "Not enough gas")

  let args:PoolArgs = new PoolArgs(context.contractName)

  let promise = ContractPromise.create(POOL, "get_account", args.encode(),
                                       12000000000000, u128.Zero)
  let callbackPromise = promise.then(context.contractName, "_update_prize",
                                     "", 15000000000000)
  callbackPromise.returnAsResult();
}

export function _update_prize():bool{
  let reverseResult = check_internal()

  const our_user_in_pool = decode<User>(reverseResult.buffer);
  const tickets:u128 = get_pool_tickets()

  let prize:u128 = u128.Zero
  if(our_user_in_pool.staked_balance > tickets){
      prize = our_user_in_pool.staked_balance - tickets 
  }

  logging.log("prize: " + prize.toString())
  storage.set<u128>('prize', prize)
  return true
}

// Get account ----------------------------------------------------------------
// ----------------------------------------------------------------------------
export function get_account(account_id: string): User{
  if(!user_to_idx.contains(account_id)){
    return new User(u128.Zero, u128.Zero, false)
  }

  const idx:i32 = user_to_idx.getSome(account_id)
  const tickets:u128 = user_tickets[idx]
  const unstaked:u128 = user_unstaked[idx]

  // If 3 days have passed, then the money is available 
  const when:u64 = user_unstaked_tmstmp[idx]
  let now:u64 = env.block_timestamp()
  const available:bool = unstaked > u128.Zero && now > when

  return new User(tickets, unstaked, when, available)
}

// Deposit and stake ----------------------------------------------------------
// ----------------------------------------------------------------------------

@nearBindgen
class AmountArg{
  constructor(public amount:u128){}
}

export function deposit_and_stake():void{
  assert(context.prepaidGas >= MIN_GAS, "Not enough gas")

  let amount: u128 = context.attachedDeposit

  let promise:ContractPromise = ContractPromise.create(
      POOL, "deposit_and_stake", "{}", 100000000000000, amount
  )

  let ret_args:AmountArg = new AmountArg(amount)
  let callbackPromise = promise.then(context.contractName, "_deposit_and_stake",
                                     ret_args.encode(), 100000000000000)
  callbackPromise.returnAsResult();
}

export function _deposit_and_stake(amount:u128):bool{
  check_internal()

  let idx:i32 = 0

  if(user_to_idx.contains(context.sender)){
    logging.log("Staking on existing user: " + idx.toString())
    idx = user_to_idx.getSome(context.sender)
  }else{
    idx = storage.getPrimitive<i32>('total_users', 0)
    storage.set<i32>('total_users', idx+1)
    
    logging.log("Creating user: " + idx.toString())
    user_to_idx.set(context.sender, idx)
    idx_to_user.set(idx, context.sender)
    user_tickets.push(u128.Zero)
    accum_weights.push(u128.Zero)
    user_unstaked.push(u128.Zero)
    user_unstaked_tmstmp.push(0)
  }
  
  // Update binary tree and pool
  add_tickets_to_user_and_pool(idx, amount)

  return true
}

// Unstake --------------------------------------------------------------------
// ----------------------------------------------------------------------------
@nearBindgen
class IntArgs{
  constructor(public idx:i32, public amount:u128){}
}

export function unstake(amount:u128):void{
  assert(context.prepaidGas >= MIN_GAS, "Not enough gas")

  assert(user_to_idx.contains(context.sender), "User dont exist")

  // Get user info
  let idx:i32 = user_to_idx.getSome(context.sender)
  let tickets:u128 = user_tickets[idx]

  //Check if it has enough money
  assert(amount <= tickets, "Not enough money")
  
  // CALL POOL UNSTAKE
  let uargs:AmountArg = new AmountArg(amount)
  let promise = ContractPromise.create(POOL, "unstake", uargs.encode(),
                                       120000000000000, u128.Zero)

  let iargs:IntArgs = new IntArgs(idx, amount)
  let callbackPromise = promise.then(context.contractName, "_unstake",
                                     iargs.encode(), 120000000000000)
  callbackPromise.returnAsResult();
}

export function _unstake(idx:i32, amount:u128):bool{
  check_internal()

  logging.log("Unstaking "+ amount.toString() +" from user "+ idx.toString())

  // update User
  user_tickets[idx] = user_tickets[idx] - amount
  user_unstaked[idx] = user_unstaked[idx] + amount
  user_unstaked_tmstmp[idx] = env.block_timestamp() + unstake_wait

  // update tree
  accum_weights[idx] = accum_weights[idx] - amount

  while(idx != 0){
    idx = (idx-1)/2
    accum_weights[idx] = accum_weights[idx] - amount
  }

  // update pool
  storage.set<u128>('pool_tickets', get_pool_tickets() - amount)

  return true
}


// --- Withdraw all
// ----------------------------------------------------------------------------
export function withdraw_all():void{
  assert(context.prepaidGas >= MIN_GAS, "Not enough gas")

  assert(user_to_idx.contains(context.sender), "User dont exist")

  let idx:i32 = user_to_idx.getSome(context.sender)
  let amount:u128 = user_unstaked[idx] 
  assert(amount > u128.Zero, "Nothing to unstake")

  let now:u64 = env.block_timestamp()
  assert(now > user_unstaked_tmstmp[idx], "Withdraw not ready")

  let iargs:IntArgs = new IntArgs(idx, amount)

  ContractPromiseBatch.create(POOL)
  .function_call("withdraw_all", "", u128.Zero, 9000000000000)
  .then(context.contractName)
  .function_call("_withdraw_all", iargs.encode(), u128.Zero, 200000000000000)
}

export function _withdraw_all(idx:i32, amount:u128):void{
  check_internal()

  let iargs:IntArgs = new IntArgs(idx, amount)
  
  ContractPromiseBatch.create(context.sender)
  .transfer(amount)
  .then(context.contractName)
  .function_call("__withdraw_all", iargs.encode(), u128.Zero, 100000000000000)
}

export function __withdraw_all(idx:i32, amount:u128):void{
  check_internal()
  user_unstaked[idx] = u128.Zero
  logging.log("Sent " + amount.toString() + " to " + context.sender)
}


// Raffle ---------------------------------------------------------------------
// ----------------------------------------------------------------------------
export function random_u128(max:u128):u128{
  return u128.from(math.randomBuffer(16)) % max
}

export function raffle():i32{
  let now:u64 = env.block_timestamp()

  let next_raffle:u64 = storage.getPrimitive<u64>('nxt_ruffle_tmstmp', 0)

  assert(now >= next_raffle, "Not enough time has passed")

  let pool_tickets:u128 = get_pool_tickets()
  let winning_ticket:u128 = random_u128(pool_tickets)
  
  let winner:i32 = select_winner(winning_ticket)
  let prize:u128 = get_pool_prize()

  // We keep a small percent
  let house_prize:u128 = prize/fees
  add_tickets_to_user_and_pool(0, house_prize)

  // We give most to the user
  let user_prize:u128 = prize - house_prize
  add_tickets_to_user_and_pool(winner, user_prize)

  logging.log("Fees: " + house_prize.toString() + " Prize: " + user_prize.toString())

  // Set next raffle time
  storage.set<u64>('nxt_raffle_tmstmp', now + raffle_wait)
  storage.set<u128>('prize', u128.Zero)

  let winner_name:string = idx_to_user.getSome(winner)
  winners.push(winner_name)
  return winner
}

export function select_winner(winning_ticket:u128):i32{
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
