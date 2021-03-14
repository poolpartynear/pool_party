import 'regenerator-runtime/runtime'
import * as nearAPI from "near-api-js";
let getConfig = require('./config')

const nearConfig = getConfig('testnet')

export function floor(value, decimals=2) {
  value = parseFloat(value)
  return Number(Math.floor(value+'e'+decimals)+'e-'+decimals);
}

export function login() {
  walletConnection.requestSignIn(nearConfig.contractName, 'Pool Party');
}

export function logout() {
  walletConnection.signOut()
  window.location.replace(window.location.origin + window.location.pathname)
}

export async function initNEAR() {
  // Initializing connection to the NEAR node.
  window.near = await nearAPI.connect(Object.assign(nearConfig, {deps:{keyStore: new nearAPI.keyStores.BrowserLocalStorageKeyStore()}}));

  // Needed to access wallet login
  window.walletConnection = await new nearAPI.WalletConnection(window.near, nearConfig.contractName)
  window.walletAccount = walletConnection.account()

  // Initializing our contract APIs by contract name and configuration.
  window.contract = await near.loadContract(
    nearConfig.contractName,
    {viewMethods: ['get_account', 'get_pool_info', 'get_winners'],
     changeMethods: ['unstake', 'deposit_and_stake', 'withdraw_all',
                     'update_prize', 'raffle'],
     sender: window.walletAccount.accountId}
  );
}

export async function stake(amount){
  amount = nearAPI.utils.format.parseNearAmount(amount.toString())
  const account = window.walletConnection.account()
  account.functionCall(
    nearConfig.contractName, 'deposit_and_stake', {}, 300000000000000, amount
  )
}

export async function unstake(amount){
  amount = floor(amount)
  amount = nearAPI.utils.format.parseNearAmount(amount.toString())
  let result = await contract.account.functionCall(
    nearConfig.contractName, 'unstake', {amount:amount}, 300000000000000, 0
  )
  return nearAPI.providers.getTransactionLastResult(result)
}

export async function unstake_external(){
  let result = await contract.account.functionCall(
    nearConfig.contractName, 'unstake_external', {}, 300000000000000, 0
  )

  return nearAPI.providers.getTransactionLastResult(result)
}

export async function withdraw(){
  let result = await contract.account.functionCall(
    nearConfig.contractName, 'withdraw_all', {}, 300000000000000, 0
  )

  return nearAPI.providers.getTransactionLastResult(result)
}

export async function withdraw_external(){
  let result = await contract.account.functionCall(
    nearConfig.contractName, 'withdraw_external', {}, 300000000000000, 0
  )

  return nearAPI.providers.getTransactionLastResult(result)
}

export async function get_account(account_id){
  let info = await contract.get_account({account_id})

  info.staked_balance = floor(nearAPI.utils.format.formatNearAmount(info.staked_balance))
  info.unstaked_balance = floor(nearAPI.utils.format.formatNearAmount(info.unstaked_balance))
  info.available_when = Number(info.available_when)

  return info 
}

export async function get_pool_info(){
  let info = await contract.get_pool_info()
  info.total_staked = floor(nearAPI.utils.format.formatNearAmount(info.total_staked))
  info.prize = floor(nearAPI.utils.format.formatNearAmount(info.prize))
  info.next_prize_tmstmp = (info.next_prize_tmstmp/1000000).toFixed(0)
  return info  
}

export async function get_winners(){
  let info = await contract.get_winners()

  for(let i=0; i<info.length;i++){
    info[i].amount = floor(nearAPI.utils.format.formatNearAmount(info[i].amount))
  }
  return info 
}

export async function update_prize(){
  let result = await contract.account.functionCall(
    nearConfig.contractName, 'update_prize', {}, 300000000000000, 0
  )
  let succeed = nearAPI.providers.getTransactionLastResult(result)
  return succeed
}

export async function raffle(){
  let result = await contract.account.functionCall(
    nearConfig.contractName, 'raffle', {}, 300000000000000, 0
  )
  let winner = nearAPI.providers.getTransactionLastResult(result)
  return winner
}
