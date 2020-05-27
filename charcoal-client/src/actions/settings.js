import { API, graphqlOperation } from 'aws-amplify'
import { getSettings } from '../graphql/queries'
import { putSettings } from '../graphql/mutations'

// import { closeEditMapDialog } from './UI/mapDialog'

export const SETTINGS_UPDATE = 'SETTINGS_UPDATE'

export const settingsUpdate = (settingsData) => ({
    type: SETTINGS_UPDATE,
    data: settingsData
})

export const fetchSettings = (dispatch) => {
    return API.graphql(graphqlOperation(getSettings))
        .then(({ data }) => (data || {}))
        .then(({ getSettings }) => (getSettings || []))
        .then(response => dispatch(settingsUpdate(response)))
        .catch((err) => { console.log(err)})
}

// export const putAndCloseEditMapDialog = (mapData) => (dispatch, getState) => {
//     const { MapId, Name, Rooms = [] } = mapData
//     return API.graphql(graphqlOperation(putMap, { MapId, Name, Rooms }))
//     .then(() => dispatch(closeEditMapDialog()))
//     .catch((err) => { console.log(err)})
// }
