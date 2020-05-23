import { API, graphqlOperation } from 'aws-amplify'
import { getMaps } from '../graphql/queries'
import { putMap } from '../graphql/mutations'

import { closeEditMapDialog } from './UI/mapDialog'

export const MAPS_UPDATE = 'MAPS_UPDATE'

export const mapUpdate = (mapData) => ({
    type: MAPS_UPDATE,
    data: mapData
})

export const fetchMaps = (dispatch) => {
    return API.graphql(graphqlOperation(getMaps))
        .then(({ data }) => (data || {}))
        .then(({ getMaps }) => (getMaps || []))
        .then(response => dispatch(mapUpdate(response)))
        .catch((err) => { console.log(err)})
}

export const putAndCloseEditMapDialog = (mapData) => (dispatch, getState) => {
    const { MapId, Name, Rooms = [] } = mapData
    return API.graphql(graphqlOperation(putMap, { MapId, Name, Rooms }))
    .then(() => dispatch(closeEditMapDialog()))
    .catch((err) => { console.log(err)})
}
