const {create_contract} = require('./utils')

describe('DAO-PoolParty', function () {
  let contract_A, contract_B, DAO
  const user_A = `alice.${nearConfig.contractName}`
  const user_B = `bob.${nearConfig.contractName}`
  const dao_address = `dao.${nearConfig.contractName}`

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 1200000;

  beforeAll(async function () {
    contract_A = await create_contract(user_A)
    contract_B = await create_contract(user_B)
    DAO = await create_contract(dao_address)
  });

  describe('DAO', function () {
    it("inits", async function(){
      await contract_A.init({pool:'pool', guardian:'guardian', dao: dao_address})
    })

    /* it("the DAO can change the fees", async function(){
      fees = await contract_A.get_pool_fees()
      expect(fees).toBe(5)

      await DAO.change_pool_fees({fees:10})

      fees = await get_pool_fees(contract_A)
      expect(fees).toBe(10)
    })

    it("the DAO can change the raffle time", async function(){
      time = await contract_A.get_raffle_wait()
      expect(time).toBe("86400000000000")

      let new_wait = "0"
      await DAO.change_time_between_raffles({time: new_wait})

      time = await contract_A.get_raffle_wait()
      expect(time).toBe("0")
    })

    it("the DAO can change the max number of users", async function(){
      users = await contract_A.get_max_users()
      expect(users).toBe(8100)

      await DAO.change_max_users({max_users: 1000})

      users = await contract_A.get_max_users()
      expect(users).toBe(1000)
    })

    it("the DAO can change the guardian", async function(){
      guardian = await contract_A.get_guardian()
      expect(guardian).toBe('guardian')

      await DAO.propose_new_guardian({guardian: user_B})

      guardian = await contract_A.get_guardian()
      expect(guardian).toBe('guardian')

      await contract_B.accept_being_guardian()

      guardian = await contract_A.get_guardian()
      expect(guardian).toBe(user_B)
    }) */

    it("ERROR: only dao can change fees", async function(){
      await expect(contract_A.change_pool_fees({fees:10})).rejects.toThrow()
    })

    it("ERROR: only dao can change time between reaffles", async function(){
      await expect(contract_A.change_time_between_raffles({time: "1"})).rejects.toThrow()
    })

    it("ERROR: only dao can change max users", async function(){
      await expect(contract_A.change_max_users({max_users: 30})).rejects.toThrow()
    })

    it("ERROR: only dao can propose a guardian", async function(){
      await expect(contract_A.propose_new_guardian({guardian: 'guardian'})).rejects.toThrow()
    })

    it("ERROR: Other people cannot accept being guardian", async function(){
      await DAO.propose_new_guardian({guardian: user_B})
      await expect(contract_A.accept_being_guardian()).rejects.toThrow()
    })
  });
});
