export const getWebSocket = ({ communicationsLayer: { webSocket = { status: 'DISCONNECTED' } } = {} }) => webSocket

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