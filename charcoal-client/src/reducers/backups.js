import {
    RECEIVE_BACKUP_CHANGES
} from '../actions/backups.js'

export const reducer = (state = {}, action = {}) => {
    const { type: actionType = "NOOP", backupChanges = [] } = action
    switch (actionType) {
        case RECEIVE_BACKUP_CHANGES:
            return backupChanges.reduce((previous, { PermanentId, ...rest }) => ({
                ...previous,
                [PermanentId]: {
                    ...(previous[PermanentId] || {}),
                    PermanentId,
                    ...rest
                }
            }), state)
        default: return state
    }
}

export default reducer