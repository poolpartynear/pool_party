const {create_contract, deploy_mock_validator} = require('./utils')
const { utils: {format: { formatNearAmount, parseNearAmount } }, } = nearAPI

describe('An emergency in PoolParty', function () {
  let contract_A, DAO
  const user_A = `alice.${nearConfig.contractName}`
  const dao_address = `dao.${nearConfig.contractName}`
  const pool_address = `validator.${nearConfig.contractName}`

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 1200000;

  beforeAll(async function () {
    contract_A = await create_contract(user_A)
    DAO = await create_contract(dao_address)

    await deploy_mock_validator(pool_address)

    get_account = async function(account_id, contract=contract_A){
      let info = await contract.get_account({account_id})
      info.staked_balance = parseFloat(formatNearAmount(info.staked_balance))
      info.unstaked_balance = parseFloat(formatNearAmount(info.unstaked_balance))
      info.available_when = Number(info.available_when)
      return info
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

    raffle = async function(contract=alice){
      let result = await contract.account.functionCall(
        nearConfig.contractName, 'raffle', {}, 300000000000000, 0
      )
      info = nearlib.providers.getTransactionLastResult(result)
      return info  
    }

  });

  describe('DAO', function () {
    it("inits", async function(){
      await contract_A.init({pool:pool_address, guardian:user_A, dao: dao_address})
    })

    it("ERROR: the user cannot start an state of emergency", async function(){
      await expect(contract_A.emergency_start()).rejects.toThrow()
    })

    it("the DAO can declare emergency", async function(){
      await expect(DAO.emergency_start()).resolves.not.toThrow()
    })

    it("ERROR: User cannot deposit during emergency", async function(){
      await expect(deposit_and_stake(1, contract_A)).rejects.toThrow()
    })

    it("ERROR: User cannot unstake during emergency", async function(){
      await expect(unstake(1, contract_A)).rejects.toThrow()
    })

    it("ERROR: User cannot ask to interact with external during emergency", async function(){
      await expect(interact_external(contract_A)).rejects.toThrow()
    })

    it("ERROR: User cannot withdraw during emergency", async function(){
      await expect(withdraw_all(contract_A)).rejects.toThrow()
    })

    it("ERROR: User cannot raffle during emergency", async function(){
      await expect(raffle(contract_A)).rejects.toThrow()
    })

    it("ERROR: the user cannot stop an state of emergency", async function(){
      await expect(contract_A.emergency_stop()).rejects.toThrow()
    })    

    it("the DAO can stop the state of emergency", async function(){
      await expect(DAO.emergency_stop()).resolves.not.toThrow()
    })

    it("The user can deposit again", async function(){
      await deposit_and_stake(5, contract_A)

      let alice_info = await get_account(user_A)
      expect(alice_info.staked_balance).toBe(5, "alice staking went wrong")
      expect(alice_info.unstaked_balance).toBe(0, "alice unstaked_balance changed")
      expect(alice_info.available).toBe(false, "alice available changed")
    })
  });
});