import { ISSMTemplateAbstract, ISSMPotentialState, ISSMAction } from '../stateSeekingMachine/baseClasses'

export type characterSSMKeys =
    'INITIAL' |
    'FETCHING' |
    'FETCHED' |
    'SUBSCRIBING' |
    'SUBSCRIBED' |
    'UNSUBSCRIBING' |
    'SYNCHING' |
    'SYNCHRONIZED' |
    'REGISTERING' |
    'REGISTERED' |
    'DEREGISTERING' |
    'REREGISTERING'

export class CharacterSubscriptionData {
    CharacterId: string = ''
    LastMessageSync: number = 0
    subscription: any = null
    incrementalBackoff: number = 0.5
}

export const characterSSMClassGenerator = ({
    fetchAction, subscribeAction, unsubscribeAction, syncAction, registerAction, deregisterAction
}: {
    fetchAction: ISSMAction<CharacterSubscriptionData>;
    subscribeAction: ISSMAction<CharacterSubscriptionData>;
    unsubscribeAction: ISSMAction<CharacterSubscriptionData>;
    syncAction: ISSMAction<CharacterSubscriptionData>,
    registerAction: ISSMAction<CharacterSubscriptionData>,
    deregisterAction: ISSMAction<CharacterSubscriptionData>
}) => class implements ISSMTemplateAbstract<characterSSMKeys, CharacterSubscriptionData> {
    ssmType: 'CharacterSubscription' = 'CharacterSubscription'
    initialState: characterSSMKeys = 'INITIAL'
    initialData: CharacterSubscriptionData = new CharacterSubscriptionData()
    constructor(CharacterId: string) {
        this.initialData.CharacterId = CharacterId
    }
    states: Record<characterSSMKeys, ISSMPotentialState<characterSSMKeys, CharacterSubscriptionData>> = {
        INITIAL: {
            stateType: 'CHOICE',
            key: 'INITIAL',
            choices: ['FETCHING']
        },
        FETCHING: {
            stateType: 'ATTEMPT',
            key: 'FETCHING',
            action: fetchAction,
            resolve: 'FETCHED',
            reject: 'INITIAL'
        },
        FETCHED: {
            stateType: 'CHOICE',
            key: 'FETCHED',
            choices: ['INITIAL', 'SUBSCRIBING']
        },
        SUBSCRIBING: {
            stateType: 'ATTEMPT',
            key: 'SUBSCRIBING',
            action: subscribeAction,
            resolve: 'SUBSCRIBED',
            reject: 'FETCHED'
        },
        SUBSCRIBED: {
            stateType: 'CHOICE',
            key: 'SUBSCRIBED',
            choices: ['UNSUBSCRIBING', 'SYNCHING']
        },
        UNSUBSCRIBING: {
            stateType: 'ATTEMPT',
            key: 'UNSUBSCRIBING',
            action: unsubscribeAction,
            resolve: 'INITIAL',
            reject: 'INITIAL'
        },
        SYNCHING: {
            stateType: 'ATTEMPT',
            key: 'SYNCHING',
            action: syncAction,
            resolve: 'SYNCHRONIZED',
            reject: 'SUBSCRIBED'
        },
        SYNCHRONIZED: {
            stateType: 'CHOICE',
            key: 'SYNCHRONIZED',
            choices: ['UNSUBSCRIBING', 'REGISTERING']
        },
        REGISTERING: {
            stateType: 'ATTEMPT',
            key: 'REGISTERING',
            action: registerAction,
            resolve: 'REGISTERED',
            reject: 'SYNCHRONIZED'
        },
        REGISTERED: {
            stateType: 'CHOICE',
            key: 'REGISTERED',
            choices: ['UNSUBSCRIBING', 'DEREGISTERING']
        },
        DEREGISTERING: {
            stateType: 'ATTEMPT',
            key: 'DEREGISTERING',
            action: deregisterAction,
            resolve: 'SUBSCRIBED',
            reject: 'SUBSCRIBED'
        },
        REREGISTERING: {
            stateType: 'ATTEMPT',
            key: 'REREGISTERING',
            action: registerAction,
            resolve: 'REGISTERED',
            reject: 'SYNCHRONIZED'
        }
    }
}

