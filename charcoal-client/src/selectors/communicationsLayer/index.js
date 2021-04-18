import { getSSMState, getSSMData } from '../stateSeekingMachine'

export const getLifeLine = (state = {}) => {
    const lifeLineData = getSSMData('LifeLine')(state)
    return {
        ...(lifeLineData || {}),
        status: getSSMState('LifeLine')(state) || 'INITIAL'
    }
}

export const getPermanentsLastSync = (state = {}) => {
    const { communicationsLayer: { fetchLastPermanentsSync = 0 } = {} } = state
    return fetchLastPermanentsSync
}

export const getSubscriptionStatus = ({ communicationsLayer: { appSyncSubscriptions: {
    ephemera = { status: 'INITIAL' },
    permanents = { status: 'INITIAL' },
    player = { status: 'INITIAL' }
} = {} } = {}}) => {
    const statuses = [ephemera.status, permanents.status, player.status]
    const allMatch = (status) => statuses.reduce((previous, value) => (previous && (value === status)), true)
    const anyMatch = (status) => statuses.reduce((previous, value) => (previous || (value === status)), false)

    if (allMatch('INITIAL')) {
        return 'INITIAL'
    }
    else if (anyMatch('ERROR')) {
        return 'ERROR'
    }
    else if (allMatch('CONNECTED')) {
        return 'CONNECTED'
    }
    return 'CONNECTING'
}