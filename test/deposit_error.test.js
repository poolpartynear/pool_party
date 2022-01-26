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

      const info = await get_account(user_A)
      expect(info.staked_balance).toBe(0, "user has tickets")
      expect(info.unstaked_balance).toBe(0, "user has unstaked_balance")
      expect(info.available).toBe(false, "user can withdraw")
    })

  });
});