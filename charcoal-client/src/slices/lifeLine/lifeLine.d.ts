import { AssetClientPlayerMessage, AssetClientLibraryMessage } from '@tonylb/mtw-interfaces/dist/asset'
import { EphemeraClientMessageEphemeraUpdate, EphemeraClientMessagePublishMessages, EphemeraClientMessageRegisterMessage } from '@tonylb/mtw-interfaces/dist/ephemera'
import { CoordinationClientMessage } from '@tonylb/mtw-interfaces/dist/coordination'

export type LifeLinePubSubData = EphemeraClientMessageRegisterMessage
    | EphemeraClientMessagePublishMessages
    | EphemeraClientMessageEphemeraUpdate
    | AssetClientPlayerMessage
    | AssetClientLibraryMessage
    | CoordinationClientMessage

interface LifeLineSubscribeAction {
    (next: (incoming: { payload: LifeLinePubSubData, unsubscribe: () => void }) => void): {
        unsubscribe: () => void;
    }
}
