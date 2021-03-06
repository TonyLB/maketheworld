import { API, graphqlOperation } from 'aws-amplify'

//
// A factory function that takes the information needed to interface with a specific type of GQL call in the
// common delta-sync calling pattern, and provides two functions:
//      * syncFromDelta
//      * syncFromBaseTable
//
export const deltaFactory = ({ dataTag, lastSyncCallback, processingAction, syncGQL }) => {

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
    const syncFromDelta = ({ startingAt, ...rest }) => (
        syncHandler({
            args: { startingAt, ...rest },
            callback: async ({ dispatch, args: { LastMoment = null, LastSync = null } }) => {
                if (LastSync) {
                    await lastSyncCallback(LastSync)
                }
                else {
                    if (LastMoment) {
                        dispatch(syncFromDelta({ startingAt: LastMoment, ...rest }))
                    }
                }
            }
        })
    )

    //
    // Pull a first-time or post-TTL fetch directly from the base tables.
    //
    const syncFromBaseTable = ({ ExclusiveStartKey, ...rest }) => (
        syncHandler({
            args: { exclusiveStartKey: ExclusiveStartKey, ...rest },
            callback: async ({ dispatch, args: { LastEvaluatedKey = null, LastSync = null } }) => {
                if (LastEvaluatedKey) {
                    dispatch(syncFromBaseTable({ ExclusiveStartKey: LastEvaluatedKey, ...rest }))
                }
                else {
                    if (LastSync) {
                        await lastSyncCallback(LastSync)
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