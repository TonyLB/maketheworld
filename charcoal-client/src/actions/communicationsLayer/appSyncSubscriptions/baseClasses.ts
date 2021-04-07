import { ISSMTemplateAbstract, ISSMPotentialState, ISSMAction } from '../../stateSeekingMachine/baseClasses'

export const SUBSCRIPTION_SUCCESS = 'SUBSCRIPTION_SUCCESS'

export type subscriptionSSMKeys = 'INITIAL' | 'SUBSCRIBING' | 'SUBSCRIBED' | 'SYNCHING' | 'SYNCHRONIZED' | 'UNSUBSCRIBING'
export type cachedSubscriptionSSMKeys = 'INITIAL' | 'FETCHING' | 'FETCHED' | 'SUBSCRIBING' | 'SUBSCRIBED' | 'SYNCHING' | 'SYNCHRONIZED' | 'UNSUBSCRIBING'

//
// Implement a state-seeking machine to keep websockets connected where possible.
//
export const subscriptionSSMClassGenerator = <D extends Record<string, any>, T extends string>({
    ssmType, initialData, subscribeAction, unsubscribeAction, syncAction
}: {
    ssmType: T;
    initialData: D;
    subscribeAction: ISSMAction<D>;
    unsubscribeAction: ISSMAction<D>;
    syncAction: ISSMAction<D>
}) => class implements ISSMTemplateAbstract<subscriptionSSMKeys, D> {
    ssmType: T = ssmType
    initialState: subscriptionSSMKeys = 'INITIAL'
    initialData: D = initialData
    states: Record<subscriptionSSMKeys, ISSMPotentialState<subscriptionSSMKeys, D>> = {
        INITIAL: {
            stateType: 'CHOICE',
            key: 'INITIAL',
            choices: ['SUBSCRIBING']
        },
        SUBSCRIBING: {
            stateType: 'ATTEMPT',
            key: 'SUBSCRIBING',
            action: subscribeAction,
            resolve: 'SUBSCRIBED',
            reject: 'INITIAL'
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
            choices: ['UNSUBSCRIBING']
        },
    }
}

//
// Implement a more elaborate state-seeking machine to keep websockets connected where possible,
// including fetching cached information.
//
export const cachedSubscriptionSSMClassGenerator = <D extends Record<string, any>, T extends string>({
    ssmType, initialData, fetchAction, subscribeAction, unsubscribeAction, syncAction
}: {
    ssmType: T;
    initialData: D;
    fetchAction: ISSMAction<D>;
    subscribeAction: ISSMAction<D>;
    unsubscribeAction: ISSMAction<D>;
    syncAction: ISSMAction<D>
}) => class implements ISSMTemplateAbstract<cachedSubscriptionSSMKeys, D> {
    ssmType: T = ssmType
    initialState: subscriptionSSMKeys = 'INITIAL'
    initialData: D = initialData
    states: Record<cachedSubscriptionSSMKeys, ISSMPotentialState<cachedSubscriptionSSMKeys, D>> = {
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
            choices: ['SUBSCRIBING']
        },
        SUBSCRIBING: {
            stateType: 'ATTEMPT',
            key: 'SUBSCRIBING',
            action: subscribeAction,
            resolve: 'SUBSCRIBED',
            reject: 'INITIAL'
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
            choices: ['UNSUBSCRIBING']
        }
    }
}
