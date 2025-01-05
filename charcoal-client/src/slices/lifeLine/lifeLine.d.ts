import { AssetClientMessage } from '@tonylb/mtw-interfaces/ts/asset'
import { EphemeraClientMessage } from '@tonylb/mtw-interfaces/ts/ephemera'
import { CoordinationClientMessage } from '@tonylb/mtw-interfaces/ts/coordination'
import { SubscriptionClientMessage } from '@tonylb/mtw-interfaces/ts/subscriptions'

export type LifeLinePubSubData = EphemeraClientMessage
    | AssetClientMessage
    | CoordinationClientMessage
    | SubscriptionClientMessage

interface LifeLineSubscribeAction {
    (next: (incoming: { payload: LifeLinePubSubData, unsubscribe: () => void }) => void): {
        unsubscribe: () => void;
    }
}
