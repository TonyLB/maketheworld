import { AssetClientMessage } from '@tonylb/mtw-interfaces/dist/asset'
import { EphemeraClientMessage } from '@tonylb/mtw-interfaces/dist/ephemera'
import { CoordinationClientMessage } from '@tonylb/mtw-interfaces/dist/coordination'
import { SubscriptionClientMessage } from '@tonylb/mtw-interfaces/dist/subscriptions'

export type LifeLinePubSubData = EphemeraClientMessage
    | AssetClientMessage
    | CoordinationClientMessage
    | SubscriptionClientMessage

interface LifeLineSubscribeAction {
    (next: (incoming: { payload: LifeLinePubSubData, unsubscribe: () => void }) => void): {
        unsubscribe: () => void;
    }
}
