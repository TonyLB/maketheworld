import {
    RECEIVE_BACKUP_CHANGES
} from '../actions/backups.js'
import {
    NEIGHBORHOOD_UPDATE
} from '../actions/neighborhoods'

const mergeBackup = (previous, { PermanentId, ...rest }) => ({
    ...previous,
    [PermanentId]: {
        ...(previous[PermanentId] || {}),
        PermanentId,
        ...rest
    }
})

export const reducer = (state = {}, action = {}) => {
    const { type: actionType = "NOOP", backupChanges = [] } = action
    switch (actionType) {
        case RECEIVE_BACKUP_CHANGES:
            return backupChanges.reduce(mergeBackup, state)
        case NEIGHBORHOOD_UPDATE:
            return action.data
                .filter(({ Backup }) => (Backup))
                .map(({ Backup }) => (Backup))
                .reduce(mergeBackup, state)
        default: return state
    }
}

export default reducer