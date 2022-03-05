const { deploy_mock_validator } = require('./utils')
const { create_user } = require('./methods')

describe('PoolParty', function () {
  const guardian_address = `guardian.${nearConfig.contractName}`
  const dao_address = `dao.${nearConfig.contractName}`
  const pool_address = `validator.${nearConfig.contractName}`

  const alice_address = `alice.${nearConfig.contractName}`
  const bob_address = `bob.${nearConfig.contractName}`
  const cloud_address = `cloud.${nearConfig.contractName}`

  let guardian, dao, alice
  let last_balances = [0, 0, 0, 0, 0]

  jest.setTimeout(1200000);

  beforeAll(async function () {
    guardian = await create_user(guardian_address)
    dao = await create_user(dao_address)
    alice = await create_user(alice_address)
    bob = await create_user(bob_address)
    cloud = await create_user(cloud_address)

    // We use as pool a mock validator, it has the same interface as a validator
    // but it doubles your deposits, i.e. you deposit 1N -> you get 2N available
    await deploy_mock_validator(pool_address)
  });

  describe('Pool', function () {

    it("initializes", async function () {
      let res = await guardian.init(pool_address, guardian_address, dao_address)
      expect(res).toBe(true)
    })

    it("cannot initialize twice", async function () {
      await expect(alice.init(pool_address, guardian_address, dao_address)).rejects.toThrow()
    })

    it("responds empty user for non existing users", async function () {
      let info = await alice.get_account()
      expect(info.staked_balance).toBe(0, "non-user has tickets")
      expect(info.unstaked_balance).toBe(0, "non-user has unstaked_balance")
      expect(info.available).toBe(false, "non-user can withdraw")
    })

    it("responds empty pool at beggining", async function () {
      let info = await alice.get_pool_info()
      expect(info.total_staked).toBe(0, "pool has tickets")
      expect(info.prize).toBe(0, "pool has price")
    })

    it("ERROR: doesn't allow anyone but the guardian to go first", async function () {
      await expect(dao.deposit_and_stake(5)).rejects.toThrow()
    })

    it("allows the guardian to go first", async function () {
      await guardian.deposit_and_stake(1)
    })

    it("correctly add tickets to new users", async function () {
      // Alice buys tickets
      await alice.deposit_and_stake(5)

      // Check it updated correctly the user
      let alice_info = await alice.get_account()
      expect(alice_info.staked_balance).toBe(5, "alice staking went wrong")
      expect(alice_info.unstaked_balance).toBe(0, "alice unstaked_balance changed")
      expect(alice_info.available).toBe(false, "alice available changed")

      // Check it updated correctly the total: alice (5) + guardian (1)
      let pool_info = await alice.get_pool_info()
      expect(pool_info.total_staked).toBe(6, "Pool tickets are wrong")

      // Bob buys tickets
      await bob.deposit_and_stake(10)

      alice_info = await alice.get_account()
      bob_info = await bob.get_account()

      const infos = [alice_info, bob_info]
      const tickets = [5, 10]

      for (i = 0; i < 2; i++) {
        expect(infos[i].staked_balance).toBe(tickets[i])
        expect(infos[i].unstaked_balance).toBe(0)
        expect(infos[i].available).toBe(false)
      }

      pool_info = await alice.get_pool_info()
      // 15 staked by users + 1 of the guardian
      expect(pool_info.total_staked).toBe(15 + 1, "Pool tickets wrong")
    });

    it("has the right prize", async function () {
      // We are using a mock pool that doubles the money you deposit
      // staked = 2*deposited, then, prize = staked - deposited = deposited
      await alice.update_prize()
      let pool_info = await alice.get_pool_info()
      expect(pool_info.prize).toBe(16)
    })

    it("cannot update prize immediately after", async function () {
      await expect(alice.update_prize()).rejects.toThrow()
    })

    it("correctly add more tickets to existing users", async function () {
      // Users buy tickets
      await alice.deposit_and_stake(5)
      await dao.deposit_and_stake(1.123456)
      await bob.deposit_and_stake(2.123)

      // get info
      alice_info = await alice.get_account()
      bob_info = await bob.get_account()
      dao_info = await dao.get_account()

      const infos = [alice_info, bob_info, dao_info]
      const tickets = [10, 12.123, 1.123456]

      for (i = 0; i < 3; i++) {
        expect(infos[i].staked_balance).toBe(tickets[i])
        expect(infos[i].unstaked_balance).toBe(0)
        expect(infos[i].available).toBe(false)
      }

      pool_info = await alice.get_pool_info()
      expect(pool_info.total_staked).toBe(10 + 12.123 + 1.123456 + 1)
    })

    it("correctly unstakes money", async function () {
      await alice.unstake(1)
      await bob.unstake(1.123)

      alice_info = await alice.get_account()
      bob_info = await bob.get_account()
      dao_info = await dao.get_account()
      pool_info = await alice.get_pool_info()

      const infos = [alice_info, bob_info, dao_info]
      const tickets = [9, 11, 1.123456]
      const unstaked_balance = [1, 1.123, 0]
      const available = [false, false, false]

      for (i = 0; i < 3; i++) {
        expect(infos[i].staked_balance).toBe(tickets[i])
        expect(infos[i].unstaked_balance).toBe(unstaked_balance[i])
        expect(infos[i].available).toBe(available[i])
      }

      // The pool returns as total_staked the total_tickets - to_unstake
      expect(pool_info.total_staked).toBe(9 + 11 + 1.123456 + 1)
    })

    it("the prize changed accordingly", async function () {
      await alice.update_prize()
      let pool_info = await alice.get_pool_info()

      // We are using my pool, which doubles the money you deposit
      expect(pool_info.prize).toBe(10 + 12.123 + 1.123456 + 1)
    })

    it("can claim money unstacked in 1 turn", async function () {
      // Since this alice asked to unstake money before the unstake_external
      // they only needs to wait one turn
      account = await alice.get_account()
      expect(account.staked_balance).toBe(9)
      expect(account.unstaked_balance).toBe(1)
      expect(account.available_when).toBe(1)
    })

    it("waits 2 turns after interaction with external", async function () {
      await bob.interact_external()

      // If dao unstakes money now, it should wait 2 turns
      // the 1st turn is for the people that asked when alice did
      // the 2nd turn is for the people that ask now until next external_unstake
      await dao.unstake(0.001)
      account = await dao.get_account()
      expect(account.staked_balance).toBeCloseTo(1.123456 - 0.001)
      expect(account.unstaked_balance).toBe(0.001)
      expect(account.available_when).toBe(2)
    })

    it("on a raffle, the reserve gets a 5% and the winner the rest", async function () {
      let current_balances = [1, 9, 11, 1.123456 - 0.001]
      let prize = 10 + 12.123 + 1.123456 + 1

      const pool_info = await alice.get_pool_info()

      let winner = await alice.raffle()

      let reserve_prize = prize * 0.05
      let winner_prize = prize - reserve_prize

      let balance = await guardian.get_account()
      expect(balance.staked_balance).toBeCloseTo(current_balances[0] + reserve_prize)
      last_balances[0] = balance.staked_balance

      users = [guardian, alice, bob, dao]

      for (i = 1; i < 4; i++) {
        expected = current_balances[i]
        expected += (users[i].accountId == winner) ? winner_prize : 0
        balance = await users[i].get_account()
        expect(balance.staked_balance).toBeCloseTo(expected)
        last_balances[i] = balance.staked_balance
      }

      const new_pool_info = await alice.get_pool_info()
      expect(new_pool_info.total_staked).toBeCloseTo(pool_info.total_staked + prize, 1,
        "Total tickets uncorrectly updated")
    })

    it("correctly add more tickets to existing users", async function () {
      // New user buys tickets, everything remains ok
      await cloud.deposit_and_stake(5)

      users = [guardian, alice, bob, dao]

      // Other users didn't change
      for (i = 0; i < 4; i++) {
        balance = await users[i].get_account()
        expect(balance.staked_balance).toBeCloseTo(last_balances[i], 3)
      }

      // Cloud has they deposit
      balance = await cloud.get_account()

      expect(balance.staked_balance).toBe(5)
      expect(balance.unstaked_balance).toBe(0)

      last_balances[4] = 5
      const total = last_balances.reduce((partialSum, elem) => partialSum + elem, 0);

      pool_info = await alice.get_pool_info()
      expect(pool_info.total_staked).toBeCloseTo(total)
    })

    it("ERROR: cannot raffle again, it has to wait", async function () {
      await expect(bob.raffle()).rejects.toThrow()
    })

    it("ERROR: cannot unstack more money than available", async function () {
      let account = await dao.get_account()
      await expect(dao.unstake(account.staked_balance + 0.01)).rejects.toThrow()
    })

    it("ERROR: cannot access method deposit_and_stake_callback", async () => {
      await expect(guardian.contract.deposit_and_stake_callback({ args: { user: guardian_address, amount: '1' } })).rejects.toThrow()
    })

    it("ERROR: cannot access method unstake_external_callback", async () => {
      await expect(guardian.contract.unstake_external_callback({ args: { user: alice_address, amount: "100" } })).rejects.toThrow()
    })

    it("ERROR: cannot access method _withdraw_exteral", async () => {
      await expect(guardian.contract.withdraw_external_callback()).rejects.toThrow()
    })

    it("ERROR: cannot access method update_prize_callback", async () => {
      await expect(guardian.contract.update_prize_callback()).rejects.toThrow()
    })
  });
});