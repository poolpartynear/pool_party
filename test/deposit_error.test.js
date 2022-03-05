const { create_user } = require('./methods')

describe('Deposit Error PoolParty', function () {
  let alice
  const alice_address = `alice.${nearConfig.contractName}`

  jest.setTimeout(1200000);

  beforeAll(async function () {
    alice = await create_user(alice_address)
  });

  describe('Deposit Error', function () {
    it("inits", async function () {
      await alice.init('pool', alice_address, 'dao')
    })

    it("The user should get its money back", async function () {
      const balance = await alice.wallet_balance()

      // The pool doesn't exist, so it should fail when depositing
      // The call will succed, but the callback should return the money
      await alice.deposit_and_stake(1)

      new_balance = await alice.wallet_balance()

      expect(balance.total).toBeCloseTo(new_balance.total, 1)

      const account_info = await alice.get_account()
      expect(account_info.staked_balance).toBe(0, "user has tickets")
      expect(account_info.unstaked_balance).toBe(0, "user has unstaked_balance")
      expect(account_info.available).toBe(false, "user can withdraw")

      const pool_info = await alice.get_pool_info()
      expect(pool_info.total_staked).toBe(0, "pool has tickets")
      expect(pool_info.prize).toBe(0, "pool has prize")
    })
  });
});