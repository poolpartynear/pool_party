// Form Group Component
function form_group(label, id, value){
 
  return `
  <div class="form-group row">
    <label for="${id}" class="col-sm-2 col-form-label">${label}:</label>
    <div class="col-sm-10">
      <input class="form-control" id="${id}" value="${value}">
    </div>
  </div>
  `
}

// Class
class ProposalKind{
  constructor(name, labels, ids){
    this.name = name
    this.labels = labels
    this.ids = ids
  }
  
  show(proposal_obj, where){
    let html = ''

    for(let i=0; i < this.ids.length; i++){
      html += form_group(this.labels[i], this.ids[i], proposal_obj[this.ids[i]])
    }

    $(`#${where}`).html(html)
    
    form_make_readonly(this.ids)
  }

  create(where){
    let html = ''

    for(let i=0; i < this.ids.length; i++){
      html += form_group(this.labels[i], this.ids[i], '')
    }

    $(`#${where}`).html(html)
  }

  get(){
    let fields = {}
    for(let i=0; i < this.ids.length; i++){
      fields[this.ids[i]] = $(`#${this.ids[i]}`)[0].value
    }

    let result = {}
    result[this.name] = fields

    return result
  }
}

// Instances

const AddMember = new ProposalKind(
  'AddMemberToRole', ['Member id', 'Role'], ['member_id', 'role']
)

const Transfer = new ProposalKind(
  'Transfer', ['Token Address', 'Receiver', 'Amount'], ['token_id', 'receiver_id', "amount"]
)

const FunctionCall = new ProposalKind(
  'FunctionCall', ['Contract Address', 'Function'], ['receiver_id', 'actions']
)

// Show ------------------------------------------------
export function form_make_readonly(elems){
  for(let i=0; i<elems.length; i++){
    $(`#${elems[i]}`).removeClass('form-control')
    $(`#${elems[i]}`).addClass('form-control-plaintext')
    $(`#${elems[i]}`)[0].readOnly = true
  }
}

const proposals = [AddMember, FunctionCall, Transfer]

export function get_proposal_name(kind_obj){
  for(let i=0; i<proposals.length;i++){
    if(kind_obj.hasOwnProperty(proposals[i].name)){
      return proposals[i].name
    }
  }
}

export function show_kind(kind_obj, where){
  for(let i=0; i<proposals.length;i++){
    if(kind_obj.hasOwnProperty(proposals[i].name)){
      return proposals[i].show(kind_obj[proposals[i].name], where)
    }
  }
}


// Edit ------------------------------------------------
export function form_make_editable(elems){
  for(let i=0; i<elems.length; i++){
    $(`#${elems[i]}`).removeClass('form-control-plaintext')
    $(`#${elems[i]}`).addClass('form-control')  
    $(`#${elems[i]}`)[0].readOnly = false
  }
}

export function create_selector(elem_id){
  $(`#${elem_id}`).html(`
    <select class="form-control" name="kind" onchange="change_kind()" id="kind-select">
      <option value="">--Please choose an option--</option>
      <option value="AddMemberToRole">Add Member To Role</option>
      <option value="FunctionCall">Function Call</option>
      <option value="Transfer">Transfer</option>
    </select>
    <div id="selected-kind"></div>
    `
  )
}

export function change_kind(){
  const value = $('#kind-select')[0].value

  for(let i=0; i < proposals.length; i++){
    console.log(proposals[i].name)
    if(proposals[i].name == value){
      return proposals[i].create('selected-kind')
    }
  }

  $('#selected-kind').html('')
}

// Get
export function get_kind(){
  const value = $('#kind-select')[0].value

  for(let i=0; i < proposals.length; i++){
    console.log(proposals[i].name)
    if(proposals[i].name == value){
      return proposals[i].get()
    }
  }
}