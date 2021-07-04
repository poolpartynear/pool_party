describe('PoolParty', function () {
  let user_A, user_B, user_C
  let contract_A, contract_B, contract_C

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 1200000;

  beforeAll(async function () {
    // NOTE: USER_A is GUARDIAN, USER_B is DAO
    user_A = 'test-account-1625088444921-3359490' 
    user_B = 'test-account-1625088423773-5983746'
    user_C = 'test-account-1625088405590-3197214'

    const near = await nearlib.connect(nearConfig);
    const accountId = nearConfig.contractName;

    function create_contract(user){
      return near.loadContract(nearConfig.contractName, {
        viewMethods: ['get_account'],
        changeMethods: ['get_pool_fees', 'change_pool_fees', 'get_raffle_wait',
                        'change_time_between_raffles', 'get_max_users',
                        'change_max_users', 'get_guardian',
                        'propose_new_guardian', 'accept_being_guardian'
                      ],
        sender: user
      })
    }

    contract_A = await create_contract(user_A)
    contract_B = await create_contract(user_B)
    contract_C = await create_contract(user_C)

    get_pool_fees = async function(contract){
      let fees = await contract.get_pool_fees()
      return parseFloat(fees)
    }

    change_pool_fees = async function(fees, contract){
      fees = fees.toString()
      let result = await contract.change_pool_fees({fees})
    }
  });

  describe('DAO', function () {
    it("the DAO can change the fees", async function(){
      fees = await get_pool_fees(contract_A)
      expect(fees).toBe(5)

      await change_pool_fees(10, contract_B)

      fees = await get_pool_fees(contract_A)
      expect(fees).toBe(10)
    })

    it("the DAO can change the raffle time", async function(){
      time = await contract_A.get_raffle_wait()
      expect(time).toBe("86400000000000")

      let new_wait = "85000000000000"
      await contract_B.change_time_between_raffles({time: new_wait})

      time = await contract_A.get_raffle_wait()
      expect(time).toBe("85000000000000")
    })

    it("the DAO can change the max number of users", async function(){
      users = await contract_A.get_max_users()
      expect(users).toBe(8100)

      await contract_B.change_max_users({max_users: 1000})

      users = await contract_A.get_max_users()
      expect(users).toBe(1000)
    })

    it("the DAO can change the guardian", async function(){
      guardian = await contract_A.get_guardian()
      expect(guardian).toBe(user_A)

      await contract_B.propose_new_guardian({guardian: user_C})

      guardian = await contract_A.get_guardian()
      expect(guardian).toBe(user_A)

      await contract_C.accept_being_guardian()

      guardian = await contract_A.get_guardian()
      expect(guardian).toBe(user_C)
    })

    it("ERROR: only dao can change fees", async function(){
      await change_pool_fees(10, contract_A)
    })

    it("ERROR: only dao can change time between reaffles", async function(){
      await contract_A.change_time_between_raffles({time: "1"})
    })

    it("ERROR: only dao can change max users", async function(){
      await contract_A.change_max_users({max_users: 30})
    })

    it("ERROR: only dao can propose a guardian", async function(){
      await contract_A.propose_new_guardian({guardian: 'guardian'})
    })

    it("ERROR: Other people cannot accept being guardian", async function(){
      await contract_B.propose_new_guardian({guardian: user_C})
      await contract_A.accept_being_guardian()
    })
  });
});
