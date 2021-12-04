import { subscriptionSSMClassGenerator, subscriptionSSMKeys } from './baseClasses'
import { IStateSeekingMachineAbstract } from '../../stateSeekingMachine/baseClasses'
import { getLifeLine } from '../../../selectors/communicationsLayer'
import { socketDispatchPromise } from '../lifeLine'
import { LifeLineData } from '../lifeLine/baseClass'
import { EphemeraFormat } from '../lifeLine/ephemera'

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

const receiveEphemeraChange = (payload: EphemeraFormat[]) => ({
    type: RECEIVE_EPHEMERA_CHANGE,
    payload
})

const subscribeAction = () => async (dispatch: any, getState: any): Promise<Partial<EphemeraSubscriptionData>> => {
    const lifeLine = getLifeLine(getState()) as LifeLineData

    const lifeLineSubscription = lifeLine.subscribe(({ payload }) => {
        if (payload.messageType === 'Ephemera') {
            const { updates } = payload
            dispatch(receiveEphemeraChange(updates))
        }
    })

    return { subscription: lifeLineSubscription }
}

const unsubscribeAction = () => async (dispatch: any, getState: any): Promise<Partial<EphemeraSubscriptionData>> => {
    const ephemeraSubscription: any = getState().communicationsLayer.appSyncSubscriptions.ephemera?.subscription
    if (ephemeraSubscription) {
        await ephemeraSubscription.unsubscribe()
    }
    return {}
}

const syncAction = () => async (dispatch: any, getState: any): Promise<Partial<EphemeraSubscriptionData>> => {
    await dispatch(socketDispatchPromise('fetchEphemera')({}))
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
