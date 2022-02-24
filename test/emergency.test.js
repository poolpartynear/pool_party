const { create_contract, deploy_mock_validator } = require('./utils')
const { create_user } = require('./methods')

describe('An emergency in PoolParty', function () {
  const alice_address = `alice.${nearConfig.contractName}`
  const dao_address = `dao.${nearConfig.contractName}`
  const pool_address = `validator.${nearConfig.contractName}`

  jest.setTimeout(1200000);

  beforeAll(async function () {
    alice = await create_user(alice_address)
    DAO = await create_contract(dao_address)

    await deploy_mock_validator(pool_address)
  });

  describe('DAO', function () {
    it("inits", async function () {
      await alice.init(pool_address, alice_address, dao_address)
    })

    it("ERROR: the user cannot start an state of emergency", async function () {
      await expect(alice.emergency_start()).rejects.toThrow()
    })

    it("the DAO can declare emergency", async function () {
      await expect(DAO.emergency_start({ args: {} })).resolves.not.toThrow()
    })

    it("ERROR: User cannot deposit during emergency", async function () {
      await expect(alice.deposit_and_stake(1)).rejects.toThrow()
    })

    it("ERROR: User cannot unstake during emergency", async function () {
      await expect(alice.unstake(1)).rejects.toThrow()
    })

    it("ERROR: User cannot ask to interact with external during emergency", async function () {
      await expect(alice.interact_external()).rejects.toThrow()
    })

    it("ERROR: User cannot withdraw during emergency", async function () {
      await expect(alice.withdraw_all()).rejects.toThrow()
    })

    it("ERROR: User cannot raffle during emergency", async function () {
      await expect(alice.raffle()).rejects.toThrow()
    })

    it("ERROR: the user cannot stop an state of emergency", async function () {
      await expect(alice.emergency_stop()).rejects.toThrow()
    })

    it("the DAO can stop the state of emergency", async function () {
      await expect(DAO.emergency_stop({ args: {} })).resolves.not.toThrow()
    })

    it("The user can deposit again", async function () {
      await alice.deposit_and_stake(5)

      let alice_info = await alice.get_account()
      expect(alice_info.staked_balance).toBe(5, "alice staking went wrong")
      expect(alice_info.unstaked_balance).toBe(0, "alice unstaked_balance changed")
      expect(alice_info.available).toBe(false, "alice available changed")
    })
  });
});