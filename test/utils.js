const { keyStores: { InMemoryKeyStore }, Near, KeyPair, Account,
				Contract, utils: {format: { parseNearAmount } }, transactions: { deployContract } } = nearAPI
const BN = require('bn.js')
const fs = require("fs")

const DEFAULT_NEW_ACCOUNT_AMOUNT = "20"

// Load credentials
const credPath = `./neardev/${nearConfig.networkId}/${nearConfig.contractName}.json`

let credentials
try {
	credentials = JSON.parse(fs.readFileSync(credPath));
} catch(e) {
	console.warn(e)
	/// attempt to load backup creds from local machine
	credentials = JSON.parse(
		fs.readFileSync(
			`${process.env.HOME}/.near-credentials/${nearConfig.networkId}/${nearConfig.contractName}.json`
		)
	);
}

// Create an InMemoryKeyStore
const keyStore = new InMemoryKeyStore();

keyStore.setKey(
	nearConfig.networkId,
	nearConfig.contractName,
	KeyPair.fromString(credentials.private_key)
);

// Connect to the NEAR blockchain
const near = new Near({
	networkId: nearConfig.networkId, nodeUrl:nearConfig.nodeUrl, deps: { keyStore } 
});


// Aux function to create accounts
async function createAccount(accountId, fundingAmount = DEFAULT_NEW_ACCOUNT_AMOUNT, secret) {
	const contractAccount = new Account(near.connection, nearConfig.contractName);
	const newKeyPair = secret ? KeyPair.fromString(secret) : KeyPair.fromRandom('ed25519');
	await contractAccount.createAccount(accountId, newKeyPair.publicKey, new BN(parseNearAmount(fundingAmount)));
	keyStore.setKey(nearConfig.networkId, accountId, newKeyPair);
	return new Account(near.connection, accountId);
}

async function getAccount(accountId, fundingAmount = DEFAULT_NEW_ACCOUNT_AMOUNT) {
	// accountId must be with `${something}.${contractName}`
	const account = new Account(near.connection, accountId);
	try {
		await account.state();
		return account;
	} catch(e) {
		if (!/does not exist/.test(e.toString())) {
			throw e;
		}
	}
	return await createAccount(accountId, fundingAmount);
};


// Create Contract
async function create_contract(accountId){
	let account = await getAccount(accountId)

	const contractMethods = {
		viewMethods: ['get_account'],
		changeMethods: ['init', 'get_pool_info', 'deposit_and_stake', 'unstake',
										'withdraw_all', 'update_prize', 'interact_external',
										'get_pool_tickets', 'get_user_tickets', 'deposit_and_stake_callback',
										'unstake_external_callback', 'withdraw_external_callback',
										'withdraw_all_callback', "update_prize_callback",
										'number_of_users',
										
										// Functions for DAO
										'get_pool_fees', 'change_pool_fees', 'get_raffle_wait',
										'change_time_between_raffles', 'get_max_users',
										'change_max_users', 'get_min_deposit', 'change_min_deposit',
										'get_max_deposit', 'change_max_deposit', 'get_guardian',
										'propose_new_guardian', 'accept_being_guardian',
										'emergency_start', 'emergency_stop', 'change_epoch_wait',

										// Token
										'give_from_reserve']
	};

	return new Contract(account, nearConfig.contractName, contractMethods);
}

async function deploy_mock_validator(accountId){
	const validator = await getAccount(accountId)
	const validatorContractBytes = fs.readFileSync(`./mock_validator/mvalidator.wasm`);

	await validator.signAndSendTransaction(
		accountId,
		[deployContract(validatorContractBytes)]
	);
}

module.exports = {create_contract, deploy_mock_validator, getAccount, near}