import cacheDB from '../cacheDB'
import { API, graphqlOperation } from 'aws-amplify'

//
// A factory function that takes the information needed to interface with a specific type of GQL call in the
// common delta-sync calling pattern, and provides two functions:
//      * syncFromDelta
//      * syncFromBaseTable
//
export const deltaFactory = ({ dataTag, lastSyncKey, processingAction, syncGQL }) => {

    //
    // Execute the graphQL operation, process the returned items, and then pass the other flags to
    // a process-control callback
    //
    const syncHandler = ({ args, callback }) => async (dispatch) => {
        const results = await API.graphql(graphqlOperation(syncGQL, { ...args, limit: 100 }))
            .catch((err) => { console.log(err)})
        const { data = {} } = results || {}
        const syncData = data[dataTag] || {}
        const { Items = [], ...rest } = syncData
        dispatch(processingAction(Items))
        callback({ dispatch, args: rest })
    }

    //
    // Pull changes from the supported delta table.
    //
    const syncFromDelta = ({ startingAt }) => (
        syncHandler({
            args: { startingAt },
            callback: async ({ dispatch, args: { LastMoment = null, LastSync = null } }) => {
                if (LastSync) {
                    await cacheDB.clientSettings.put({ key: lastSyncKey, value: LastSync })
                }
                else {
                    if (LastMoment) {
                        dispatch(syncFromDelta({ startingAt: LastMoment }))
                    }
                }
            }
        })
    )

    //
    // Pull a first-time or post-TTL fetch directly from the base tables.
    //
    const syncFromBaseTable = ({ ExclusiveStartKey }) => (
        syncHandler({
            args: { exclusiveStartKey: ExclusiveStartKey },
            callback: async ({ dispatch, args: { LastEvaluatedKey = null, LastSync = null } }) => {
                if (LastEvaluatedKey) {
                    dispatch(syncFromBaseTable({ ExclusiveStartKey: LastEvaluatedKey }))
                }
                else {
                    if (LastSync) {
                        await cacheDB.clientSettings.put({ key: lastSyncKey, value: LastSync })
                    }
                }
            }
        })
    )

    return {
        syncFromDelta,
        syncFromBaseTable
    }

}