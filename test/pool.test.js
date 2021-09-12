const fs = require("fs");
const {create_contract, deploy_mock_validator} = require('./utils')
const { utils: {format: { formatNearAmount, parseNearAmount } }, } = nearAPI

describe('PoolParty', function () {
  const guardian_address = `guardian.${nearConfig.contractName}`
  const dao_address = `dao.${nearConfig.contractName}`
  const pool_address = `validator.${nearConfig.contractName}`

  const alice_address = `alice.${nearConfig.contractName}`
  const bob_address = `bob.${nearConfig.contractName}`

  let guardian, dao, alice

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 1200000;

  beforeAll(async function () {
    guardian = await create_contract(guardian_address)
    dao = await create_contract(dao_address)
    alice = await create_contract(alice_address)
    bob = await create_contract(bob_address)

    // We use as pool a mock validator, it has the same interface as a validator
    // but it doubles your deposits, i.e. you deposit 1N -> you get 2N available
    await deploy_mock_validator(pool_address)

    init = async function(pool, guardian, dao, contract=alice){
      return await contract.init({pool, guardian, dao})
    }

    get_account_balance = async function(account){
       let balance = await account.getAccountBalance()
       balance.total = parseFloat(formatNearAmount(balance.total))
       balance.available = parseFloat(formatNearAmount(balance.available))
       return balance
    }

    deposit_and_stake = async function(amount, contract){
      amount = parseNearAmount(amount.toString())
      return await contract.account.functionCall(
        nearConfig.contractName, 'deposit_and_stake', {}, 300000000000000, amount
      )
    }

    unstake = async function(amount, contract){
      amount = parseNearAmount(amount.toString())
      let result = await contract.account.functionCall(
        nearConfig.contractName, 'unstake', {amount:amount}, 300000000000000, 0
      )
      return nearlib.providers.getTransactionLastResult(result)
    }

    interact_external = async function(contract){
      let result = await contract.account.functionCall(
        nearConfig.contractName, 'interact_external', {}, 300000000000000, 0
      )
      return nearlib.providers.getTransactionLastResult(result)
    }

    withdraw_all = async function(contract){
      let result = await contract.account.functionCall(
        nearConfig.contractName, 'withdraw_all', {}, 300000000000000, 0
      )
      return nearlib.providers.getTransactionLastResult(result)
    }

    get_account = async function(account_id, contract=alice){
      let info = await contract.get_account({account_id})
      info.staked_balance = parseFloat(formatNearAmount(info.staked_balance))
      info.unstaked_balance = parseFloat(formatNearAmount(info.unstaked_balance))
      info.available_when = Number(info.available_when)
      return info
    }

    get_pool_info = async function(contract=alice){
      let result = await contract.account.functionCall(
        nearConfig.contractName, 'get_pool_info', {}, 300000000000000, 0
      )
      info = nearlib.providers.getTransactionLastResult(result)
      info.total_staked = parseFloat(formatNearAmount(info.total_staked))
      info.prize = parseFloat(formatNearAmount(info.prize))
      return info  
    }

    raffle = async function(contract=alice){
      let result = await contract.account.functionCall(
        nearConfig.contractName, 'raffle', {}, 300000000000000, 0
      )
      info = nearlib.providers.getTransactionLastResult(result)
      return info  
    }

    update_prize = async function(contract=alice){
      let result = await contract.account.functionCall(
        nearConfig.contractName, 'update_prize', {}, 300000000000000, 0
      )
      info = nearlib.providers.getTransactionLastResult(result)
      return info  
    }
  });

  describe('Pool', function () {

    it("initializes", async function(){
      let res = await init(pool_address, guardian_address, dao_address)
      expect(res).toBe(true)
    })

    it("responds empty user for non existing users", async function(){
      let info = await get_account("non-existent-user")
      expect(info.staked_balance).toBe(0, "non-user has tickets")
      expect(info.unstaked_balance).toBe(0, "non-user has unstaked_balance")
      expect(info.available).toBe(false, "non-user can withdraw")
    })

    it("responds empty pool at beggining", async function(){
      let info = await get_pool_info()
      expect(info.total_staked).toBe(0, "pool has tickets")
      expect(info.prize).toBe(0, "pool has price")
    })

    it("ERROR: doesn't allow anyone but the guardian to go first", async function(){
      await expect(deposit_and_stake(5, dao)).rejects.toThrow()
    })

    it("allows the guardian to go first", async function(){
      await deposit_and_stake(1, guardian)
    })

    it("correctly add tickets to new users", async function(){
      // Alice buys tickets
      await deposit_and_stake(5, alice)

      // Check it updated correctly the user
      let alice_info = await get_account(alice_address)
      expect(alice_info.staked_balance).toBe(5, "alice staking went wrong")
      expect(alice_info.unstaked_balance).toBe(0, "alice unstaked_balance changed")
      expect(alice_info.available).toBe(false, "alice available changed")

      // Check it updated correctly the total: alice (5) + guardian (1)
      let pool_info = await get_pool_info()
      expect(pool_info.total_staked).toBe(6, "Pool tickets are wrong")

      // Bob buys tickets
      await deposit_and_stake(10, bob)

      alice_info = await get_account(alice_address)
      bob_info = await get_account(bob_address)

      const infos = [alice_info, bob_info]
      const tickets = [5, 10]

      for(i=0; i<2; i++){
        expect(infos[i].staked_balance).toBe(tickets[i])
        expect(infos[i].unstaked_balance).toBe(0)
        expect(infos[i].available).toBe(false)
      }

      pool_info = await get_pool_info()
      // 15 staked by users + 1 of the guardian
      expect(pool_info.total_staked).toBe(15 + 1, "Pool tickets wrong")
    });

    it("has the right prize", async function(){
      // We are using a mock pool that doubles the money you deposit
      // staked = 2*deposited, then, prize = staked - deposited = deposited
      await update_prize()
      let pool_info = await get_pool_info(alice)
      expect(pool_info.prize).toBe(16)
    })

    it("correctly add more tickets to existing users", async function(){
      // Users buy tickets
      await deposit_and_stake(5, alice)
      await deposit_and_stake(1.123456, dao)
      await deposit_and_stake(2.123, bob)

      // get info
      alice_info = await get_account(alice_address)
      bob_info = await get_account(bob_address)
      dao_info = await get_account(dao_address)

      const infos = [alice_info, bob_info, dao_info]
      const tickets = [10, 12.123, 1.123456]

      for(i=0; i<3; i++){
        expect(infos[i].staked_balance).toBe(tickets[i])
        expect(infos[i].unstaked_balance).toBe(0)
        expect(infos[i].available).toBe(false)
      }
      
      pool_info = await get_pool_info()
      expect(pool_info.total_staked).toBe(10 + 12.123 + 1.123456 + 1)
    })

    it("correctly unstacks money", async function(){
      await unstake(1, alice)
      await unstake(1.123, bob)

      // only A should have changed
      alice_info = await get_account(alice_address)
      bob_info = await get_account(bob_address)
      dao_info = await get_account(dao_address)
      pool_info = await get_pool_info()

      const infos = [alice_info, bob_info, dao_info]
      const tickets = [9, 11, 1.123456]
      const unstaked_balance = [1, 1.123, 0]
      const available = [false, false, false]

      for(i=0; i<3; i++){
        expect(infos[i].staked_balance).toBe(tickets[i])
        expect(infos[i].unstaked_balance).toBe(unstaked_balance[i])
        expect(infos[i].available).toBe(available[i])
      }

      // The pool returns as total_staked the total_tickets - to_unstake
      expect(pool_info.total_staked).toBe(9 + 11 + 1.123456 + 1)
    })

    it("the prize changed accordingly", async function(){
      await update_prize()
      let pool_info = await get_pool_info()

      // We are using my pool, which doubles the money you deposit
      expect(pool_info.prize).toBe(10 + 12.123 + 1.123456 + 1)
    })

    it("can claim money unstacked in 1 turn", async function(){
      // Since this alice asked to unstake money before the unstake_external
      // they only needs to wait one turn
      account = await get_account(alice_address)
      expect(account.staked_balance).toBe(9)
      expect(account.unstaked_balance).toBe(1)
      expect(account.available_when).toBe(1)
    })

    it("waits 2 turns after interaction with external", async function(){
      await interact_external(alice)

      // If dao unstakes money now, it should wait 2 turns
      // the 1st turn if for the people that asked when alice did
      // the 2nd turn if for the people that ask now until next external_unstake
      await unstake(0.001, dao)
      account = await get_account(dao_address)
      expect(account.staked_balance).toBeCloseTo(1.123456 - 0.001)
      expect(account.unstaked_balance).toBe(0.001)
      expect(account.available_when).toBe(2)
    })

    it("on a raffle, the reserve gets a 5% and the winner the rest", async function(){
      let current_balances = [1, 9, 11, 1.123456 - 0.001]
      let prize = 10+12.123+1.123456+1
      let winner = await raffle()

      let reserve_prize = prize * 0.05
      let winner_prize = prize - reserve_prize

      let balance = await get_account(guardian_address)
      expect(balance.staked_balance).toBeCloseTo(current_balances[0] + reserve_prize)

      users = [guardian_address, alice_address, bob_address, dao_address]

      for(i=1; i<4; i++){
        expected = current_balances[i]
        expected += (i == winner)? winner_prize : 0
        balance = await get_account(users[i])
        expect(balance.staked_balance).toBeCloseTo(expected)
      }
    })

    it("ERROR: the guardian cannot withdraw money", async function(){
      await expect(unstake(1, guardian)).rejects.toThrow()
    })

    it("ERROR: cannot raffle again, it has to wait", async function(){
      await expect(raffle()).rejects.toThrow()
    })

    it("ERROR: cannot unstack more money than available", async function(){
      let account = await get_account(dao_address)
      await expect(unstake(account.staked_balance + 0.1, dao)).rejects.toThrow()
    })

    it("ERROR: cannot access method deposit_and_stake_callback", async ()=>{
      await expect(guardian.deposit_and_stake_callback({idx:1, amount:'1'})).rejects.toThrow()
    })

    it("ERROR: cannot access method unstake_external_callback", async ()=>{
      await expect(guardian.unstake_external_callback({alice:alice_address, amount:"100"})).rejects.toThrow()
    })

    it("ERROR: cannot access method _withdraw_exteral", async ()=>{
      await expect(guardian.withdraw_external_callback()).rejects.toThrow()
    })

    it("ERROR: cannot access method withdraw_all_callback", async ()=>{
      await expect(guardian.withdraw_all_callback({idx:0, amount:'1'})).rejects.toThrow()
    })

    it("ERROR: cannot access method update_prize_callback", async ()=>{
      await expect(guardian.update_prize_callback()).rejects.toThrow()
    })
  }); 
});