//
// The dataControlLayer handles caching and synchronizing back-end data into the client local
// indexedDB storage
//

export const DCL_FSM_INITIAL = 'INITIAL'
export const DCL_FSM_SYNCHRONIZNG = 'SYNCHRONIZING'
export const DCL_FSM_SYNCHRONIZED = 'SYNCHRONIZED'
