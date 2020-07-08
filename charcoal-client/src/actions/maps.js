import { API, graphqlOperation } from 'aws-amplify'
import { updatePermanents } from '../graphql/mutations'

import { closeEditMapDialog } from './UI/mapDialog'

export const MAPS_UPDATE = 'MAPS_UPDATE'

export const mapUpdate = (mapData) => ({
    type: MAPS_UPDATE,
    data: mapData
})

export const putAndCloseEditMapDialog = (mapData) => (dispatch) => {
    const { MapId, Name, Rooms = [] } = mapData
    return API.graphql(graphqlOperation(updatePermanents, { Updates: [ { putMap: { MapId, Name, Rooms } }] }))
    .then(() => dispatch(closeEditMapDialog()))
    .catch((err) => { console.log(err)})
}
