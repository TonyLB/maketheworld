import { subscriptionSSMClassGenerator, subscriptionSSMKeys } from './baseClasses'
import { IStateSeekingMachineAbstract } from '../../stateSeekingMachine/baseClasses'
import { getLifeLine } from '../../../selectors/communicationsLayer'
import { socketDispatch } from '../lifeLine'


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
        Name: string;
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
}

const subscribeAction = () => async (dispatch: any, getState: any): Promise<Partial<EphemeraSubscriptionData>> => {
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
    // TODO:  Write a handler subscription that can be applied to track when fetchephemera has returned
    // all relevant updates, and then write a promise-wrapper that holds the state-advance from SYNCHRONIZING
    // to SYNCHRONIZED, until the results are back.
    //
    dispatch(socketDispatch('fetchEphemera')({}))
    return {}
}

//
// Configure subscription and synchronization for Ephemera DB table
//
export class EphemeraSubscriptionTemplate extends subscriptionSSMClassGenerator<EphemeraSubscriptionData, 'EphemeraSubscription'>({
    ssmType: 'EphemeraSubscription',
    initialData: new EphemeraSubscriptionData(),
    condition: (_, getState) => {
        const { status } = getLifeLine(getState())
        return status === 'CONNECTED'
    },
    subscribeAction,
    unsubscribeAction,
    syncAction
}){ }

export type EphemeraSubscriptionSSM = IStateSeekingMachineAbstract<subscriptionSSMKeys, EphemeraSubscriptionData, EphemeraSubscriptionTemplate>
