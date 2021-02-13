import {initNEAR, login, logout, get_pool_info, get_account,
        stake, unstake, withdraw, raffle, update_prize,
        get_winners} from './blockchain'

async function display_pool_info(){
  let pool = await get_pool_info()
  console.log(pool)  
  $('#pool-tickets').text(pool.total_staked)
  $('#pool-prize').text(pool.prize)
  $('#prize-timestamp').text(pool.next_prize_tmstmp)

  let winners = await get_winners()
  console.log(winners)
  $('#winners').text(winners)
}

async function login_flow(){

  $('#account').text(window.walletAccount.accountId)

  let user = await get_account(window.walletAccount.accountId)
  console.log(user) 
  $('#user-staked').text(user.staked_balance)
  $('#user-unstaked').text(user.unstaked_balance)

  if(user.available){
    $('#user-action').text("can claim")
    $('#withdraw-all').show()
  }else{
    $('#user-action').text('are withdrawing')
    $('#user-when').text("which will be available on the " + user.available_when)
  }

  // we need the user to call "raffle" when the pool is ready to raffle
  // the prize
  let pool = await get_pool_info()
  //if(pool.next_prize_tmstmp < Date.now()){raffle()}
}


function flow(){

  display_pool_info()

  if (!window.walletAccount.accountId){
    $("#logged-out").show()
  }else{
    $("#logged-in").show()
    login_flow()
  }
}

window.login = login
window.logout = logout
window.withdraw = withdraw
window.stake = stake

// NOTE: RETURNS TRUE IF IT SUCCEDED.. USE IT TO UPDATE THE INTERFACE
window.unstake = unstake

// NOTE: RETURNS TRUE IF IT SUCCEDED.. USE IT TO UPDATE THE INTERFACE
window.update_prize = update_prize

// NOTE: RETURNS the IDX of who won.. we could use it to keep track on a server... eventually
window.raffle = raffle

window.onload = function(){
  window.nearInitPromise = initNEAR()
  .then(flow)
  .catch(console.error)
}
