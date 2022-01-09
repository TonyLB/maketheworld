import { produce, immerable } from 'immer'

import { SUBSCRIPTION_SUCCESS } from '../../actions/communicationsLayer/appSyncSubscriptions'

class SubscriptionModule {
    subscription: any = null
}

type AppSyncSubscriptionModuleKey = 'permanents' | 'ephemera' | 'player'
export class AppSyncSubscriptionsModule {
    [immerable]: boolean = true
    permanents: SubscriptionModule = new SubscriptionModule()
    ephemera: SubscriptionModule = new SubscriptionModule()
    player: SubscriptionModule = new SubscriptionModule()
    characters: Record<string, SubscriptionModule> = {}
}

export const reducer = (state: AppSyncSubscriptionsModule = new AppSyncSubscriptionsModule(), action: { type?: string; payload?: any } = {}) => {
    const { type: actionType = "NOOP", payload = {} } = action
    switch (actionType) {
        case SUBSCRIPTION_SUCCESS:
            return produce(state, (draftState) => {
                Object.entries(payload).forEach(([key, value]) => {
                    if (['permanents', 'ephemera', 'player'].includes(key)) {
                        draftState[key as AppSyncSubscriptionModuleKey].subscription = value
                    }
                    if (key === 'characters') {
                        Object.entries(value as Record<string, { subscription: any }>).forEach(([characterId, subscription]) => {
                            draftState.characters[characterId] = { subscription }
                        })
                    }
                }, state)
            })
        default: return state
    }
}

export default reducer