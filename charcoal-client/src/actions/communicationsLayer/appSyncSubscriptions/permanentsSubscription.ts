// import { API, graphqlOperation } from 'aws-amplify'
// import { syncPermanents as syncPermanentsGQL } from '../../../graphql/queries'
// import { changedPermanents } from '../../../graphql/subscriptions'
// import { neighborhoodUpdate } from '../../neighborhoods'

// import cacheDB from '../../../cacheDB'
// import { deltaFactory } from '../../deltaSync'

import { ISSMAction, IStateSeekingMachineAbstract } from '../../stateSeekingMachine/baseClasses'
import { cachedSubscriptionSSMKeys, cachedSubscriptionSSMClassGenerator } from './baseClasses'

export const NEIGHBORHOOD_UPDATE = 'NEIGHBORHOOD_UPDATE'
export const SET_PERMANENTS_LAST_SYNC = 'SET_PERMANENTS_LAST_SYNC'

//
// TODO:  Typescript Dexie using https://dexie.org/docs/Typescript
//
// const cacheDBCast = cacheDB as any

// const fetchCached = async (dispatch: any) => {

    // const neighborhoods = cacheDBCast.neighborhoods.toArray().then((items: { Neighborhood: any }[]) => (items.map((item) => ({ Neighborhood: item }))))
    // const settings = cacheDBCast.settings.toArray().then((items: { Setting: any }[]) => (items.map((item) => ({ Setting: item }))))
    // const maps = cacheDBCast.maps.toArray().then((items: { Map: any }[]) => (items.map((item) => ({ Map: item }))))
    // const backups = cacheDBCast.backups.toArray().then((items: { Backup: any } []) => (items.map((item) => ({ Backup: item }))))
    // const rooms = cacheDBCast.rooms.toArray().then((items: { Room: any }[]) => (items.map((item) => ({ Room: item }))))
    // const characters = cacheDBCast.characters.toArray().then((items: { Character: any }[]) => (items.map((item) => ({ Character: item }))))
    // const exits = cacheDBCast.exits.toArray().then((items: { Exit: any }[]) => (items.map((item) => ({ Exit: item }))))
    // const roles = cacheDBCast.roles.toArray().then((items: { Role: any }[]) => (items.map((item) => ({ Role: item }))))

    // const allData = await Promise.all([
    //     neighborhoods,
    //     settings,
    //     maps,
    //     backups,
    //     rooms,
    //     characters,
    //     exits,
    //     roles
    // ]).then((items) => (items.reduce((previous, item) => ([ ...previous, ...item ]), [])))
    // dispatch({
    //     type: NEIGHBORHOOD_UPDATE,
    //     data: allData
    // })
// }

// const { syncFromDelta: syncFromPermanentsDelta, syncFromBaseTable: syncFromPermanents } = deltaFactory({
//     dataTag: 'syncPermanents',
//     lastSyncCallback: (value: number) => (
//         cacheDBCast.clientSettings.put({ key: 'LastSync', value })
//     ),
//     processingAction: neighborhoodUpdate,
//     syncGQL: syncPermanentsGQL
// })

class PermanentSubscriptionSSMData {
    LastSync: number = 0
}

const fetchAction: ISSMAction<PermanentSubscriptionSSMData> = (data) => async (dispatch: any, getState: any) => {
    // await dispatch(fetchCached)
    // const { value: LastSync } = await cacheDBCast.clientSettings.get('LastSync') || {}
    // return { LastSync }
    return {}
}

const subscribeAction: ISSMAction<PermanentSubscriptionSSMData> = (data) => async (dispatch: any, getState: any) => {
    // const subscription = await (API.graphql(graphqlOperation(changedPermanents)) as any)
    //     .subscribe({
    //         next: (neighborhoodData?: { value?: { data?: { changedPermanents?: Array<any> }}}) => {
    //             const changedPermanents = neighborhoodData?.value?.data?.changedPermanents ?? []
    //             dispatch(neighborhoodUpdate(changedPermanents))
    //         }
    //     })
    // dispatch({
    //     type: SUBSCRIPTION_SUCCESS,
    //     payload: { permanents: subscription }
    // })
    return {}
}

const unsubscribeAction: ISSMAction<PermanentSubscriptionSSMData> = (data) => async (dispatch: any, getState: any) => {
    // const permanentsSubscription: any = getState().communicationsLayer.appSyncSubscriptions.permanents?.subscription
    // if (permanentsSubscription) {
    //     await permanentsSubscription.unsubscribe()
    // }
    return {}
}

const syncAction: ISSMAction<PermanentSubscriptionSSMData> = ({ LastSync }: { LastSync: number }) => async (dispatch: any, getState: any) => {
    // if (LastSync) {
    //     await dispatch(syncFromPermanentsDelta({ startingAt: LastSync - 30000 }))
    // }
    // else {
    //     await dispatch(syncFromPermanents({} as any))
    // }
    return {} as Partial<PermanentSubscriptionSSMData>
}

//
// Configure subscription and synchronization for Permanents DB table
//
export class PermanentsSubscriptionTemplate extends cachedSubscriptionSSMClassGenerator<PermanentSubscriptionSSMData, 'PermanentsSubscriptionSSM'>({
    ssmType: 'PermanentsSubscriptionSSM',
    initialData: { LastSync: 0 },
    fetchAction,
    subscribeAction,
    unsubscribeAction,
    syncAction
}) { }

export type PermanentsSubscriptionSSM = IStateSeekingMachineAbstract<cachedSubscriptionSSMKeys, PermanentSubscriptionSSMData, PermanentsSubscriptionTemplate>
