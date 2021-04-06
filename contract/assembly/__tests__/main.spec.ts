import { random_u128, _deposit_and_stake, deposit_and_stake, unstake,
         get_user_tickets, get_accum_weights, select_winner,
         get_account } from '..';
import { storage, Context, u128, logging, VMContext,
         ContractPromiseResult } from "near-sdk-as";

describe("Random", () => {
  it("should be random", () => {
    let trials = 100
    let max = 10
    let numbers = new Array<i32>()
    
    for(let i=0; i < max; i++){numbers.push(0)}

    for(let i=0; i < trials; i++){
      let rnd:u128 = random_u128(u128.Zero, u128.from(max))

      expect(rnd >= u128.Zero && u128.from(max) > rnd)

      for(let j=0; j < max; j++){
        if(rnd == u128.from(j)){ numbers[j] = numbers[j] + 1 }
      }
    }

    for(let i=0; i < max; i++){
      expect(numbers[i] > 5 && numbers[i] < 15).toBe(true)
    }
  });
});

describe("Random", () => {
  it("should be random from a min to a max", () => {
    let trials = 100
    let min = 3
    let max = 13
    let total = 15
    let numbers = new Array<i32>()
    
    for(let i=0; i < total; i++){numbers.push(0)}

    for(let i=0; i < trials; i++){
      let rnd:u128 = random_u128(u128.from(min), u128.from(max))

      expect(rnd >= u128.Zero && u128.from(max) > rnd)

      for(let j=0; j < total; j++){
        if(rnd == u128.from(j)){ numbers[j] = numbers[j] + 1 }
      }
    }
    for(let i=0; i < min; i++){ expect(numbers[i] == 0 ).toBe(true) }

    for(let i=min; i < max; i++){
      expect(numbers[i] > 5 && numbers[i] < 15).toBe(true)
    }

    for(let i=max; i < total; i++){ expect(numbers[i] == 0 ).toBe(true) }
  });
});



describe("Binary Tree", () => {
  it("correctly stores/selects users", () => {

    VMContext.setPredecessor_account_id(Context.contractName)

    const subjects:i32 = 10
    for(let i=0; i < subjects; i++){
      VMContext.setSigner_account_id(i.toString())
      _deposit_and_stake(u128.from(i+1))
    }
    
    let expected_weights:Array<i32> = [55, 38, 16, 21, 15, 6, 7, 8, 9, 10]
    
    for(let i:i32=0; i < subjects; i++){
      expect(get_accum_weights(i)).toBe(u128.from(expected_weights[i]))
    }

    // Modify some of them
    VMContext.setSigner_account_id("5")
    _deposit_and_stake(u128.from(2))

    VMContext.setSigner_account_id("7")
    _deposit_and_stake(u128.from(1))
   
    expected_weights = [58, 39, 18, 22, 15, 8, 7, 9, 9, 10]

    for(let i:i32=0; i < subjects; i++){
      expect(get_accum_weights(i)).toBe(u128.from(expected_weights[i]))
    }

    VMContext.setSigner_account_id("3")
    _deposit_and_stake(u128.from(3))

    expected_weights = [61, 42, 18, 25, 15, 8, 7, 9, 9, 10]
    
    for(let i:i32=0; i < subjects; i++){
      expect(get_accum_weights(i)).toBe(u128.from(expected_weights[i]))
    }

    VMContext.setSigner_account_id("0")
    _deposit_and_stake(u128.from(1))

    expected_weights = [62, 42, 18, 25, 15, 8, 7, 9, 9, 10]

    for(let i:i32=0; i < subjects; i++){
      expect(get_accum_weights(i)).toBe(u128.from(expected_weights[i]))
    }

    VMContext.setSigner_account_id("8")
    VMContext.setPrepaid_gas(300000000000000)
    unstake(u128.from(1))
    
    expected_weights = [61, 41, 18, 24, 15, 8, 7, 9, 8, 10]
    
    for(let i:i32=0; i < subjects; i++){
      expect(get_accum_weights(i)).toBe(u128.from(expected_weights[i]))
    }

    VMContext.setSigner_account_id("4")
    VMContext.setPrepaid_gas(300000000000000)
    unstake(u128.from(3))

    expected_weights = [58, 38, 18, 24, 12, 8, 7, 9, 8, 10]

    for(let i:i32=0; i < subjects; i++){
      expect(get_accum_weights(i)).toBe(u128.from(expected_weights[i]))
    }

    expect(select_winner(u128.from(0))).toBe(0, "wrong winner") 
    expect(select_winner(u128.from(1))).toBe(0, "wrong winner") 
    expect(select_winner(u128.from(2))).toBe(1, "wrong winner") 
    expect(select_winner(u128.from(3))).toBe(1, "wrong winner") 
    expect(select_winner(u128.from(40))).toBe(2, "wrong winner")
    expect(select_winner(u128.from(41))).toBe(2, "wrong winner")
    expect(select_winner(u128.from(4))).toBe(3, "wrong winner") 
    expect(select_winner(u128.from(9))).toBe(3, "wrong winner") 
    expect(select_winner(u128.from(44))).toBe(5, "wrong winner")
    expect(select_winner(u128.from(50))).toBe(5, "wrong winner")
    expect(select_winner(u128.from(51))).toBe(6, "wrong winner")
    expect(select_winner(u128.from(52))).toBe(6, "wrong winner")
    expect(select_winner(u128.from(57))).toBe(6, "wrong winner")
    expect(select_winner(u128.from(11))).toBe(7, "wrong winner")
  });
})

describe("Reserve Guardian", () => {
  it("the reserve guardian must be the first user", () => {
    
    const balance:u128 = u128.from("200000000000000000000")

    // If someone besides the guardian goes first it fails
    VMContext.setSigner_account_id("notguardian.testnet")
    VMContext.setAccount_balance(balance)
    VMContext.setAttached_deposit(u128.from(1))
    VMContext.setPrepaid_gas(300000000000000)

    expect(deposit_and_stake).toThrow()

    // It doesn't fail for the guardian
    VMContext.setSigner_account_id("pooltest.testnet")
    VMContext.setAccount_balance(balance)
    VMContext.setAttached_deposit(u128.from(1))
    VMContext.setPrepaid_gas(300000000000000)

    expect(deposit_and_stake).not.toThrow()
  });
})
