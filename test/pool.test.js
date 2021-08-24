describe('PoolParty', function () {
  let user_A, user_B, user_C
  let contract_A, contract_B, contract_C

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 1200000;

  beforeAll(async function () {
    // NOTE: USER_A is GUARDIAN, USER_B is DAO
    user_A = 'test-account-1629845366283-2739389' 
    user_B = 'test-account-1629845108929-9775276'
    user_C = 'test-account-1629844942492-2270535'

    const near = await nearlib.connect(nearConfig);
    const accountId = nearConfig.contractName;

    function create_contract(user){
      return near.loadContract(nearConfig.contractName, {
        viewMethods: ['get_account'],
        changeMethods: ['get_pool_info', 'deposit_and_stake', 'unstake',
                        'withdraw_all', 'update_prize', 'interact_external',
                        'get_pool_tickets',
                        'get_user_tickets', 'deposit_and_stake_callback',
                        'unstake_external_callback', 'withdraw_external_callback',
                        'withdraw_all_callback', "update_prize_callback"
                      ],
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

    interact_external = async function(contract){
      let result = await contract.account.functionCall(
        nearConfig.contractName, 'interact_external', {}, 300000000000000, 0
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

    get_pool_fees = async function(contract){
      let fees = await contract.get_pool_fees()
      return 100 / parseFloat(fees)
    }

    change_pool_fees = async function(fees, contract){
      amount = (100/ fees).toString()
      let result = await contract.change_pool_fees({fees})
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

    it("ERROR: doesn't allow anyone but the guardian to go first", async function(){
      await deposit_and_stake(5, contract_B)
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

      expect(pool_info.total_staked).toBe(9+11+0.123456)
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

    it("on external unstake, the prize and pool tickets is updated", async function(){
      let pool = 'mypool'
      if(pool == 'mypool'){
        let result = await interact_external(contract_C)
        expect(result).toBe(true)

        await update_prize()

        // We are using my pool, which doubles the money you deposit
        let pool_info = await get_pool_info(contract_A)

        expect(pool_info.total_staked).toBe(9+11+0.123456)
        expect(pool_info.prize).toBe(10+12.123+0.123456)
      }
    })

    it("can claim money unstacked in 1 turn", async function(){
      // Since this user asked to unstake money before the unstake_external
      // they only needs to wait one turn
      account = await get_account(user_A)
      expect(account.staked_balance).toBe(9)
      expect(account.unstaked_balance).toBe(1)
      expect(account.available_when).toBe(1)
    })

    it("can claim money unstacked in 2 turns", async function(){
      // If a user unstakes money now, it should wait 2 turns
      await unstake(0.001, contract_C)
      account = await get_account(user_C)
      expect(account.staked_balance).toBe(0.123456 - 0.001)
      expect(account.unstaked_balance).toBe(0.001)
      expect(account.available_when).toBe(2)
    })

    it("on a raffle, the reserve gets a 5% and the winner the rest", async function(){
      let current_balances = [9, 11, 0.122456]
      let prize = 10+12.123+0.123456
      let winner = await raffle()

      let reserve_prize = prize * 0.05
      let winner_prize = prize - reserve_prize

      balance_A = await get_account(user_A)
      expect(balance_A.staked_balance).toBeCloseTo(current_balances[0] + reserve_prize)

      users = [user_A, user_B, user_C]

      for(i=1; i<3; i++){
        expected = current_balances[i]
        expected += (i == winner)? winner_prize : 0
        user_balance = await get_account(users[i])
        expect(user_balance.staked_balance).toBeCloseTo(expected)
      }
    })

    it("can withdraw all correctly", async function(){
      
      balance = await get_account_balance(user_A)
      
      await interact_external(contract_B)
      await withdraw_all(contract_A)

      new_balance = await get_account_balance(user_A)
      expect(Math.abs(new_balance.total - balance.total)).toBeLessThan(1)

      account = await get_account(user_A)
      expect(account.staked_balance).toBe(10.1123228)
      expect(account.unstaked_balance).toBe(0)
      expect(account.available_when).toBe(0)

      account = await get_account(user_C)
      expect(account.unstaked_balance).toBe(0.001)
      expect(account.available_when).toBe(1)
    })

    it("ERROR: cannot raffle again, it has to wait", async function(){
      await raffle()
    })

    it("ERROR: cannot unstack more money than available", async function(){
      await unstake(1, contract_C)
    })

    it("ERROR: cannot access method deposit_and_stake_callback", async ()=>{
      await contract_A.deposit_and_stake_callback({idx:1, amount:'1'})  
    })

    it("ERROR: cannot access method unstake_external_callback", async ()=>{
      await contract_A.unstake_external_callback({user:user_A, amount:"100"})  
    })

    it("ERROR: cannot access method _withdraw_exteral", async ()=>{
      await contract_A.withdraw_external_callback()  
    })

    it("ERROR: cannot access method withdraw_all_callback", async ()=>{
      await contract_A.withdraw_all_callback({idx:0, amount:'1'})  
    })

    it("ERROR: cannot access method update_prize_callback", async ()=>{
      await contract_A.update_prize_callback()  
    })
  });
});
