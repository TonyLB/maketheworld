import { API, graphqlOperation } from 'aws-amplify'
import { getMaps } from '../graphql/queries'

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
