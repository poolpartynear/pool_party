import {initNEAR, login, logout, get_proposals, act_proposal} from './blockchain/dao.js'


async function get_and_display_proposals(){
  console.log("Getting last 10 proposals from the DAO - VIEW")

  let proposals = await get_proposals(0, 10)
  window.proposals = proposals
  console.log(proposals)

  $('#proposals').html('')
  for (var i = 0; i < proposals.length; i++) {
    let id = proposals[i].id
    $('#proposals').append(
      `<li onclick="show_proposal(${id})"> Proposal ${id} - ${proposals[i].status} </li>`
    );
  }

  if(proposals.length > 0){ show_proposal(0) }
}

async function flow(){
  get_and_display_proposals()
  if (!window.walletAccount.accountId){
    $(".logged-in").hide()
  }else{
    $(".logged-out").hide()
    $('#account').html(window.walletAccount.accountId)
  }
}

// LOGIN - LOGOUT

window.onload = function(){
  window.nearInitPromise = initNEAR()
  .then(flow)
  .catch(console.error)
}

window.login = login
window.logout = logout

window.show_proposal = function(id){
  window.current_proposal_id = id

  let proposal = window.proposals[id]
  $('#p-title').html(`${id} - ${proposal.status}`)
  $('#p-description').html(proposal.description)
  $('#p-proposer').html(proposal.proposer)
  $('#p-time').html(new Date(proposal.submission_time).toLocaleString())
  $('#p-votes').html('')
  for(const k in proposal.votes){
    $('#p-votes').append(
      `<li> ${k}: ${proposal.votes[k]} </li>`
    )
  }
}

window.vote = function vote(action){
  act_proposal(window.current_proposal_id, action)
}