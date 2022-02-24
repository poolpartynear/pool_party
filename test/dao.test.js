const { create_contract } = require('./utils')
const { utils: { format: { formatNearAmount, parseNearAmount } }, } = nearAPI

describe('PoolParty DAO', function () {
  let alice, bob, dao
  const alice_address = `alice.${nearConfig.contractName}`
  const bob_address = `bob.${nearConfig.contractName}`
  const dao_address = `dao.${nearConfig.contractName}`

  jest.setTimeout(1200000);

  beforeAll(async function () {
    alice = await create_contract(alice_address)
    bob = await create_contract(bob_address)
    dao = await create_contract(dao_address)
  });

  describe('dao', function () {
    it("inits", async function () {
      await alice.init({ args: { pool: 'pool', guardian: 'guardian', dao: dao_address } })
    })

    it("the dao can change the fees", async function () {
      let fees = await alice.get_pool_fees()
      expect(fees).toBe(5)

      await dao.change_pool_fees({ args: { fees: 10 } })

      fees = await alice.get_pool_fees()
      expect(fees).toBe(10)
    })

    it("the fees cannot be more than 100", async function () {
      await expect(dao.change_pool_fees({ args: { fees: 100 } })).resolves.not.toThrow()
      await expect(dao.change_pool_fees({ args: { fees: 101 } })).rejects.toThrow()
    })

    it("the dao can change the raffle time", async function () {
      time = await alice.get_raffle_wait()
      expect(time).toBe("86400000000000")

      let new_wait = "200"
      await dao.change_time_between_raffles({ args: { time: new_wait } })

      time = await alice.get_raffle_wait()
      expect(time).toBe("200")
    })

    it("the dao can change the min deposit", async function () {
      let min_deposit = await alice.get_min_deposit()
      min_deposit = formatNearAmount(min_deposit)
      expect(min_deposit).toBe("1")

      let new_min_deposit = "2"
      new_min_deposit = parseNearAmount(new_min_deposit)
      await dao.change_min_deposit({ new_min_deposit })

      min_deposit = await alice.get_min_deposit()
      min_deposit = formatNearAmount(min_deposit)
      expect(min_deposit).toBe("2")
    })

    it("the dao can change the max deposit", async function () {
      let max_deposit = await alice.get_max_deposit()
      max_deposit = formatNearAmount(max_deposit)
      expect(max_deposit).toBe("1,000")

      let new_max_deposit = "20000"
      new_max_deposit = parseNearAmount(new_max_deposit)
      await dao.change_max_deposit({ args: { new_max_deposit } })

      max_deposit = await alice.get_max_deposit()
      max_deposit = formatNearAmount(max_deposit)
      expect(max_deposit).toBe("20,000")
    })

    it("the dao can change the max number of users", async function () {
      users = await alice.get_max_users()
      expect(users).toBe(8191)

      await dao.change_max_users({ args: { max_users: 1000 } })

      users = await alice.get_max_users()
      expect(users).toBe(1000)
    })

    it("the dao can change the guardian", async function () {
      guardian = await alice.get_guardian()
      expect(guardian).toBe('guardian')

      await dao.propose_new_guardian({ args: { guardian: bob_address } })

      guardian = await alice.get_guardian()
      expect(guardian).toBe('guardian')

      await bob.accept_being_guardian()

      guardian = await alice.get_guardian()
      expect(guardian).toBe(bob_address)
    })

    it("ERROR: only dao can change fees", async function () {
      await expect(alice.change_pool_fees({ args: { fees: 10 } })).rejects.toThrow()
    })

    it("ERROR: only dao can change time between reaffles", async function () {
      await expect(alice.change_time_between_raffles({ args: { time: "1" } })).rejects.toThrow()
    })

    it("ERROR: only dao can change max users", async function () {
      await expect(alice.change_max_users({ args: { max_users: 30 } })).rejects.toThrow()
    })

    it("ERROR: only dao can change min deposit", async function () {
      await expect(alice.change_min_deposit({ args: { new_min_deposit: 30 } })).rejects.toThrow()
    })

    it("ERROR: only dao can propose a guardian", async function () {
      await expect(alice.propose_new_guardian({ args: { guardian: 'guardian' } })).rejects.toThrow()
    })

    it("ERROR: Other people cannot accept being guardian", async function () {
      await dao.propose_new_guardian({ args: { guardian: bob_address } })
      await expect(alice.accept_being_guardian()).rejects.toThrow()
    })
  });
});
