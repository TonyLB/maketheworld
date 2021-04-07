import { API, graphqlOperation } from 'aws-amplify'
import { getPlayer } from '../../../graphql/queries'
import { changedEphemera } from '../../../graphql/subscriptions'

import { fetchCharactersInPlay } from '../../characters'

import { subscriptionSSMClassGenerator, SUBSCRIPTION_SUCCESS, subscriptionSSMKeys } from './baseClasses'
import { IStateSeekingMachineAbstract } from '../../stateSeekingMachine/baseClasses'


export const PLAYER_UPDATE = 'PLAYER_UPDATE'
export const GRANT_UPDATE = 'GRANT_UPDATE'
export const GRANT_REVOKE = 'GRANT_REVOKE'

class EphemeraSubscriptionData {
}

//
// TODO:  Specify the details of this interface
//
interface IChangedEphemera {
    CharacterInPlay: {
        CharacterId: string;
        RoomId: string;
        Connected: boolean;
    }
}

export const RECEIVE_EPHEMERA_CHANGE = 'RECEIVE_EPHEMERA_CHANGE'

const receiveEphemeraChange = (payload: IChangedEphemera[]) => (dispatch: any, getState: any) => {
    const state = getState()
    //
    // Update the store and create a predicted next state
    //
    const action = {
        type: RECEIVE_EPHEMERA_CHANGE,
        payload
    }
    dispatch(action)
    //
    // TODO:  Refactor server-side connection logging so that when a character is connected it
    // handles (a) sending the room description message to give them the current state of their
    // surroundings, and (b) sending the 'X has connected.' message to everyone nearby.  Should
    // be much easier once we refactor messaging as a microservice behing an SQS/SNS disconnect.
    //

    // const newState = {
    //     ...state,
    //     charactersInPlay: charactersInPlayReducer(state.charactersInPlay || {}, action)
    // }
    // const myCharacter = getMyCharacterInPlay(newState)
    // const myCurrentCharacter = getMyCurrentCharacter(newState)
    // const myPreviousCharacter = getMyCharacterInPlay(state)
    // if (myCharacter.CharacterId === payload.CharacterId) {
    //     //
    //     // Handle actions that depend upon changes in the state of your own character.
    //     //
    //     const currentNeighborhood = getCurrentNeighborhood(state)
    //     const previousAncestry = (currentNeighborhood && currentNeighborhood.ancestry)
    //     if (myCharacter && myCharacter.Connected && myCharacter.RoomId && !(myPreviousCharacter && myPreviousCharacter.Connected && myPreviousCharacter.RoomId === myCharacter.RoomId)) {
    //         return API.graphql(graphqlOperation(getRoomRecap, { PermanentId: payload.RoomId }))
    //             .then(({ data }) => (data))
    //             .then(({ getRoomRecap }) => (getRoomRecap))
    //             .then((Recap) => {
    //                 dispatch(lookRoom({ RoomId: myCharacter.RoomId, Recap, showNeighborhoods: true, previousAncestry }))
    //                 const { Name = 'Someone' } = myCurrentCharacter || {}
    //                 dispatch(sendWorldMessage({ RoomId: myCharacter.RoomId, Message: `${Name} has ${(myPreviousCharacter.Connected) ? 'arrived' : 'connected'}.` }))
    //             })
    //     }
    // }
}
const subscribeAction = () => async (dispatch: any, getState: any): Promise<Partial<EphemeraSubscriptionData>> => {
    const subscription = API.graphql(graphqlOperation(changedEphemera))
        .subscribe({
            next: (ephemeraData: { value?: { data?: { changedEphemera?: IChangedEphemera[] }}}) => {
                const { value = {} } = ephemeraData
                const { data = {} } = value
                const { changedEphemera = [] } = data
                dispatch(receiveEphemeraChange(changedEphemera))
            }
        })

    dispatch({
        type: SUBSCRIPTION_SUCCESS,
        payload: { ephemera: subscription }
    })
    return {}
}

const unsubscribeAction = () => async (dispatch: any, getState: any): Promise<Partial<EphemeraSubscriptionData>> => {
    const ephemeraSubscription: any = getState().communicationsLayer.appSyncSubscriptions.ephemera?.subscription
    if (ephemeraSubscription) {
        await ephemeraSubscription.unsubscribe()
    }
    return {}
}

const syncAction = () => async (dispatch: any, getState: any): Promise<Partial<EphemeraSubscriptionData>> => {
    //
    // TODO:  Remove fetchCharactersInPlay ATTEMPT and ERROR states (since they're now handled by the SSM)
    //
    dispatch(fetchCharactersInPlay())
    return {}
}

//
// Configure subscription and synchronization for Ephemera DB table
//
export class EphemeraSubscriptionTemplate extends subscriptionSSMClassGenerator<EphemeraSubscriptionData, 'EphemeraSubscription'>({
    ssmType: 'EphemeraSubscription',
    initialData: new EphemeraSubscriptionData(),
    subscribeAction,
    unsubscribeAction,
    syncAction
}){ }

export type EphemeraSubscriptionSSM = IStateSeekingMachineAbstract<subscriptionSSMKeys, EphemeraSubscriptionData, EphemeraSubscriptionTemplate>
