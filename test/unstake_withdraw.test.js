const { deploy_mock_validator } = require('./utils')
const { create_user } = require('./methods')

describe('PoolParty', function () {
  const guardian_address = `guardian.${nearConfig.contractName}`
  const dao_address = `dao.${nearConfig.contractName}`
  const pool_address = `validator.${nearConfig.contractName}`

  const alice_address = `alice.${nearConfig.contractName}`
  const bob_address = `bob.${nearConfig.contractName}`
  const cloud_address = `cloud.${nearConfig.contractName}`
  const dani_address = `dani.${nearConfig.contractName}`

  const CALL_FEE = 0.03

  let guardian, dao, alice, bob, cloud, dani

  jest.setTimeout(1200000);

  beforeAll(async function () {
    guardian = await create_user(guardian_address)
    dao = await create_user(dao_address)
    alice = await create_user(alice_address)
    bob = await create_user(bob_address)
    cloud = await create_user(cloud_address)
    dani = await create_user(dani_address)

    // We use as pool a mock validator, it has the same interface as a validator
    // but it doubles your deposits, i.e. you deposit 1N -> you get 2N available
    await deploy_mock_validator(pool_address)
  });

  describe('Pool', function () {

    it("initializes", async function () {
      let res = await guardian.init(pool_address, guardian_address, dao_address)
      expect(res).toBe(true)

      await dao.change_epoch_wait(0)
    })

    it("Correctly removes user if they don't have enough staked", async function () {
      await guardian.deposit_and_stake(1)
      await alice.deposit_and_stake(5)
      await bob.deposit_and_stake(10)
      await dani.deposit_and_stake(10)

      // The minimum deposit is 1 NEAR, so unstaking 9.5 should result in a removal of everything
      await bob.unstake(9.5)
      await dani.unstake(9.5)

      // Check the unstake worked correctly
      let bob_pool = await bob.get_account()
      expect(bob_pool.staked_balance).toBe(0)
      expect(bob_pool.unstaked_balance).toBe(10)
      expect(bob_pool.available_when).toBe(1)

      let dani_pool = await dani.get_account()
      expect(dani_pool.staked_balance).toBe(0)
      expect(dani_pool.unstaked_balance).toBe(10)
      expect(dani_pool.available_when).toBe(1)


      await bob.interact_external() // unstake

      await alice.unstake(1)

      // Check the unstake worked correctly
      let alice_pool = await alice.get_account()
      expect(alice_pool.staked_balance).toBe(4)
      expect(alice_pool.unstaked_balance).toBe(1)
      expect(alice_pool.available_when).toBe(2)

      await bob.interact_external() // withdraw

      let bob_balance = await bob.wallet_balance()
      expect(bob_balance.total).toBeCloseTo(10 - CALL_FEE * 4, 1)

      let dani_balance = await dani.wallet_balance()

      await bob.withdraw_all()
      await dani.withdraw_all()

      // Bob and Dani should have more money
      let new_bob_balance = await bob.wallet_balance()
      expect(new_bob_balance.total).toBeCloseTo(bob_balance.total + 10 - CALL_FEE, 1)

      let new_dani_balance = await dani.wallet_balance()
      expect(new_dani_balance.total).toBeCloseTo(dani_balance.total + 10 - CALL_FEE, 1)

      // Bob and Dani should have nothing in the pool
      bob_pool = await bob.get_account()
      expect(bob_pool.staked_balance).toBe(0)
      expect(bob_pool.unstaked_balance).toBe(0)

      dani_pool = await dani.get_account()
      expect(dani_pool.staked_balance).toBe(0)
      expect(dani_pool.unstaked_balance).toBe(0)

      // Alice should have changed only the `available when` field
      alice_pool = await alice.get_account()
      expect(alice_pool.staked_balance).toBe(4)
      expect(alice_pool.unstaked_balance).toBe(1)
      expect(alice_pool.available_when).toBe(1)

      // A new user should take Bob's place
      await dao.deposit_and_stake(1)

      let users = await dao.number_of_users()
      expect(users).toBe(4)

      let dao_pool = await dao.get_account()
      expect(dao_pool.staked_balance).toBe(1)
      expect(dao_pool.unstaked_balance).toBe(0)

      // Bob should still have no deposits
      bob_pool = await bob.get_account()
      expect(bob_pool.staked_balance).toBe(0)
      expect(bob_pool.unstaked_balance).toBe(0)
    })

    it("Doesn't allow to withdraw before 2 turns", async function () {
      await cloud.deposit_and_stake(5)

      // A new user should take dani place
      let users = await dao.number_of_users()
      expect(users).toBe(4)

      await cloud.unstake(1)

      await expect(cloud.withdraw_all()).rejects.toThrow()

      await bob.interact_external()

      await expect(cloud.withdraw_all()).rejects.toThrow()

      await bob.interact_external() // withdraw

      await cloud.withdraw_all()

      let cloud_balance = await cloud.wallet_balance()
      expect(cloud_balance.total).toBeCloseTo(16 - 4 * CALL_FEE, 1)

      let cloud_pool = await cloud.get_account()
      expect(cloud_pool.staked_balance).toBe(4)
      expect(cloud_pool.unstaked_balance).toBe(0)
      expect(cloud_pool.available_when).toBe(0)

      // Alice can also withdraw
      await alice.withdraw_all()
    })

    it("Restart user wait time if they ask to withdraw again", async function () {
      let cloud_balance = await cloud.wallet_balance()

      await cloud.unstake(1)

      // Cloud needs to wait 1 turn
      let cloud_pool = await cloud.get_account()
      expect(cloud_pool.staked_balance).toBe(3)
      expect(cloud_pool.unstaked_balance).toBe(1)
      expect(cloud_pool.available_when).toBe(1)

      await bob.interact_external() //unstake

      // cloud unstakes again
      await cloud.unstake(1)

      cloud_pool = await cloud.get_account()
      expect(cloud_pool.staked_balance).toBe(2)
      expect(cloud_pool.unstaked_balance).toBe(2)
      expect(cloud_pool.available_when).toBe(2)

      await bob.interact_external() // withdraw

      // cloud cannot remove the money, since it asked for unstake
      await expect(cloud.withdraw_all()).rejects.toThrow()

      await bob.interact_external() // unstake
      await bob.interact_external() // withdraw

      // cloud deposits and ask to unstake again
      await cloud.deposit_and_stake(2)
      await cloud.unstake(1)

      cloud_pool = await cloud.get_account()
      expect(cloud_pool.staked_balance).toBe(3)
      expect(cloud_pool.unstaked_balance).toBe(3)
      expect(cloud_pool.available_when).toBe(1)

      await bob.interact_external() // unstake
      await bob.interact_external() // withdraw

      await cloud.withdraw_all()

      let new_cloud_balance = await cloud.wallet_balance()
      expect(new_cloud_balance.total).toBeCloseTo(cloud_balance.total - 2 + 3 - 6 * CALL_FEE, 1)

      cloud_pool = await cloud.get_account()
      expect(cloud_pool.staked_balance).toBe(3)
      expect(cloud_pool.unstaked_balance).toBe(0)
      expect(cloud_pool.available_when).toBe(0)
    })
  });
});