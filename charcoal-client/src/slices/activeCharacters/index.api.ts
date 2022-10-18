import { ActiveCharacterCondition, ActiveCharacterAction } from './baseClasses'
import cacheDB, { LastSyncType } from '../../cacheDB'
import {
    socketDispatchPromise,
    LifeLinePubSub,
    getStatus
} from '../lifeLine'
import { getMyCharacterById } from '../player'
import { receiveMessages } from '../messages'
import { push as pushFeedback } from '../../slices/UI/feedback'
import delayPromise from '../../lib/delayPromise'
import { isEphemeraClientMessageEphemeraUpdateMapItem } from '@tonylb/mtw-interfaces/dist/ephemera'

export const lifelineCondition: ActiveCharacterCondition = ({ internalData: { id } }, getState) => {
    //
    // TODO: Figure out whether lifelineCondition is failing now that we've constrained id to EphemeraCharacterId
    //
    const state = getState()
    const status = getStatus(state)
    const character = getMyCharacterById(id)(state)
    console.log(`Character: ${JSON.stringify(character, null, 4)}`)

    return (status === 'CONNECTED') && (Boolean(character))
}

//
// getLastMessageSync pulls the last message sync value from cacheDB
//
export const getLastMessageSync = (CharacterId: string) => (
    (cacheDB.clientSettings.get('LastSync') as Promise<LastSyncType | undefined>)
        .then((response) => (((response ?? {}).value || {})[CharacterId]))
)

export const fetchAction: ActiveCharacterAction = ({ internalData: { id } }) => async (dispatch) => {

    const LastMessageSync = await getLastMessageSync(id || '')
    const messages = await cacheDB.messages.where("Target").equals(id || '').toArray()

    dispatch(receiveMessages(messages))
    return { internalData: { LastMessageSync } }
}

export const registerAction: ActiveCharacterAction = (incoming) => async (dispatch) => {
    const { internalData: { id }, actions } = incoming
    const { receiveMapEphemera } = actions
    const lifeLineSubscription = LifeLinePubSub.subscribe(({ payload }) => {
        if (payload.messageType === 'Ephemera') {
            const { updates } = payload
            updates
                .filter(isEphemeraClientMessageEphemeraUpdateMapItem)
                .filter(({ targets }) => (id && targets.includes(id)))
                .forEach(({ type, targets, ...rest }) => {
                    dispatch(receiveMapEphemera(rest))
                })
        }
    })
    await dispatch(socketDispatchPromise({ message: 'fetchEphemera', CharacterId: id?.split('#')[1] }))
    if (id) {
        await dispatch(socketDispatchPromise({ message: 'registercharacter', CharacterId: id }))
    }
    else {
        console.log(`NO ID for ACTIVE CHARACTER`)
    }
    return { internalData: { subscription: lifeLineSubscription } }
}

//
// sync synchronizes the store with the information since the last sync
//
// TODO:  Create an error-handling process within the sync procedures, in case
// they fail, and use it to bump the FSM for activeCharacter into SUBSCRIBE_ERROR
// state.
//
export const syncAction: ActiveCharacterAction = ({ internalData: { id, LastMessageSync, incrementalBackoff = 0.5 } }) => async (dispatch) => {
    if (!id) {
        dispatch(pushFeedback('Failed to synchronize messages, retrying...'))
        throw new Error()
    }
    if (LastMessageSync) {
        return await dispatch(socketDispatchPromise({ message: 'sync', CharacterId: id, startingAt: LastMessageSync - 30000 }))
            .then(() => ({ incrementalBackoff: 0.5 }))
            .catch(async (e: any) => {
                dispatch(pushFeedback('Failed to synchronize messages, retrying...'))
                throw e
            })
    }
    else {
        return await dispatch(socketDispatchPromise({ message: 'sync', CharacterId: id }))
            .then(() => ({ incrementalBackoff: 0.5 }))
            .catch(async (e: any) => {
                dispatch(pushFeedback('Failed to synchronize messages, retrying...'))
                throw e
            })
    }
}

export const backoffAction: ActiveCharacterAction = ({ internalData: { incrementalBackoff = 0.5 }}) => async (dispatch) => {
    if (incrementalBackoff >= 30) {
        throw new Error()
    }
    await delayPromise(incrementalBackoff * 1000)
    return { internalData: { incrementalBackoff: Math.min(incrementalBackoff * 2, 30) } }
}

export const mapSubscribeAction: ActiveCharacterAction = ({ internalData: { id } }) => async (dispatch) => {
    if (id) {
        await dispatch(socketDispatchPromise({ message: 'subscribeToMaps', CharacterId: id }))
    }
    return {}
}