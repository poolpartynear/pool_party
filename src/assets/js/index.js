import {initNEAR, login, logout, get_pool_info, get_account,
        stake, unstake, withdraw, raffle, update_prize,
        get_winners, floor, unstake_external, withdraw_external} from './blockchain'

async function get_and_display_pool_info(){
  console.log("Getting information from the pool - VIEW")

  window.pool = await get_pool_info()

  $('.pool-tickets').html(pool.total_staked)
  $('.pool-prize').html(pool.prize)

  $("#time-left")
  .countdown(pool.next_prize_tmstmp, function(event) {
    $(this).text(
      event.strftime('%H:%M:%S')
    );
  });

  console.log("Getting winners - VIEW")  
  let winners = await get_winners()

  $('#winners').html('')
  for (var i = 0; i < winners.length; i++) {
    $('#winners').append(`<li>${winners[i].account_id} - ${winners[i].amount} N</li>`);
  }
}

async function login_flow(){
  $('#account').html(window.walletAccount.accountId+' <i class="fas fa-caret-down"></i>')

  if(pool.next_prize_tmstmp < Date.now() && pool.total_staked>0){
    console.log("Asking pool to make the raffle")
    await raffle()
  }else{
    console.log("Asking pool to update prize")
    await update_prize()
  }

  if(pool.withdraw_ready){
    console.log("Asking pool to withdraw from the external pool")
    await withdraw_external()

    console.log("Asking pool to unstake from the external pool")
    await unstake_external()
  }

  get_and_display_user_info()
  get_and_display_pool_info()
}

async function get_and_display_user_info(){
  // reset ui
  const spin = '<span class="fas fa-sync fa-spin"></span>'
  $('.user-staked').html(spin)
  $('.user-unstaked').html(spin)
  $('#user-odds').html(spin)
  $('#btn-leave').hide()
  $('#withdraw_btn').hide()
  $('#withdraw-msg').show()
  $('#withdraw-countdown').hide()

  console.log("Getting user information - VIEW")
  window.user = await get_account(window.walletAccount.accountId)
  $('.user-staked').html(user.staked_balance)
  $('.user-unstaked').html(user.unstaked_balance)
  
  if(user.staked_balance > 0){
    $('#user-odds').html((user.staked_balance/pool.total_staked).toFixed(2))
  }else{
    $('#user-odds').html(0)
  }

  if(user.staked_balance > 0){$('#btn-leave').show()}

  if(user.unstaked_balance > 0 && !user.available){
    $('#withdraw_btn').hide()
    $('#withdraw-msg').hide()
    $('#withdraw-countdown').show()

    $("#withdraw-time-left").html(user.available_when*3 + " Days")
  }

  if(user.available){
    $('#withdraw-msg').html("You can withdraw your NEAR!");
    $('#withdraw_btn').show()
  }
}

async function flow(){
  await get_and_display_pool_info()

  if (!window.walletAccount.accountId){
    $(".logged-in").hide()
  }else{
    $(".logged-out").hide()
    login_flow()
  }
}

window.buy_tickets = function(){
  const toStake = floor($("#how-much-input").val());
  if (!isNaN(toStake)){
    $('#buy-btn').html('<span class="fas fa-sync fa-spin text-white"></span>')
    stake(toStake);
  }
}

window.leave_pool = async function(){
  if(window.user.staked_balance > 0){
    const amount = floor($("#exchange-input").val());
    if (!isNaN(amount)){
      $('.user-staked').html('<span class="fas fa-sync fa-spin"></span>')
      const result = await unstake(amount);
      if(result){
        get_and_display_user_info()
        get_and_display_pool_info()
      }
    }
  }
}

window.unstake = unstake
window.unstake_external = unstake_external
window.withdraw_external = withdraw_external

window.withdraw = async function(){
  console.log("Withdrawing all from user")

  $('.user-unstaked').html('<span class="fas fa-sync fa-spin"></span>')

  try{
    await withdraw() // throws error on fail, nothing on success
    get_and_display_user_info() 
  }catch{
    $('.user-unstaked').html('try again later')
  }
}

window.onload = function(){
  window.nearInitPromise = initNEAR()
  .then(flow)
  .catch(console.error)
}

window.login = login
window.logout = logout

