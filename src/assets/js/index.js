import {initNEAR, login, logout, get_pool_info, get_account,
        stake, unstake, withdraw, raffle, update_prize,
        get_winners} from './blockchain'

// var pool,user;

async function display_pool_info(){
  let pool = await get_pool_info()
  console.log(pool)  
  $('.pool-tickets').html(pool.total_staked)
  $('.pool-prize').html(pool.prize)
  // $('.prize-timestamp').text(pool.next_prize_tmstmp)
  console.log("pool.next_prize_tmstmp");
  console.log(pool.next_prize_tmstmp);

  $("#time-left")
  .countdown(pool.next_prize_tmstmp, function(event) {
    $(this).text(
      event.strftime('%-D days %H:%M:%S')
    );
  });

  let winners = await get_winners()
  console.log(winners);
  for (var i = 0; i < winners.length; i++) {
    $('#winners').append(`<li>${winners[i]}</li>`);
  }
  
}

async function login_flow(){

  $('#account').html(window.walletAccount.accountId+' <i class="fas fa-caret-down"></i>')

  let user = await get_account(window.walletAccount.accountId)
  $('.user-staked').html(user.staked_balance)
  $('.user-unstaked').html(user.unstaked_balance)
  
  if(!user.available && user.unstaked_balance>0){
    $('.btn-balance').addClass('disabled');
    $('#balance-msg').html("Your balance will be ready to use next " + user.available_when);
  }
  window.user = user;
  // we need the user to call "raffle" when the pool is ready to raffle
  // the prize
  let pool = await get_pool_info()
  $('#user-odds').html(pool.total_staked/user.staked_balance);  
  //if(pool.next_prize_tmstmp < Date.now()){raffle()}
}


function flow(){

  display_pool_info()

  if (!window.walletAccount.accountId){
    // $(".logged-out").show()
    $(".logged-in").hide()
  }else{
    $(".logged-out").hide()
    // $(".logged-in").show()
    login_flow()
  }
}

window.login = login
window.logout = logout
window.withdraw = withdraw

window.buy_tickets = function(){
  const toStake = parseInt($("#how-much-input").val());
  if (!isNaN(toStake)){
    stake(toStake);
  }
}

// window.exchange_balance = function (){
//   const toStake = floor(user.unstaked_balance);
//   stake(toStake);
    // window.location.reload();
// }


// NOTE: RETURNS TRUE IF IT SUCCEDED.. USE IT TO UPDATE THE INTERFACE
window.leave_pool = function(){
  console.log(window.user);
  unstake(window.user.staked_balance);
  window.location.reload();
}


// NOTE: RETURNS TRUE IF IT SUCCEDED.. USE IT TO UPDATE THE INTERFACE
window.update_prize = update_prize

// NOTE: RETURNS the IDX of who won.. we could use it to keep track on a server... eventually
window.raffle = raffle

window.onload = function(){
  window.nearInitPromise = initNEAR()
  .then(flow)
  .catch(console.error)
}
