import { deposit_and_stake_callback, deposit_and_stake, unstake,
         get_accum_weights, init } from '..';
import { get_tickets } from '../pool';
import { find_user_with_ticket } from '../tree'
import { get_to_unstake } from '../external';

import { Context, u128, VMContext } from "near-sdk-as";
import { DAO, get_external_pool, get_guardian } from '../dao';


const NEAR: u128 = u128.from("1000000000000000000000000")

// Aux function
function set_context(account_id: string, units: u128): void{
  const balance:u128 = u128.from(20)*NEAR
  VMContext.setPredecessor_account_id(account_id)
  VMContext.setAccount_balance(balance)
  VMContext.setAttached_deposit(units*NEAR)
  VMContext.setPrepaid_gas(300000000000000)
}

describe("Initializing", () => {
  it("cannot be initialized twice", () => {
    expect(()=>{init("pool", "guardian", "dao")}).not.toThrow()
    expect(()=>{init("e", "f", "g")}).toThrow()
    
    expect(get_guardian()).toBe("guardian")
    expect(DAO()).toBe("dao")
    expect(get_external_pool()).toBe("pool")
  })
})

describe("User Handling", () => {
  it("correctly updates total_stake, to_unstake variables", () => {

    init('external_pool', 'theguardian', 'dao' )  // init the contract

    // The guardian deposits first
    set_context('theguardian', u128.One)
    deposit_and_stake()

    // Poor man's callback simulation
    VMContext.setPredecessor_account_id(Context.contractName)
    deposit_and_stake_callback(0, u128.One*NEAR)

    for(let i=1; i < 3; i++){
      set_context(i.toString(), u128.from(i+1))
      deposit_and_stake()

      // Poor man's callback simulation
      VMContext.setPredecessor_account_id(Context.contractName)
      deposit_and_stake_callback(i, u128.from(i+1)*NEAR)
    }

    VMContext.setPredecessor_account_id("1")
    VMContext.setPrepaid_gas(300000000000000)
    unstake(u128.One*NEAR)

    expect(get_tickets()).toBe(u128.from(6)*NEAR, "Tickets updated wrong")
    expect(get_to_unstake()).toBe(u128.One*NEAR, "To unstake updated wrong")
  })
})


describe("Binary Tree", () => {
  it("correctly stores/selects users", () => {

    const subjects:i32 = 10
    const balance:u128 = u128.from("200000000000000000000")

    init('external_pool', 'theguardian', 'dao' )  // init the contract

    // The guardian deposits first
    set_context('theguardian', u128.One)
    deposit_and_stake()

    // Poor man's callback simulationd
    VMContext.setPredecessor_account_id(Context.contractName)
    deposit_and_stake_callback(0, u128.One)

    for(let i=1; i < subjects; i++){
      set_context(i.toString(), u128.from(i+1))
      deposit_and_stake()

      // Poor man's callback simulation
      VMContext.setPredecessor_account_id(Context.contractName)
      deposit_and_stake_callback(i, u128.from(i+1))
    }

    let expected_weights:Array<i32> = [55, 38, 16, 21, 15, 6, 7, 8, 9, 10]

    for(let i:i32=0; i < subjects; i++){
      expect(get_accum_weights(i)).toBe(u128.from(expected_weights[i]))
    }

    // Modify some of them
    deposit_and_stake_callback(5, u128.from(2))

    deposit_and_stake_callback(7, u128.from(1))
   
    expected_weights = [58, 39, 18, 22, 15, 8, 7, 9, 9, 10]

    for(let i:i32=0; i < subjects; i++){
      expect(get_accum_weights(i)).toBe(u128.from(expected_weights[i]))
    }

    deposit_and_stake_callback(3, u128.from(3))

    expected_weights = [61, 42, 18, 25, 15, 8, 7, 9, 9, 10]
    
    for(let i:i32=0; i < subjects; i++){
      expect(get_accum_weights(i)).toBe(u128.from(expected_weights[i]))
    }

    deposit_and_stake_callback(0, u128.from(1))

    expected_weights = [62, 42, 18, 25, 15, 8, 7, 9, 9, 10]

    for(let i:i32=0; i < subjects; i++){
      expect(get_accum_weights(i)).toBe(u128.from(expected_weights[i]))
    }

    VMContext.setPredecessor_account_id("8")
    VMContext.setPrepaid_gas(300000000000000)
    unstake(u128.from(1))
    
    expected_weights = [61, 41, 18, 24, 15, 8, 7, 9, 8, 10]
    
    for(let i:i32=0; i < subjects; i++){
      expect(get_accum_weights(i)).toBe(u128.from(expected_weights[i]))
    }

    VMContext.setPredecessor_account_id("4")
    VMContext.setPrepaid_gas(300000000000000)
    unstake(u128.from(3))

    expected_weights = [58, 38, 18, 24, 12, 8, 7, 9, 8, 10]

    for(let i:i32=0; i < subjects; i++){
      expect(get_accum_weights(i)).toBe(u128.from(expected_weights[i]))
    }

    expect(find_user_with_ticket(u128.from(0))).toBe(0, "wrong winner") 
    expect(find_user_with_ticket(u128.from(1))).toBe(0, "wrong winner") 
    expect(find_user_with_ticket(u128.from(2))).toBe(1, "wrong winner") 
    expect(find_user_with_ticket(u128.from(3))).toBe(1, "wrong winner") 
    expect(find_user_with_ticket(u128.from(40))).toBe(2, "wrong winner")
    expect(find_user_with_ticket(u128.from(41))).toBe(2, "wrong winner")
    expect(find_user_with_ticket(u128.from(4))).toBe(3, "wrong winner") 
    expect(find_user_with_ticket(u128.from(9))).toBe(3, "wrong winner") 
    expect(find_user_with_ticket(u128.from(44))).toBe(5, "wrong winner")
    expect(find_user_with_ticket(u128.from(50))).toBe(5, "wrong winner")
    expect(find_user_with_ticket(u128.from(51))).toBe(6, "wrong winner")
    expect(find_user_with_ticket(u128.from(52))).toBe(6, "wrong winner")
    expect(find_user_with_ticket(u128.from(57))).toBe(6, "wrong winner")
    expect(find_user_with_ticket(u128.from(11))).toBe(7, "wrong winner")
  });
})


describe("Reserve Guardian", () => {
  it("the reserve guardian must be the first user", () => {

    init('external_pool', 'theguardian', 'dao' )  // init the contract

    const balance:u128 = u128.from("200000000000000000000")

    // If someone besides the guardian goes first it fails
    set_context("notguardian", u128.One)
    expect(deposit_and_stake).toThrow()

    // It doesn't fail for the guardian
    set_context("theguardian", u128.One)
    expect(deposit_and_stake).not.toThrow()
  });
})