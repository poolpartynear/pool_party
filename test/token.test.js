const { deploy_mock_validator } = require('./utils')
const { create_user } = require('./methods')
const { utils: { format: { parseNearAmount } }, } = nearAPI

describe('PoolParty', function () {
  const guardian_address = `guardian.${nearConfig.contractName}`
  const dao_address = `dao.${nearConfig.contractName}`
  const pool_address = `validator.${nearConfig.contractName}`

  const alice_address = `alice.${nearConfig.contractName}`
  const bob_address = `bob.${nearConfig.contractName}`

  let guardian, dao, alice

  jest.setTimeout(1200000);

  beforeAll(async function () {
    guardian = await create_user(guardian_address)
    dao = await create_user(dao_address)
    alice = await create_user(alice_address)
    bob = await create_user(bob_address)

    // We use as pool a mock validator, it has the same interface as a validator
    // but it doubles your deposits, i.e. you deposit 1N -> you get 2N available
    await deploy_mock_validator(pool_address)
  });

  describe('Pool', function () {

    it("initializes", async function () {
      let res = await dao.init(pool_address, guardian_address, dao_address)
      expect(res).toBe(true)
    })

    it("guardian can give tickets to users", async function () {
      await guardian.deposit_and_stake(10)  // Guardian deposits first
      await alice.deposit_and_stake(10)     // Alice buys tickets
      await bob.deposit_and_stake(10)       // Bob buys tickets

      let pool_info = await guardian.get_pool_info()

      await guardian.give_from_reserve(alice_address, 5)

      // Check it updated correctly the user
      let alice_info = await alice.get_account()
      expect(alice_info.staked_balance).toBe(15, "alice staking went wrong")
      expect(alice_info.unstaked_balance).toBe(0, "alice unstaked_balance changed")
      expect(alice_info.available).toBe(false, "alice available changed")

      let guardian_info = await guardian.get_account()
      expect(guardian_info.staked_balance).toBe(5, "giving from pool went wrong")
      expect(guardian_info.unstaked_balance).toBe(0, "giving from pool went wrong")
      expect(guardian_info.available).toBe(false, "giving from pool went wrong")

      let new_pool_info = await guardian.get_pool_info()

      expect(new_pool_info.reserve).toBe(parseNearAmount("5"))
      expect(new_pool_info.total_staked).toBe(pool_info.total_staked)
      expect(new_pool_info.prize).toBe(pool_info.prize)
    })

    it("ERROR: other users cannot give from reserve", async () => {
      await expect(alice.give_from_reserve(alice_address, 5)).rejects.toThrow()
    })
  });
});