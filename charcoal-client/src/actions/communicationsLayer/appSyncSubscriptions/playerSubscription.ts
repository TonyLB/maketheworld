import { Auth, API, graphqlOperation } from 'aws-amplify'
import { getPlayer } from '../../../graphql/queries'
import { changedPlayer } from '../../../graphql/subscriptions'

import { registerCharacterSSM } from '../../activeCharacters'
import { subscriptionSSMClassGenerator, SUBSCRIPTION_SUCCESS, subscriptionSSMKeys } from './baseClasses'
import { IStateSeekingMachineAbstract } from '../../stateSeekingMachine/baseClasses'
import { getLifeLine } from '../../../selectors/communicationsLayer'
import { LifeLinePubSub, LifeLineSSM, socketDispatch, socketDispatchPromise } from '../lifeLine'
import { LifeLineData } from '../lifeLine/baseClass'
import { PlayerData } from '../lifeLine/player'

import { receiveMyCharacterChange } from '../../characters'

export const PLAYER_UPDATE = 'PLAYER_UPDATE'
export const GRANT_UPDATE = 'GRANT_UPDATE'
export const GRANT_REVOKE = 'GRANT_REVOKE'

class PlayerSubscriptionData {
    PlayerName: string = ''
}

const playerUpdate = (playerData: PlayerData) => (dispatch: any) => {
    dispatch({
        type: PLAYER_UPDATE,
        data: playerData
    })
    // const characters = playerData.Characters ?? []
    // characters.forEach((CharacterId) => {
    //     dispatch(registerCharacterSSM({ CharacterId, defaultIntent: 'SYNCHRONIZED' }))
    // })
}

const fetchPlayer = (username: string) => async (dispatch: any) => {
    const response = await (API.graphql(graphqlOperation(getPlayer, { PlayerName: username })) ?? {}) as any
    const playerData = response.data?.getPlayer || { PlayerName: username }
    await dispatch(playerUpdate(playerData))
}

const grantUpdate = (grantData: any) => ({
    type: GRANT_UPDATE,
    payload: grantData
})

const grantRevoke = (grantData: any) => ({
    type: GRANT_REVOKE,
    payload: grantData
})


//
// TODO:  Specify the details of this interface
//
interface IChangedPlayer {
    Type?: string;
    PlayerInfo?: PlayerData;
    CharacterInfo?: any;
    GrantInfo?: any;
}

//
// TODO: Step 1
//
// Create sub-outlets within the controlChannel app to handle playerUpdate and myCharacterChange
// (probably storing myCharacters denormalized in a player meta-data object)
//

//
// TODO: Step 2
//
// Remove playerUpdate and receiveMyCharacterChange from graphQL subscription, and insted
// hand a subscription off of the controlChannel LifeLine (including rewriting sync and
// unsubscribe to deal with lifeline connection)
//

//
// TODO: Step 3
//
// Remove Grant functionality from throughout the application (to be replaced as we
// extend the Asset management system)
//

//
// TODO: Step 4
//
// Remove supporting graphQL operations (putPlayer, the putGrant/revokeGrant section of
// updatePermanent, and much of the functionality of putCharacter in updatePermanent)
//
const subscribeAction = () => async (dispatch: any, getState: any): Promise<Partial<PlayerSubscriptionData>> => {
    const { username = '' } = await Auth.currentAuthenticatedUser()
    const lifeLine = getLifeLine(getState()) as LifeLineData

    // const playerSubscription = (API.graphql(graphqlOperation(changedPlayer, { PlayerName: username})) as any)
    //     .subscribe({
    //         next: (message: { value?: { data?: { changedPlayer?: IChangedPlayer } } } = {}) => {
    //             const { Type, PlayerInfo, CharacterInfo, GrantInfo } = message.value?.data?.changedPlayer ?? { Type: '' }
    //             if (PlayerInfo) {
    //                 dispatch(playerUpdate(PlayerInfo))
    //             }
    //             if (CharacterInfo) {
    //                 dispatch(receiveMyCharacterChange(CharacterInfo))
    //             }
    //             if (GrantInfo) {
    //                 switch(Type) {
    //                     case 'GRANT':
    //                         dispatch(grantUpdate(GrantInfo))
    //                         break;
    //                     case 'REVOKE':
    //                         dispatch(grantRevoke(GrantInfo))
    //                         break;
    //                     default:
    //                 }
    //             }
    //         }
    //     })
    const currentSession = await Auth.currentSession()
    console.log(`JWT: ${currentSession.getIdToken().getJwtToken()}`)
    const lifeLineSubscription = lifeLine.subscribe(({ payload }) => {
        if (payload.messageType === 'Player') {
            const { messageType, ...rest } = payload
            dispatch(playerUpdate(rest))
        }
    })

    dispatch({
        type: SUBSCRIPTION_SUCCESS,
        payload: { player: {
            unsubscribe: () => {
                // playerSubscription.unsubscribe()
                lifeLineSubscription.unsubscribe()
            }
        } }
    })
    return { PlayerName: username }
}

const unsubscribeAction = () => async (dispatch: any, getState: any): Promise<Partial<PlayerSubscriptionData>> => {
    const playerSubscription: any = getState().communicationsLayer.appSyncSubscriptions.player?.subscription
    if (playerSubscription) {
        await playerSubscription.unsubscribe()
    }
    return {}
}

const syncAction = ({ PlayerName: username }: PlayerSubscriptionData) => async (dispatch: any, getState: any): Promise<Partial<PlayerSubscriptionData>> => {
    const { username = '' } = await Auth.currentAuthenticatedUser()

    dispatch(socketDispatchPromise('whoAmI')({ userName: username }))
        .then((value: any) => {
            console.log(`WhoAmI returns: ${JSON.stringify(value, null, 4)}`)
        })
    dispatch(fetchPlayer(username))
    return {}
}
//
// Configure subscription and synchronization for Players DB table
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
