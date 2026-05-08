import { ActiveCharacterCondition, ActiveCharacterAction } from './baseClasses'
import cacheDB, { CharacterSyncType, LastSyncType, stripMessageDeltaPk } from '../../cacheDB'
import {
    socketDispatchPromise,
    LifeLinePubSub,
    getStatus
} from '../lifeLine'
import { getMyCharacterById } from '../player'
import { receiveMessages, normalizeCharacterMessageDisplayName } from '../messages'
import { push as pushFeedback } from '../../slices/UI/feedback'
import delayPromise from '../../lib/delayPromise'
import { isEphemeraClientMessageEphemeraUpdateMapItem } from '@tonylb/mtw-interfaces/ts/ephemera'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export const lifelineCondition: ActiveCharacterCondition = ({ internalData: { id } }, getState) => {
    const state = getState()
    const status = getStatus(state)
    const character = getMyCharacterById(id)(state)

    return (status === 'CONNECTED') && (Boolean(character))
}

//
// getLastMessageSync pulls the last message sync value from cacheDB
//
export const getLastMessageSync = (CharacterId: EphemeraCharacterId | undefined) => (
    CharacterId
        ? (cacheDB.characterSync.get(CharacterId) as Promise<CharacterSyncType | undefined>)
            .then((response) => (((response ?? {})?.lastSync)))
        : Promise.resolve(undefined)
)

export const fetchAction: ActiveCharacterAction = ({ internalData: { id } }) => async (dispatch) => {

    const LastMessageSync = await getLastMessageSync(id)
    const cachedRows = await cacheDB.messages.where("Target").equals(id || '').toArray()
    const messages = cachedRows.map(stripMessageDeltaPk).map(normalizeCharacterMessageDisplayName)

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
        await dispatch(socketDispatchPromise({ message: 'registercharacter', CharacterId: id }, { service: 'connections' }))
    }
    else {
        console.log(`NO ID for ACTIVE CHARACTER`)
    }
    return { internalData: { subscription: lifeLineSubscription } }
}

export const unregisterAction: ActiveCharacterAction = (incoming) => async (dispatch) => {
    const { internalData: { id, subscription } } = incoming
    if (subscription) {
        LifeLinePubSub.unsubscribe(subscription)
    }
    if (id) {
        await dispatch(socketDispatchPromise({ message: 'unregistercharacter', CharacterId: id }))
    }
    else {
        console.log(`NO ID for ACTIVE CHARACTER`)
    }
    return { internalData: { subscription: undefined } }
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

export const mapUnsubscribeAction: ActiveCharacterAction = ({ internalData: { id } }) => async (dispatch) => {
    if (id) {
        await dispatch(socketDispatchPromise({ message: 'unsubscribeFromMaps', CharacterId: id }))
    }
    return {}
}