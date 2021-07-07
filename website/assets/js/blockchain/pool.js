import {getConfig, floor} from './aux.js'
export {floor} from './aux.js'

const nearConfig = getConfig('testnet')

window.nearApi = nearApi

export function login() {
  walletConnection.requestSignIn(nearConfig.contractName, 'Pool Party');
}

export function logout() {
  walletConnection.signOut()
  window.location.replace(window.location.origin + window.location.pathname)
}

export async function initNEAR() {
  // Initializing connection to the NEAR node.
  window.near = await nearApi.connect(Object.assign(nearConfig, {deps:{keyStore: new nearApi.keyStores.BrowserLocalStorageKeyStore()}}));

  // Needed to access wallet login
  window.walletConnection = await new nearApi.WalletConnection(window.near, nearConfig.contractName)
  window.walletAccount = walletConnection.account()

  // Initializing our contract APIs by contract name and configuration.
  window.contract = await near.loadContract(
    nearConfig.contractName,
    {viewMethods: ['get_account', 'get_pool_info', 'get_winners',
                   'get_to_unstake', 'select_winner', 'get_guardian',
                   'get_user_by_id', 'get_user_tickets', 'get_accum_weights'],
     changeMethods: ['unstake', 'deposit_and_stake', 'withdraw_all',
                     'update_prize', 'raffle', 'interact_external'],
     sender: window.walletAccount.accountId}
  );
}

export async function stake(_amount){
  let amount = nearApi.utils.format.parseNearAmount(_amount.toString())

  const account = window.walletConnection.account()
  account.functionCall(
    nearConfig.contractName, 'deposit_and_stake', {}, 180000000000000, amount
  )
}

export async function unstake(amount){
  amount = floor(amount)
  amount = nearApi.utils.format.parseNearAmount(amount.toString())
  let result = await contract.account.functionCall(
    nearConfig.contractName, 'unstake', {amount:amount}, 180000000000000, 0
  )
  return nearApi.providers.getTransactionLastResult(result)
}

export async function interact_external(){
  let result = await contract.account.functionCall(
    nearConfig.contractName, 'interact_external', {}, 300000000000000, 0
  )

  return nearApi.providers.getTransactionLastResult(result)
}

export async function withdraw(){
  let result = await contract.account.functionCall(
    nearConfig.contractName, 'withdraw_all', {}, 60000000000000, 0
  )

  return nearApi.providers.getTransactionLastResult(result)
}

export async function get_account(account_id){
  let info = await contract.get_account({account_id})

  info.staked_balance = floor(nearApi.utils.format.formatNearAmount(info.staked_balance))
  info.unstaked_balance = floor(nearApi.utils.format.formatNearAmount(info.unstaked_balance))
  info.available_when = Number(info.available_when)

  return info 
}

export async function get_pool_info(){
  let info = await contract.get_pool_info()
  info.total_staked = floor(nearApi.utils.format.formatNearAmount(info.total_staked))
  info.reserve = floor(nearApi.utils.format.formatNearAmount(info.reserve))
  info.prize = floor(nearApi.utils.format.formatNearAmount(info.prize))
  info.next_prize_tmstmp = (info.next_prize_tmstmp/1000000).toFixed(0)
  return info  
}

export async function get_winners(){
  let info = await contract.get_winners()

  for(let i=0; i<info.length;i++){
    info[i].amount = floor(nearApi.utils.format.formatNearAmount(info[i].amount))
  }
  return info 
}

export async function update_prize(){
  let result = await contract.account.functionCall(
    nearConfig.contractName, 'update_prize', {}, 50000000000000, 0
  )
  let succeed = nearApi.providers.getTransactionLastResult(result)
  return succeed
}

export async function raffle(){
  let result = await contract.account.functionCall(
    nearConfig.contractName, 'raffle', {}, 300000000000000, 0
  )
  let winner = nearApi.providers.getTransactionLastResult(result)
  return winner
}
