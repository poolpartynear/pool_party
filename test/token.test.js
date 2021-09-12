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

    deposit_and_stake = async function(amount, contract){
      amount = parseNearAmount(amount.toString())
      return await contract.account.functionCall(
        nearConfig.contractName, 'deposit_and_stake', {}, 300000000000000, amount
      )
    }

    give_from_reserve = async function(to, amount, contract){
      amount = parseNearAmount(amount.toString())
      let result = await contract.account.functionCall(
        nearConfig.contractName, 'give_from_reserve',
        {to, amount}, 300000000000000, 0
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
  });

  describe('Pool', function () {

    it("initializes", async function(){
      let res = await init(pool_address, guardian_address, dao_address)
      expect(res).toBe(true)
    })

    it("guardian can give tickets to users", async function(){
      await deposit_and_stake(10, guardian)  // Guardian deposits first
      await deposit_and_stake(10, alice)     // Alice buys tickets
      await deposit_and_stake(10, bob)       // Bob buys tickets

      let pool_info = await get_pool_info()

      await give_from_reserve(alice_address, 5, guardian)

      // Check it updated correctly the user
      let alice_info = await get_account(alice_address)
      expect(alice_info.staked_balance).toBe(15, "alice staking went wrong")
      expect(alice_info.unstaked_balance).toBe(0, "alice unstaked_balance changed")
      expect(alice_info.available).toBe(false, "alice available changed")

      let guardian_info = await get_account(guardian_address)
      expect(guardian_info.staked_balance).toBe(5, "giving from pool went wrong")
      expect(guardian_info.unstaked_balance).toBe(0, "giving from pool went wrong")
      expect(guardian_info.available).toBe(false, "giving from pool went wrong")

      let new_pool_info = await get_pool_info()

      expect(new_pool_info.reserve).toBe(parseNearAmount("5"))
      expect(new_pool_info.total_staked).toBe(pool_info.total_staked)
      expect(new_pool_info.prize).toBe(pool_info.prize)
    })

    it("ERROR: other users cannot give from reserve", async ()=>{
      await expect(give_from_reserve(alice_address, 5, alice)).rejects.toThrow()
    })
  }); 
});