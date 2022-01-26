const {create_contract, getAccount} = require('./utils')
const { utils: {format: { formatNearAmount, parseNearAmount } }, } = nearAPI

describe('Deposit Error PoolParty', function () {
  let contract_A
  const user_A = `alice.${nearConfig.contractName}`

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 1200000;

  beforeAll(async function () {
    contract_A = await create_contract(user_A)

    get_account_balance = async function(accountId){
      const account = await getAccount(accountId)
      // Fix this when they fix API
      return parseFloat(formatNearAmount(account._state.amount))
    }

    get_account = async function(account_id, contract=contract_A){
      let account_info = await contract.get_account({account_id})
      account_info.staked_balance = parseFloat(formatNearAmount(account_info.staked_balance))
      account_info.unstaked_balance = parseFloat(formatNearAmount(account_info.unstaked_balance))
      account_info.available_when = Number(account_info.available_when)
      return account_info
    }

    get_pool_info = async function(contract=contract_A){
      let result = await contract.account.functionCall(
        nearConfig.contractName, 'get_pool_info', {}, 300000000000000, 0
      )
      info = nearlib.providers.getTransactionLastResult(result)
      info.total_staked = parseFloat(formatNearAmount(info.total_staked))
      info.prize = parseFloat(formatNearAmount(info.prize))
      return info  
    }

    deposit_and_stake = async function(amount, contract){
      amount = parseNearAmount(amount.toString())
      return await contract.account.functionCall(
        nearConfig.contractName, 'deposit_and_stake', {}, 300000000000000, amount
      )
    }
  });

  describe('Deposit Error', function () {
    it("inits", async function(){
      // The pool doesn't exist, so it should fail when depositing
      await contract_A.init({pool:'pool', guardian:user_A, dao: 'dao'})
    })

    it("The user should get its money back", async function(){
      const balance = await get_account_balance(user_A)

      // This will return the money since it has a wrong pool
      await deposit_and_stake(1, contract_A)

      new_balance = await get_account_balance(user_A)
      
      expect(balance).toBeCloseTo(new_balance, 1)

      const account_info = await get_account(user_A)
      expect(account_info.staked_balance).toBe(0, "user has tickets")
      expect(account_info.unstaked_balance).toBe(0, "user has unstaked_balance")
      expect(account_info.available).toBe(false, "user can withdraw")

      const pool_info = await get_pool_info()
      expect(pool_info.total_staked).toBe(0, "pool has tickets")
      expect(pool_info.prize).toBe(0, "pool has prize")
    })
  });
});