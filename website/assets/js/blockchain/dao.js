import {getConfig} from './aux.js'
const nearConfig = getConfig('testnet')

window.nearApi = nearApi

export function login() {
  walletConnection.requestSignIn(nearConfig.DAOaddress, 'Pool Party - DAO');
}

export function logout() {
  walletConnection.signOut()
  window.location.replace(window.location.origin + window.location.pathname)
}

export async function initNEAR() {
  // Initializing connection to the NEAR node.
  window.near = await nearApi.connect(Object.assign(nearConfig, {deps:{keyStore: new nearApi.keyStores.BrowserLocalStorageKeyStore()}}));

  // Needed to access wallet login
  window.walletConnection = await new nearApi.WalletConnection(window.near, nearConfig.DAOaddress)
  window.walletAccount = walletConnection.account()

  // Initializing our contract APIs by contract name and configuration.
  window.contract = await near.loadContract(
    nearConfig.DAOaddress,
    {viewMethods: ['get_proposals'],
     changeMethods: ['act_proposal', 'add_proposal'],
     sender: window.walletAccount.accountId}
  );
}

export async function add_proposal(description, period_of_time_to_vote, kind){
  /* 
  add_proposal '{"proposal": {"description": "test", "submission_time":"60000000000",
                 "kind": {
                   "AddMemberToRole":
                   {"member_id": "another-account.testnet", "role": "council"}}}}'
  */
  let one_near = nearApi.utils.format.parseNearAmount("1")
  let submission_time = period_of_time_to_vote

  let proposal = {
    proposal: {description:description,
               submission_time:period_of_time_to_vote,
               kind:kind}
  }

  const account = window.walletConnection.account()
  account.functionCall(
    nearConfig.DAOaddress, 'add_proposal', proposal, 300000000000000, one_near
  )
}


export async function act_proposal(proposal_id, action){
  const account = window.walletConnection.account()
  let result = await account.functionCall(
    nearConfig.DAOaddress, 'act_proposal', {id:proposal_id, action:action},
    180000000000000, 0
  )
  return nearApi.providers.getTransactionLastResult(result)
}



export async function get_council(){
  return await contract.get_council();
}

export async function get_proposals(from_index, limit){
  let info = await contract.get_proposals({from_index:from_index, limit:limit})

  for(let i=0; i<info.length;i++){
    info[i].submission_time /= 1000000
  }
  
  return info
}