import { objectMap, reduceArrayToObject } from '../lib/objects'
import { getMessages } from './messages'

export const getActiveCharacters = (reduxState) => {
    const stateSeekingMachines = (reduxState && reduxState.stateSeekingMachines?.machines) ?? {}
    const characterMachineArray = Object.entries(stateSeekingMachines)
        .filter(([key]) => (key.startsWith('Subscribe::Character::')))
        .map(([key, value]) => ([key.slice(22), value]))
        .reduce(reduceArrayToObject, {})
    return objectMap(characterMachineArray, ({ currentState }) => ({
            state: currentState,
            isSubscribing: [
                'FETCHING',
                'FETCHED',
                'SUBSCRIBING',
                'SUBSCRIBED',
                'SYNCHING'
            ].includes(currentState),
            isSubscribed: [
                'SYNCHRONIZED',
                'REGISTERING',
                'REGISTERED',
                'DEREGISTERING',
                'REREGISTERING'
            ].includes(currentState),
            isConnecting: currentState === 'REGISTERING',
            isConnected: ['REGISTERED', 'REREGISTERING'].includes(currentState)
        }))
}

export const getActiveCharacterState = (CharacterId) => (reduxState) => {
    const { currentState = 'INVALID' } = (reduxState && reduxState.stateSeekingMachines?.machines?.[`Subscribe::Character::${CharacterId}`]) || {}
    return currentState
}

export const getSubscribedCharacterIds = (state) => {
    const myCharacters = state.player?.Characters ?? []
    const activeCharacters = getActiveCharacters(state)
    return myCharacters.filter((characterId) => (activeCharacters[characterId]?.isSubscribed))
}

export const getActiveCharacterInPlayMessages = (CharacterId) => (state) => {
    const messages = getMessages(state)
    return messages
        .filter(({ Target, ThreadId }) => (Target === CharacterId && ThreadId === undefined))
}