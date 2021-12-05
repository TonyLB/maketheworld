import { API, graphqlOperation } from 'aws-amplify'
// import { syncPermanents as syncPermanentsGQL } from '../graphql/queries'
// import { changedPermanents } from '../graphql/subscriptions'

// import { addSubscription } from './subscriptions'
import cacheDB from '../cacheDB'
import { deltaFactory } from './deltaSync'

export const NEIGHBORHOOD_UPDATE = 'NEIGHBORHOOD_UPDATE'

// export const neighborhoodUpdate = (neighborhoods) => async (dispatch) => {
//     await Promise.all([
//         cacheDB.neighborhoods.bulkPut(neighborhoods.filter(({ Neighborhood }) => (Neighborhood)).map(({ Neighborhood }) => (Neighborhood))),
//         cacheDB.maps.bulkPut(neighborhoods.filter(({ Map }) => (Map)).map(({ Map }) => (Map))),
//         cacheDB.settings.bulkPut(neighborhoods.filter(({ Setting }) => (Setting)).map(({ Setting }) => (Setting))),
//         cacheDB.backups.bulkPut(neighborhoods.filter(({ Backup }) => (Backup)).map(({ Backup }) => (Backup))),
//         cacheDB.rooms.bulkPut(neighborhoods.filter(({ Room }) => (Room)).map(({ Room }) => (Room))),
//         cacheDB.characters.bulkPut(neighborhoods.filter(({ Character }) => (Character)).map(({ Character }) => (Character))),
//         cacheDB.exits.bulkPut(neighborhoods.filter(({ Exit }) => (Exit)).map(({ Exit }) => (Exit))),
//         cacheDB.roles.bulkPut(neighborhoods.filter(({ Role }) => (Role)).map(({ Role }) => (Role)))
//     ])

//     dispatch({
//         type: NEIGHBORHOOD_UPDATE,
//         data: neighborhoods
//     })
// }

// export const fetchCached = async (dispatch) => {

//     const neighborhoods = cacheDB.neighborhoods.toArray().then((items) => (items.map((item) => ({ Neighborhood: item }))))
//     const settings = cacheDB.settings.toArray().then((items) => (items.map((item) => ({ Setting: item }))))
//     const maps = cacheDB.maps.toArray().then((items) => (items.map((item) => ({ Map: item }))))
//     const backups = cacheDB.backups.toArray().then((items) => (items.map((item) => ({ Backup: item }))))
//     const rooms = cacheDB.rooms.toArray().then((items) => (items.map((item) => ({ Room: item }))))
//     const characters = cacheDB.characters.toArray().then((items) => (items.map((item) => ({ Character: item }))))
//     const exits = cacheDB.exits.toArray().then((items) => (items.map((item) => ({ Exit: item }))))
//     const roles = cacheDB.roles.toArray().then((items) => (items.map((item) => ({ Role: item }))))

//     const allData = await Promise.all([
//         neighborhoods,
//         settings,
//         maps,
//         backups,
//         rooms,
//         characters,
//         exits,
//         roles
//     ]).then((items) => (items.reduce((previous, item) => ([ ...previous, ...item ]), [])))
//     dispatch({
//         type: NEIGHBORHOOD_UPDATE,
//         data: allData
//     })
// }

// export const { syncFromDelta: syncFromPermanentsDelta, syncFromBaseTable: syncFromPermanents } = deltaFactory({
//     dataTag: 'syncPermanents',
//     lastSyncCallback: (value) => (
//         cacheDB.clientSettings.put({ key: 'LastSync', value })
//     ),
//     processingAction: neighborhoodUpdate,
//     syncGQL: syncPermanentsGQL
// })
