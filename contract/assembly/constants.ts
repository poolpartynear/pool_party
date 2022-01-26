// Unit of TGAS
export const TGAS: u64 = 1000000000000

// Amount of epochs to wait before unstaking again
export const UNSTAKE_EPOCH: u64 = 4

// Amount of time between prize updates (10 sec)
// Control that the prize updates are done with some minimum interval
// to avoid blocking the interaction with external pool
export const PRIZE_UPDATE_INTERVAL: u64 = 10000000000