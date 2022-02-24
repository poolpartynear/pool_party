const fs = require("fs");
const {create_contract, deploy_mock_validator, near} = require('./utils')
const { utils: {format: { formatNearAmount, parseNearAmount } }, } = nearAPI

describe('PoolParty', function () {
  const guardian_address = `guardian.${nearConfig.contractName}`
  const dao_address = `dao.${nearConfig.contractName}`
  const pool_address = `validator.${nearConfig.contractName}`

  const alice_address = `alice.${nearConfig.contractName}`
  const bob_address = `bob.${nearConfig.contractName}`
  const cloud_address = `cloud.${nearConfig.contractName}`

  let guardian, dao, alice, bob, cloud

  jest.setTimeout(1200000);

  beforeAll(async function () {
    guardian = await create_contract(guardian_address)
    dao = await create_contract(dao_address)
    alice = await create_contract(alice_address)
    bob = await create_contract(bob_address)
    cloud = await create_contract(cloud_address)

    // We use as pool a mock validator, it has the same interface as a validator
    // but it doubles your deposits, i.e. you deposit 1N -> you get 2N available
    await deploy_mock_validator(pool_address)

    init = async function(pool, guardian, dao, contract=alice){
      return await contract.init({pool, guardian, dao})
    }

    get_account_balance = async function(account_id){
      let account = await near.account(account_id)
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


  });

  describe('Pool', function () {

    it("initializes", async function(){
      let cloud_balance = await get_account_balance(cloud_address)
      let res = await init(pool_address, guardian_address, dao_address)
      expect(res).toBe(true)

      await dao.change_epoch_wait({"epoch_wait":"0"})
    })

    it("allows people to interact", async function(){
      await deposit_and_stake(1, guardian)
      await deposit_and_stake(5, alice)
      await deposit_and_stake(10, bob)

      await unstake(1, alice)
      await unstake(10, bob)

      await interact_external(bob) // unstake
      await interact_external(bob) // withdraw

      await withdraw_all(bob)

      let bob_balance = await get_account_balance(bob_address)
      expect(bob_balance.total).toBeCloseTo(20)

      await deposit_and_stake(1, dao)
      let users = await contract.number_of_users()
      expect(users).toBe(3)

      let dao_pool = await get_account(dao_address)
      expect(dao_pool.staked_balance).toBe(1)
      expect(dao_pool.unstaked_balance).toBe(0)

      let bob_pool = await get_account(bob_address)
      expect(bob_pool.staked_balance).toBe(0)
      expect(bob_pool.unstaked_balance).toBe(0)
    })

    it("allows people to interact", async function(){
      await deposit_and_stake(5, cloud)

      await unstake(1, cloud)

      await expect(withdraw_all(cloud)).rejects.toThrow()

      await interact_external(bob)

      await expect(withdraw_all(cloud)).rejects.toThrow()

      await interact_external(bob) // withdraw

      await withdraw_all(cloud)

      let cloud_balance = await get_account_balance(cloud_address)
      expect(cloud_balance.total).toBeCloseTo(16)
    })
  }); 
});