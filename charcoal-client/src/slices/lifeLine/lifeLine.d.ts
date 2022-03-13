import { Message } from '../messages'
import { EphemeraFormat } from './ephemera'
import { PlayerPublic } from '../player/baseClasses'
import { LibraryPublic } from '../library/baseClasses'

type LifeLineRegisterMessage = {
    messageType: 'Registered';
    RequestId?: string;
    CharacterId: string;
}

type LifeLineReceiveMessage = {
    messageType: 'Messages',
    RequestId?: string;
    messages: Message[]
}

type LifeLineReceiveEphemera = {
    messageType: 'Ephemera',
    RequestId?: string;
    updates: EphemeraFormat[]
}

type LifeLineReceivePlayer = {
    messageType: 'Player',
    RequestId?: string;
} & PlayerPublic

type LifeLineReceiveLibrary = {
    messageType: 'Library',
    RequestId?: string;
} & LibraryPublic

type LifeLineError = {
    messageType: 'Error',
    RequestId?: string;
    //
    // TODO:  More sophisticated error handling that returns an error message
    //
}

export type LifeLinePubSubData = LifeLineRegisterMessage
    | LifeLineReceiveMessage
    | LifeLineReceiveEphemera
    | LifeLineReceivePlayer
    | LifeLineReceiveLibrary
    | LifeLineError

interface LifeLineSubscribeAction {
    (next: (incoming: { payload: LifeLinePubSubData, unsubscribe: () => void }) => void): {
        unsubscribe: () => void;
    }
}
