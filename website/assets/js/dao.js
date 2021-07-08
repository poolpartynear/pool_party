import {initNEAR, login, logout,
        add_proposal, get_proposals, act_proposal} from './blockchain/dao.js'

import {create_selector, form_make_readonly, form_make_editable,
        change_kind, show_kind, get_kind, get_proposal_name} from './dao_ui.js'

async function get_and_display_proposals(){
  console.log("Getting last 10 proposals from the DAO - VIEW")

  let proposals = await get_proposals(0, 10)
  window.proposals = proposals
  console.log(proposals)

  $('#proposals').html('<li class="logged-in" onclick="new_proposal()"> New Proposal </li>')
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

  // Make them read-only and plain text
  form_make_readonly(
    ['p-title', 'p-description', 'p-proposer', 'p-time', 'p-votes']
  )
  $('.not-for-create').show()

  // Fill their info
  let proposal = window.proposals[id]
  $('#p-title').html(`Proposal ${id} - ${proposal.status}`)
  $('#p-description')[0].value = proposal.description
  $('#p-proposer')[0].value = proposal.proposer
  $('#p-time')[0].value = new Date(proposal.submission_time).toLocaleString()
  $('#p-votes').html('')
  for(const k in proposal.votes){
    $('#p-votes').append(
      `<li> ${k}: ${proposal.votes[k]} </li>`
    )
  }

  $('.showing-proposal').show()
  $('.creating-proposal').hide()

  show_kind(proposal.kind, 'kind')
  const pname = get_proposal_name(proposal.kind)
  $('#p-title').html(`Prop. ${id} - ${pname}: ${proposal.status}`)
}

window.new_proposal = function(){
  // Make them editable
  form_make_editable(
    ['p-description', 'p-proposer', 'p-time', 'p-votes']
  )

  // Reset their info
  $('#p-title').html('Create a Proposal')
  $('#p-description')[0].value = ''
  $('#p-proposer')[0].value = ''
  
  $('.showing-proposal').hide()
  $('.creating-proposal').show()

  create_selector('kind')
}


window.change_kind = change_kind

window.vote = function vote(action){
  try{
    act_proposal(window.current_proposal_id, action)
    window.location.replace(window.location.origin + window.location.pathname)
  }catch{
    alert("Error while voting")
  }
}


window.getForm = function getFormData(form){
  var unindexed_array = form.serializeArray();
  var indexed_array = {};

  $.map(unindexed_array, function(n, i){
      indexed_array[n['name']] = n['value'];
  });

  return indexed_array;
}

window.submit_proposal = function submit_proposal(){
  const description = $('#p-description')[0].value
  const time_period = $('#p-submission_time')[0].value
  const kind = get_kind()
  add_proposal(description, time_period, kind)
}