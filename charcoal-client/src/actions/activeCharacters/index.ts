import { assertIntent, registerSSM } from '../stateSeekingMachine'
import { IStateSeekingMachineAbstract } from '../stateSeekingMachine/baseClasses'
import { characterSSMClassGenerator, characterSSMKeys, CharacterSubscriptionData } from './baseClass'

import cacheDB from '../../cacheDB'
import { getLastMessageSync, syncAction } from './messageSync'
import { subscribeAction } from './subscription'
import { RECEIVE_MESSAGES } from '../messages'

export const ACTIVATE_CHARACTER = 'ACTIVATE_CHARACTER'
export const DEACTIVATE_CHARACTER = 'DEACTIVATE_CHARACTER'

export const activateCharacter = (CharacterId: string) => ({ type: ACTIVATE_CHARACTER, CharacterId })

export const deactivateCharacter = (CharacterId: string) => ({ type: DEACTIVATE_CHARACTER, CharacterId })

//
// TODO:  Typescript Dexie using https://dexie.org/docs/Typescript
//
const cacheDBCast = cacheDB as any

const fetchAction = ({ CharacterId }: { CharacterId: string}) => async (dispatch: any): Promise<Partial<CharacterSubscriptionData>> => {

    const LastMessageSync = await getLastMessageSync()
    const messages = await cacheDBCast.messages.where("Target").equals(CharacterId).toArray()

    dispatch({
        type: RECEIVE_MESSAGES,
        payload: messages
    })
    return { LastMessageSync }
}

const unsubscribeAction = ({ subscription }: { subscription: any }) => async (dispatch: any): Promise<Partial<CharacterSubscriptionData>> => {
    await subscription.unsubscribe()
    return { subscription: null }
}

//
// Configure subscription and synchronization for Character messages
//
export class CharacterSubscriptionTemplate extends characterSSMClassGenerator({
    fetchAction,
    subscribeAction,
    unsubscribeAction,
    syncAction,
    registerAction: () => async () => ({}),
    deregisterAction: () => async () => ({})
}){ }

export type CharacterSubscriptionSSM = IStateSeekingMachineAbstract<characterSSMKeys, CharacterSubscriptionData, CharacterSubscriptionTemplate>

export const registerCharacterSSM = (CharacterId: string) => (dispatch: any): void => {
    dispatch(registerSSM({ key: `Subscribe::Character::${CharacterId}`, template: new CharacterSubscriptionTemplate(CharacterId) }))
}

export const subscribeCharacterSSM = (CharacterId: string) => (dispatch: any): void => {
    dispatch(assertIntent({ key: `Subscribe::Character::${CharacterId}`, newState: 'SYNCHRONIZED' }))
}