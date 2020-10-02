import { API, graphqlOperation } from 'aws-amplify'
import { syncPermanents as syncPermanentsGQL } from '../graphql/queries'
import { changedPermanents } from '../graphql/subscriptions'

import { addSubscription } from './subscriptions'
import cacheDB from '../cacheDB'


export const NEIGHBORHOOD_UPDATE = 'NEIGHBORHOOD_UPDATE'

export const neighborhoodUpdate = (neighborhoods) => async (dispatch) => {
    await Promise.all([
        cacheDB.neighborhoods.bulkPut(neighborhoods.filter(({ Neighborhood }) => (Neighborhood)).map(({ Neighborhood }) => (Neighborhood))),
        cacheDB.maps.bulkPut(neighborhoods.filter(({ Map }) => (Map)).map(({ Map }) => (Map))),
        cacheDB.settings.bulkPut(neighborhoods.filter(({ Setting }) => (Setting)).map(({ Setting }) => (Setting))),
        cacheDB.backups.bulkPut(neighborhoods.filter(({ Backup }) => (Backup)).map(({ Backup }) => (Backup))),
        cacheDB.rooms.bulkPut(neighborhoods.filter(({ Room }) => (Room)).map(({ Room }) => (Room))),
        cacheDB.characters.bulkPut(neighborhoods.filter(({ Character }) => (Character)).map(({ Character }) => (Character))),
        cacheDB.grants.bulkPut(neighborhoods.filter(({ Grant }) => (Grant)).map(({ Grant }) => (Grant))),
        cacheDB.exits.bulkPut(neighborhoods.filter(({ Exit }) => (Exit)).map(({ Exit }) => (Exit))),
        cacheDB.roles.bulkPut(neighborhoods.filter(({ Role }) => (Role)).map(({ Role }) => (Role)))
    ])

    dispatch({
        type: NEIGHBORHOOD_UPDATE,
        data: neighborhoods
    })
}

export const fetchCached = async (dispatch) => {

    const neighborhoods = cacheDB.neighborhoods.toArray().then((items) => (items.map((item) => ({ Neighborhood: item }))))
    const settings = cacheDB.settings.toArray().then((items) => (items.map((item) => ({ Setting: item }))))
    const maps = cacheDB.maps.toArray().then((items) => (items.map((item) => ({ Map: item }))))
    const backups = cacheDB.backups.toArray().then((items) => (items.map((item) => ({ Backup: item }))))
    const rooms = cacheDB.rooms.toArray().then((items) => (items.map((item) => ({ Room: item }))))
    const characters = cacheDB.characters.toArray().then((items) => (items.map((item) => ({ Character: item }))))
    const grants = cacheDB.grants.toArray().then((items) => (items.map((item) => ({ Grant: item }))))
    const exits = cacheDB.exits.toArray().then((items) => (items.map((item) => ({ Exit: item }))))
    const roles = cacheDB.roles.toArray().then((items) => (items.map((item) => ({ Role: item }))))

    const allData = await Promise.all([
        neighborhoods,
        settings,
        maps,
        backups,
        rooms,
        characters,
        grants,
        exits,
        roles
    ]).then((items) => (items.reduce((previous, item) => ([ ...previous, ...item ]), [])))
    dispatch({
        type: NEIGHBORHOOD_UPDATE,
        data: allData
    })
}

const syncFromPermanentsDelta = ({ startingAt }) => async (dispatch) => {
    const permanentsResults = await API.graphql(graphqlOperation(syncPermanentsGQL, { startingAt, limit: 100 }))
        .catch((err) => { console.log(err)})
    const { data = {} } = permanentsResults || {}
    const { syncPermanents: syncPermanentsData = {} } = data
    const { Items = [], LastMoment = null, LastSync = null } = syncPermanentsData
    dispatch(neighborhoodUpdate(Items))
    if (LastSync) {
        await cacheDB.clientSettings.put({ key: 'LastSync', value: LastSync })
    }
    else {
        if (LastMoment) {
            dispatch(syncFromPermanentsDelta({ startingAt: LastMoment }))
        }
    }
}

export const syncFromPermanents = ({ ExclusiveStartKey }) => async (dispatch) => {
    const permanentsResults = await API.graphql(graphqlOperation(syncPermanentsGQL, { exclusiveStartKey: ExclusiveStartKey, limit: 100 }))
        .catch((err) => { console.log(err)})
    const { data = {} } = permanentsResults || {}
    const { syncPermanents: syncPermanentsData = {} } = data
    const { Items = [], LastEvaluatedKey = null, LastSync = null } = syncPermanentsData
    dispatch(neighborhoodUpdate(Items))
    if (LastEvaluatedKey) {
        dispatch(syncFromPermanents({ ExclusiveStartKey: LastEvaluatedKey }))
    }
    else {
        if (LastSync) {
            await cacheDB.clientSettings.put({ key: 'LastSync', value: LastSync })
        }
    }
}

export const subscribePermanentHeaderChanges = () => async (dispatch) => {
    dispatch(fetchCached)
    const { value: LastSync } = await cacheDB.clientSettings.get('LastSync') || {}
    const neighborhoodSubscription = await API.graphql(graphqlOperation(changedPermanents))
        .subscribe({
            next: (neighborhoodData) => {
                const { value = {} } = neighborhoodData
                const { data = {} } = value
                const { changedPermanents = [] } = data
                dispatch(neighborhoodUpdate(changedPermanents))
            }
        })

    dispatch(addSubscription({ nodes: neighborhoodSubscription }))
    if (LastSync) {
        dispatch(syncFromPermanentsDelta({ startingAt: LastSync - 30000 }))
    }
    else {
        dispatch(syncFromPermanents({}))
    }
}
