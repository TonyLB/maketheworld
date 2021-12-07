//
// Find the time (for this character) of the last synchronization from the
// message storage back-end.
//
import cacheDB from '../../cacheDB'
import { socketDispatch } from '../communicationsLayer/lifeLine'
import {
    receiveMessages
} from '../messages'
import { syncMessages as syncMessagesGQL } from '../../graphql/queries'
import { deltaFactory } from '../deltaSync'
import { socketDispatchPromise } from '../communicationsLayer/lifeLine'

//
// lastMessageSyncKey standardizes how we construct a key into the cacheDB
// indexedDB storage
//
const lastMessageSyncKey = (CharacterId) => (`LastMessageSync-${CharacterId}`)

//
// getLastMessageSync pulls the last message sync value from cacheDB
//
export const getLastMessageSync = (CharacterId) => (
    cacheDB.clientSettings.get(lastMessageSyncKey(CharacterId))
        .then((response) => ((response ?? {}).value))
)

//
// setLastMessageSync updates the last message sync value in cacheDB
//
// TODO:  Examine:  Should this be async?  Does it matter, since we
// would never await it?  Maybe for error handling?
//
export const setLastMessageSync = (CharacterId) => (value) => {
    cacheDB.clientSettings.put({ key: lastMessageSyncKey(CharacterId), value })
}

//
// sync synchronizes the store with the information since the last sync
//
// TODO:  Create an error-handling process within the sync procedures, in case
// they fail, and use it to bump the FSM for activeCharacter into SUBSCRIBE_ERROR
// state.
//
export const syncAction = ({ CharacterId, LastMessageSync }) => async (dispatch) => {
    // const { syncFromDelta: syncFromMessagesDelta, syncFromBaseTable: syncFromMessages } = deltaFactory({
    //     dataTag: 'syncMessages',
    //     lastSyncCallback: (value) => {
    //         cacheDB.clientSettings.put({ key: lastMessageSyncKey(CharacterId), value })
    //     },
    //     processingAction: receiveMessages,
    //     syncGQL: syncMessagesGQL,
    // })

    // if (LastMessageSync) {
    //     await dispatch(syncFromMessagesDelta({ targetId: CharacterId, startingAt: LastMessageSync - 30000 }))
    // }
    // else {
    //     await dispatch(syncFromMessages({ targetId: CharacterId }))
    // }

    //
    // TODO: Support websocket Sync when built
    //
    await socketDispatch('sync')({})
    return {}

}