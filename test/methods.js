const { near, create_contract } = require('./utils')
const { utils: { format: { formatNearAmount, parseNearAmount } }, } = nearAPI

const MGAS = 300000000000000

init = async function (external_pool, guardian, dao) {
	let init_contract = await create_contract(nearConfig.contractName)
	return await init_contract.init({ args: { external_pool, guardian, dao, first_raffle: "0" } })
}

wallet_balance = async function (account_id) {
	let account = await near.account(account_id)
	let balance = await account.getAccountBalance()
	balance.total = parseFloat(formatNearAmount(balance.total))
	balance.available = parseFloat(formatNearAmount(balance.available))
	return balance
}

deposit_and_stake = async function (amount, contract) {
	amount = parseNearAmount(amount.toString())
	return await contract.account.functionCall(
		{ contractId: nearConfig.contractName, methodName: 'deposit_and_stake', args: {}, gas: MGAS, attachedDeposit: amount }
	)
}

unstake = async function (amount, contract) {
	amount = parseNearAmount(amount.toString())
	let result = await contract.account.functionCall(
		{ contractId: nearConfig.contractName, methodName: 'unstake', args: { amount: amount }, gas: MGAS, attachedDeposit: 0 }
	)
	return nearlib.providers.getTransactionLastResult(result)
}

interact_external = async function (contract) {
	let result = await contract.account.functionCall(
		{ contractId: nearConfig.contractName, methodName: 'interact_external', args: {}, gas: MGAS, attachedDeposit: 0 }
	)
	return nearlib.providers.getTransactionLastResult(result)
}

withdraw_all = async function (contract) {
	let result = await contract.account.functionCall(
		{
			contractId: nearConfig.contractName, methodName: 'withdraw_all',
			args: {}, gas: MGAS, attachedDeposit: 0
		}
	)
	return nearlib.providers.getTransactionLastResult(result)
}

get_account = async function (account_id, contract) {
	let info = await contract.get_account({ account_id })
	info.staked_balance = parseFloat(formatNearAmount(info.staked_balance))
	info.unstaked_balance = parseFloat(formatNearAmount(info.unstaked_balance))
	info.available_when = Number(info.available_when)
	return info
}

get_pool_info = async function (contract) {
	let result = await contract.account.functionCall(
		{ contractId: nearConfig.contractName, methodName: 'get_pool_info', args: {}, gas: MGAS, attachedDeposit: 0 }
	)
	info = nearlib.providers.getTransactionLastResult(result)
	info.total_staked = parseFloat(formatNearAmount(info.total_staked))
	info.prize = parseFloat(formatNearAmount(info.prize))
	return info
}

give_from_reserve = async function (to, amount, contract) {
	amount = parseNearAmount(amount.toString())
	let result = await contract.account.functionCall(
		{
			contractId: nearConfig.contractName, methodName: 'give_from_reserve',
			args: { to, amount }, gas: MGAS, attachedDeposit: 0
		}
	)
	return nearlib.providers.getTransactionLastResult(result)
}

raffle = async function (contract) {
	let result = await contract.account.functionCall(
		{ contractId: nearConfig.contractName, methodName: 'raffle', args: {}, gas: MGAS, attachedDeposit: 0 }
	)
	info = nearlib.providers.getTransactionLastResult(result)
	return info
}

update_prize = async function (contract) {
	let result = await contract.account.functionCall(
		{ contractId: nearConfig.contractName, methodName: 'update_prize', args: {}, gas: MGAS, attachedDeposit: 0 }
	)
	info = nearlib.providers.getTransactionLastResult(result)
	return info
}


class User {
	constructor(accountId) {
		this.accountId = accountId;
		this.contract;
	}

	init(pool, guardian, dao) { return init(pool, guardian, dao) }
	wallet_balance() { return wallet_balance(this.accountId) }
	deposit_and_stake(amount) { return deposit_and_stake(amount, this.contract) }
	unstake(amount) { return unstake(amount, this.contract) }
	interact_external() { return interact_external(this.contract) }
	withdraw_all() { return withdraw_all(this.contract) }
	get_account() { return get_account(this.accountId, this.contract) }
	get_pool_info() { return get_pool_info(this.contract) }
	give_from_reserve(to, amount) { return give_from_reserve(to, amount, this.contract) }
	raffle() { return raffle(this.contract) }
	update_prize() { return update_prize(this.contract) }
	change_epoch_wait(epochs) { return this.contract.change_epoch_wait({ args: { "epochs": epochs.toString() } }) }
	number_of_users() { return this.contract.number_of_users({ args: {} }) }
	emergency_start() { return this.contract.emergency_start({ args: {} }) }
	emergency_stop() { return this.contract.emergency_stop({ args: {} }) }
}

async function create_user(accountId) {
	let user = new User(accountId)
	user.contract = await create_contract(accountId)
	return user
}

module.exports = { create_user }