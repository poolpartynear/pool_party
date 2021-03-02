describe('PoolParty', function () {
  let user_A, user_B, user_C
  let contract_A, contract_B, contract_C

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 1200000;

  beforeAll(async function () {
    user_A = 'test-account-1614519168704-9311104'
    user_B = 'test-account-1614519219937-7846099'
    user_C = 'test-account-1614519260845-4406393'

    const near = await nearlib.connect(nearConfig);
    const accountId = nearConfig.contractName;

    function create_contract(user){
      return near.loadContract(nearConfig.contractName, {
        viewMethods: ['get_account'],
        changeMethods: ['get_pool_info', 'deposit_and_stake', 'unstake',
                        'withdraw_all', 'update_prize', 'withdraw_external',
                        'unstake_external', 'get_pool_tickets',
                        'get_user_tickets', '_deposit_and_stake',
                        '_unstake_external', '_withdraw_external', '_withdraw_all'],
        sender: user
      })
    }

    contract_A = await create_contract(user_A)
    contract_B = await create_contract(user_B)
    contract_C = await create_contract(user_C)

    get_account_balance = async function(accountId){
       let acc = await near.account(accountId)
       let balance = await acc.getAccountBalance()
       balance.total = parseFloat(nearlib.utils.format.formatNearAmount(balance.total))
       balance.available = parseFloat(nearlib.utils.format.formatNearAmount(balance.available))
       return balance
    }

    deposit_and_stake = async function(amount, contract){
      amount = nearAPI.utils.format.parseNearAmount(amount.toString())
      return await contract.account.functionCall(
        nearConfig.contractName, 'deposit_and_stake', {}, 300000000000000, amount
      )
    }

    unstake = async function(amount, contract){
      amount = nearAPI.utils.format.parseNearAmount(amount.toString())
      let result = await contract.account.functionCall(
        nearConfig.contractName, 'unstake', {amount:amount}, 300000000000000, 0
      )
      return nearlib.providers.getTransactionLastResult(result)
    }

    unstake_external = async function(contract){
      let result = await contract.account.functionCall(
        nearConfig.contractName, 'unstake_external', {}, 300000000000000, 0
      )

      return nearlib.providers.getTransactionLastResult(result)
    }

    withdraw_external = async function(contract){
      let result = await contract.account.functionCall(
        nearConfig.contractName, 'withdraw_external', {}, 300000000000000, 0
      )

      return nearlib.providers.getTransactionLastResult(result)
    }

    withdraw_all = async function(contract){
      let result = await contract.account.functionCall(
        nearConfig.contractName, 'withdraw_all', {}, 300000000000000, 0
      )

      return nearlib.providers.getTransactionLastResult(result)
    }

    get_account = async function(account_id, contract=contract_A){
      let info = await contract.get_account({account_id})
      info.staked_balance = parseFloat(nearlib.utils.format.formatNearAmount(info.staked_balance))
      info.unstaked_balance = parseFloat(nearlib.utils.format.formatNearAmount(info.unstaked_balance))
      info.available_when = Number(info.available_when)
      return info
    }

    get_pool_info = async function(contract){
      let result = await contract.account.functionCall(
        nearConfig.contractName, 'get_pool_info', {}, 300000000000000, 0
      )
      info = nearlib.providers.getTransactionLastResult(result)
      info.total_staked = parseFloat(nearAPI.utils.format.formatNearAmount(info.total_staked))
      info.prize = parseFloat(nearAPI.utils.format.formatNearAmount(info.prize))
      return info  
    }

    raffle = async function(contract=contract_A){
      let result = await contract.account.functionCall(
        nearConfig.contractName, 'raffle', {}, 300000000000000, 0
      )
      info = nearlib.providers.getTransactionLastResult(result)
      return info  
    }

    update_prize = async function(contract=contract_A){
      let result = await contract.account.functionCall(
        nearConfig.contractName, 'update_prize', {}, 300000000000000, 0
      )
      info = nearlib.providers.getTransactionLastResult(result)
      return info  
    }
  });

  describe('Pool', function () {
    it("responds empty user for non existing users", async function(){
      let info = await get_account("non-existent-user")
      expect(info.staked_balance).toBe(0, "non-user has tickets")
      expect(info.unstaked_balance).toBe(0, "non-user is unstaked_balance")
      expect(info.available).toBe(false, "non-user cannot withdraw")
    })

    it("responds empty pool at beggining", async function(){
      let info = await get_pool_info(contract_A)
      expect(info.total_staked).toBe(0, "pool has tickets")
      expect(info.prize).toBe(0, "pool has price")
    })

    it("correctly add tickets to new users", async function(){
      let user_A_info = await get_account(user_A)
      let pool_info = await get_pool_info(contract_A)
      
      // User A buys tickets
      await deposit_and_stake(5, contract_A)

      // Check it updated correctly
      let up_user_A_info = await get_account(user_A)
      let up_pool_info = await get_pool_info(contract_A)

      expect(up_user_A_info.staked_balance).toBe(5, "tickets B wrong")
      expect(up_user_A_info.unstaked_balance).toBe(0, "A unstaked_balance changed")
      expect(up_user_A_info.available).toBe(false, "available changed")
      expect(up_pool_info.total_staked).toBe(5, "Pool tickets wrong")

      // User B buys tickets
      await deposit_and_stake(10, contract_B)

      up_user_A_info = await get_account(user_A)
      up_user_B_info = await get_account(user_B)
      up_pool_info = await get_pool_info(contract_A)

      const infos = [up_user_A_info, up_user_B_info]
      const tickets = [5, 10]

      for(i=0; i<2; i++){
        expect(infos[i].staked_balance).toBe(tickets[i])
        expect(infos[i].unstaked_balance).toBe(0)
        expect(infos[i].available).toBe(false)
      }

      expect(up_pool_info.total_staked).toBe(15, "Pool tickets wrong")
    });

    it("has the right prize", async function(){
      let pool = 'mypool'
      if(pool == 'mypool'){
        // We are using my pool, which doubles the money you deposit
       
        console.log("update_prize")
        await update_prize()
        let pool_info = await get_pool_info(contract_A)
        expect(pool_info.prize).toBe(15)
      }
    })

    it("correctly add more tickets to existing users", async function(){
      // Users buy tickets
      await deposit_and_stake(5, contract_A)
      await deposit_and_stake(0.123456, contract_C)
      await deposit_and_stake(2.123, contract_B)

      // get info
      user_A_info = await get_account(user_A)
      user_B_info = await get_account(user_B)
      user_C_info = await get_account(user_C)

      const infos = [user_A_info, user_B_info, user_C_info]
      const tickets = [10, 12.123, 0.123456]

      for(i=0; i<3; i++){
        expect(infos[i].staked_balance).toBe(tickets[i])
        expect(infos[i].unstaked_balance).toBe(0)
        expect(infos[i].available).toBe(false)
      }
      
      pool_info = await get_pool_info(contract_A)
      expect(pool_info.total_staked).toBe(10+12.123+0.123456)  
    })

    it("correctly unstacks money", async function(){
      await unstake(1, contract_A)
      await unstake(1.123, contract_B)

      // only A should have changed
      user_A_info = await get_account(user_A)
      user_B_info = await get_account(user_B)
      user_C_info = await get_account(user_C)
      pool_info = await get_pool_info(contract_A)

      const infos = [user_A_info, user_B_info, user_C_info]
      const tickets = [9, 11, 0.123456]
      const unstaked_balance = [1, 1.123, 0]
      const available = [false, false, false]

      for(i=0; i<3; i++){
        expect(infos[i].staked_balance).toBe(tickets[i])
        expect(infos[i].unstaked_balance).toBe(unstaked_balance[i])
        expect(infos[i].available).toBe(available[i])
      }

      expect(pool_info.total_staked).toBe(10+12.123+0.123456)
    })

    it("if no one called unstake_external, the prize doesn't change", async function(){
      let pool = 'mypool'
      if(pool == 'mypool'){
        await update_prize()

        // We are using my pool, which doubles the money you deposit
        let pool_info = await get_pool_info(contract_A)

        expect(pool_info.prize).toBe(10+12.123+0.123456)
      }
    })

    it("ERORR: cannot withdraw since nobody unstaked", async function(){
      await withdraw_external(contract_B)
    })


    it("on external unstake, the prize and pool tickets is updated", async function(){
      let pool = 'mypool'
      if(pool == 'mypool'){
        let result = await unstake_external(contract_C)
        expect(result).toBe(true)

        await update_prize()

        // We are using my pool, which doubles the money you deposit
        let pool_info = await get_pool_info(contract_A)

        expect(pool_info.total_staked).toBe(9+11+0.123456)
        expect(pool_info.prize).toBe(10+12.123+0.123456)
      }
    })

    it("can claim money unstacked in 2 turns", async function(){
      account = await get_account(user_A)
      expect(account.staked_balance).toBe(9)
      expect(account.unstaked_balance).toBe(1)
      expect(account.available_when).toBe(2)
    })

    it("ERROR: cannot unstack more money than available", async function(){
      await unstake(1, contract_C)
    })

    it("ERROR: cannot access method _deposit_and_stake", async ()=>{
      await contract_A._deposit_and_stake({amount:'1'})  
    })

    it("ERROR: cannot access method _unstake_external", async ()=>{
      await contract_A._unstake_external()  
    })
    it("ERROR: cannot access method _withdraw_exteral", async ()=>{
      await contract_A._withdraw_external()  
    })
    it("ERROR: cannot access method _withdraw_all", async ()=>{
      await contract_A._withdraw_all({idx:0, amount:'1'})  
    })

  });
});
