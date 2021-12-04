import { Auth } from 'aws-amplify'

import { subscriptionSSMClassGenerator, SUBSCRIPTION_SUCCESS, subscriptionSSMKeys } from './baseClasses'
import { IStateSeekingMachineAbstract } from '../../stateSeekingMachine/baseClasses'
import { getLifeLine } from '../../../selectors/communicationsLayer'
import { socketDispatchPromise } from '../lifeLine'
import { LifeLineData } from '../lifeLine/baseClass'
import { PlayerData } from '../lifeLine/player'

export const PLAYER_UPDATE = 'PLAYER_UPDATE'
export const GRANT_UPDATE = 'GRANT_UPDATE'
export const GRANT_REVOKE = 'GRANT_REVOKE'

class PlayerSubscriptionData {
    PlayerName: string = '';
    subscription?: {
        unsubscribe: () => void
    }
}

const playerUpdate = (playerData: PlayerData) => (dispatch: any) => {
    dispatch({
        type: PLAYER_UPDATE,
        data: playerData
    })
}

//
// TODO: Step 4
//
// Remove supporting graphQL operations (putPlayer, the putGrant/revokeGrant section of
// updatePermanent, and much of the functionality of putCharacter in updatePermanent)
//
const subscribeAction = () => async (dispatch: any, getState: any): Promise<Partial<PlayerSubscriptionData>> => {
    const lifeLine = getLifeLine(getState()) as LifeLineData

    const lifeLineSubscription = lifeLine.subscribe(({ payload }) => {
        if (payload.messageType === 'Player') {
            const { messageType, RequestId, ...rest } = payload
            dispatch(playerUpdate(rest))
        }
    })

    return { subscription: lifeLineSubscription }
}

const unsubscribeAction = ({ subscription }: PlayerSubscriptionData) => async (dispatch: any, getState: any): Promise<Partial<PlayerSubscriptionData>> => {
    if (subscription) {
        subscription.unsubscribe()
    }
    return { subscription: undefined }
}

const syncAction = () => async (dispatch: any, getState: any): Promise<Partial<PlayerSubscriptionData>> => {
    //
    // The ControlChannel function already knows (from initialization of the WebSocket),
    // who the player is.  We get their state details from the back-end.
    //
    await dispatch(socketDispatchPromise('whoAmI')({}))
    return {}
}
//
// Configure subscription and synchronization for Player info
//
export class PlayerSubscriptionTemplate extends subscriptionSSMClassGenerator<PlayerSubscriptionData, 'PlayerSubscription'>({
    ssmType: 'PlayerSubscription',
    initialData: new PlayerSubscriptionData(),
    condition: (_, getState) => {
        const { status } = getLifeLine(getState())
        return status === 'CONNECTED'
    },
    subscribeAction,
    unsubscribeAction,
    syncAction
}){ }

export type PlayerSubscriptionSSM = IStateSeekingMachineAbstract<subscriptionSSMKeys, PlayerSubscriptionData, PlayerSubscriptionTemplate>
