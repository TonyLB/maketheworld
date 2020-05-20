import { getCurrentRoom } from './currentRoom'
import { getPermanentHeaders } from './permanentHeaders'

export const getMaps = ({ maps = {} }) => {
    return new Proxy(
        maps,
            {
                get: (obj, prop) => ((obj && obj[prop]) || {
                    PermanentId: prop,
                    Rooms: {}
                })
            }
    )
}

export const getCurrentMap = (state) => {
    const { Ancestry = '' } = getCurrentRoom(state)
    const permanentHeaders = getPermanentHeaders(state)
    const mapId = Ancestry.split(':').reduce((previous, nodeId) => (permanentHeaders[nodeId].ContextMapId || previous), 'ROOT')
    return getMaps(state)[mapId]
}
