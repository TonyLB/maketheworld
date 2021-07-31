import { Auth, API, graphqlOperation } from 'aws-amplify'
import { getPlayer } from '../../../graphql/queries'
import { changedPlayer } from '../../../graphql/subscriptions'

import { registerCharacterSSM } from '../../activeCharacters'
import { subscriptionSSMClassGenerator, SUBSCRIPTION_SUCCESS, subscriptionSSMKeys } from './baseClasses'
import { IStateSeekingMachineAbstract } from '../../stateSeekingMachine/baseClasses'

import { receiveMyCharacterChange } from '../../characters'

export const PLAYER_UPDATE = 'PLAYER_UPDATE'
export const GRANT_UPDATE = 'GRANT_UPDATE'
export const GRANT_REVOKE = 'GRANT_REVOKE'

class PlayerSubscriptionData {
    PlayerName: string = ''
}

class PlayerData {
    PlayerName: string = ''
    CodeOfConductConsent: boolean = false
    Characters: string[] = []
}

const playerUpdate = (playerData: PlayerData) => (dispatch: any) => {
    dispatch({
        type: PLAYER_UPDATE,
        data: playerData
    })
    const characters = playerData.Characters ?? []
    characters.forEach((CharacterId) => {
        dispatch(registerCharacterSSM(CharacterId))
    })
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

const subscribeAction = () => async (dispatch: any, getState: any): Promise<Partial<PlayerSubscriptionData>> => {
    const { username = '' } = await Auth.currentAuthenticatedUser()

    const playerSubscription = (API.graphql(graphqlOperation(changedPlayer, { PlayerName: username})) as any)
        .subscribe({
            next: (message: { value?: { data?: { changedPlayer?: IChangedPlayer } } } = {}) => {
                const { Type, PlayerInfo, CharacterInfo, GrantInfo } = message.value?.data?.changedPlayer ?? { Type: '' }
                if (PlayerInfo) {
                    dispatch(playerUpdate(PlayerInfo))
                }
                if (CharacterInfo) {
                    dispatch(receiveMyCharacterChange(CharacterInfo))
                }
                if (GrantInfo) {
                    switch(Type) {
                        case 'GRANT':
                            dispatch(grantUpdate(GrantInfo))
                            break;
                        case 'REVOKE':
                            dispatch(grantRevoke(GrantInfo))
                            break;
                        default:
                    }
                }
            }
        })

    dispatch({
        type: SUBSCRIPTION_SUCCESS,
        payload: { player: playerSubscription }
    })
    return { PlayerName: username }
}

const unsubscribeAction = () => async (dispatch: any, getState: any): Promise<Partial<PlayerSubscriptionData>> => {
    const playerSubscription: any = getState().communicationsLayer.appSyncSubscriptions.player?.subscription
    if (playerSubscription) {
        await playerSubscription.unsubscribe()
    }
    return Promise.resolve({})
}

const syncAction = ({ PlayerName: username }: PlayerSubscriptionData) => async (dispatch: any, getState: any): Promise<Partial<PlayerSubscriptionData>> => {
    dispatch(fetchPlayer(username))
    return {}
}
//
// Configure subscription and synchronization for Players DB table
//
export class PlayerSubscriptionTemplate extends subscriptionSSMClassGenerator<PlayerSubscriptionData, 'PlayerSubscription'>({
    ssmType: 'PlayerSubscription',
    initialData: new PlayerSubscriptionData(),
    condition: () => (true),
    subscribeAction,
    unsubscribeAction,
    syncAction
}){ }

export type PlayerSubscriptionSSM = IStateSeekingMachineAbstract<subscriptionSSMKeys, PlayerSubscriptionData, PlayerSubscriptionTemplate>
