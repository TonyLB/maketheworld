import { MessageFormat } from './messages'
import { EphemeraFormat } from './ephemera'
import { PlayerData } from './player'

type LifeLineRegisterMessage = {
    messageType: 'Registered';
    RequestId?: string;
    CharacterId: string;
}

type LifeLineReceiveMessage = {
    messageType: 'Messages',
    RequestId?: string;
    messages: MessageFormat[]
}

type LifeLineReceiveEphemera = {
    messageType: 'Ephemera',
    RequestId?: string;
    updates: EphemeraFormat[]
}

type LifeLineReceivePlayer = {
    messageType: 'Player',
    RequestId?: string;
} & PlayerData

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
    | LifeLineError

interface LifeLineSubscribeAction {
    (next: (incoming: { payload: LifeLinePubSubData, unsubscribe: () => void }) => void): {
        unsubscribe: () => void;
    }
}
