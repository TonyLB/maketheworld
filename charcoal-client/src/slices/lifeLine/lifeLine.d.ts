import { AssetClientMessage } from '@tonylb/mtw-interfaces/ts/asset'
import { EphemeraClientMessage } from '@tonylb/mtw-interfaces/ts/ephemera'
import { CoordinationClientMessage } from '@tonylb/mtw-interfaces/ts/coordination'
import { SubscriptionClientMessage } from '@tonylb/mtw-interfaces/ts/subscriptions'

export type PeriodicTickLifeLineMessage = { messageType: 'PeriodicTick'; now: number }

export type LifeLinePubSubData = (EphemeraClientMessage
    | AssetClientMessage
    | CoordinationClientMessage
    | SubscriptionClientMessage
    | PeriodicTickLifeLineMessage) & { RequestId?: string; conversationId?: string }

interface LifeLineSubscribeAction {
    (next: (incoming: { payload: LifeLinePubSubData, unsubscribe: () => void }) => void): {
        unsubscribe: () => void;
    }
}
