import { LibraryPublic } from '../library/baseClasses'
import { AssetClientPlayerMessage, AssetClientLibraryMessage } from '@tonylb/mtw-interfaces/dist/asset'
import { EphemeraClientMessageEphemeraUpdate, EphemeraClientMessagePublishMessages, EphemeraClientMessageRegisterMessage } from '@tonylb/mtw-interfaces/dist/ephemera'

type LifeLineError = {
    messageType: 'Error',
    RequestId?: string;
    //
    // TODO:  More sophisticated error handling that returns an error message
    //
}

export type LifeLinePubSubData = EphemeraClientMessageRegisterMessage
    | EphemeraClientMessagePublishMessages
    | EphemeraClientMessageEphemeraUpdate
    | AssetClientPlayerMessage
    | AssetClientLibraryMessage
    | LifeLineError

interface LifeLineSubscribeAction {
    (next: (incoming: { payload: LifeLinePubSubData, unsubscribe: () => void }) => void): {
        unsubscribe: () => void;
    }
}
