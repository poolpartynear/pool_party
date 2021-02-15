import {initNEAR, login, logout, get_pool_info, get_account,
        stake, unstake, withdraw, raffle, update_prize,
        get_winners} from './blockchain'

async function display_pool_info(){
  let pool = await get_pool_info()

  $('.pool-tickets').html(pool.total_staked)
  $('.pool-prize').html(pool.prize.toFixed(2))

  $("#time-left")
  .countdown(pool.next_prize_tmstmp, function(event) {
    $(this).text(
      event.strftime('%-D days %H:%M:%S')
    );
  });

  let winners = await get_winners()

  for (var i = 0; i < winners.length; i++) {
    $('#winners').append(`<li>${winners[i]}</li>`);
  }
}

async function login_flow(){

  await update_prize()

  $('#account').html(window.walletAccount.accountId+' <i class="fas fa-caret-down"></i>')

  let user = await get_account(window.walletAccount.accountId)
  $('.user-staked').html(user.staked_balance)
  $('.user-unstaked').html(user.unstaked_balance)

  if(user.unstaked_balance > 0 && !user.available){
    $('#withdraw_btn').hide()
    $('#withdraw-msg').hide()
    $('#withdraw-countdown').show()
    $("#withdraw-time-left")
    .countdown(user.available_when, function(event) {
      $(this).text(
        event.strftime('%-D days %H:%M:%S')
      );
     });
  }

  if(user.available){
    $('#withdraw-msg').html("You can withdraw your NEAR!");
    $('#withdraw_btn').show()
  }

  window.user = user;
  // we need the user to call "raffle" when the pool is ready to raffle

  let pool = await get_pool_info()
  $('#user-odds').html((user.staked_balance/pool.total_staked).toFixed(2))
  if(pool.next_prize_tmstmp < Date.now()){raffle()}
}


function flow(){

  display_pool_info()

  if (!window.walletAccount.accountId){
    $(".logged-in").hide()
  }else{
    $(".logged-out").hide()
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

// NOTE: RETURNS TRUE IF IT SUCCEDED.. USE IT TO UPDATE THE INTERFACE
window.leave_pool = async function(){
  await unstake(window.user.staked_balance);
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
