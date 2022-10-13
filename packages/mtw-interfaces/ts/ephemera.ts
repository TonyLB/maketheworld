import { EphemeraCharacterId, EphemeraFeatureId, EphemeraMapId, EphemeraRoomId } from "./baseClasses"
import { LegalCharacterColor } from './baseClasses'
import { Message } from "./messages"

export type RegisterCharacterAPIMessage = {
    message: 'registercharacter';
    CharacterId: string;
}

export type FetchEphemeraAPIMessage = {
    message: 'fetchEphemera';
    CharacterId?: string;
}

export type FetchImportDefaultsAPIMessage = {
    message: 'fetchImportDefaults';
    importsByAssetId: Record<string, any>;
    assetId: string;
}

export type WhoAmIAPIMessage = {
    message: 'whoAmI';
}

export type SyncAPIMessage = {
    message: 'sync';
    CharacterId: string;
    startingAt?: number;
    limit?: number;
}

export type MapSubscribeAPIMessage = {
    message: 'subscribeToMaps';
    CharacterId: string;
}

type ActionAPILookMessage = {
    actionType: 'look';
    payload: {
        CharacterId: EphemeraCharacterId;
        EphemeraId: EphemeraRoomId | EphemeraFeatureId | EphemeraMapId;
    }
}

type ActionAPICommunicationMetaMessage = {
    payload: {
        CharacterId: EphemeraCharacterId;
        Message: string;
    }
}

type ActionAPISayMessage = {
    actionType: 'SayMessage';
} & ActionAPICommunicationMetaMessage

type ActionAPINarrateMessage = {
    actionType: 'NarrateMessage';
} & ActionAPICommunicationMetaMessage

type ActionAPIOOCMessage = {
    actionType: 'OOCMessage';
} & ActionAPICommunicationMetaMessage

type ActionAPIMoveMessage = {
    actionType: 'move';
    payload: {
        CharacterId: EphemeraCharacterId;
        RoomId: EphemeraRoomId;
        ExitName?: string;
    }
}

type ActionAPIHomeMessage = {
    actionType: 'home';
    payload: {
        CharacterId: EphemeraCharacterId;
    }
}

export type ActionAPIMessage = {
    message: 'action';
} & (
    ActionAPILookMessage |
    ActionAPISayMessage |
    ActionAPINarrateMessage |
    ActionAPIOOCMessage |
    ActionAPIMoveMessage |
    ActionAPIHomeMessage
)

export type LinkAPIMessage = {
    message: 'link';
    to: string;
    CharacterId: string;
}

export type CommandAPIMessage = {
    message: 'command';
    CharacterId: EphemeraCharacterId;
    command: string;
}

export type EphemeraAPIMessage = { RequestId?: string } & (
    RegisterCharacterAPIMessage |
    FetchEphemeraAPIMessage |
    FetchImportDefaultsAPIMessage |
    WhoAmIAPIMessage |
    SyncAPIMessage |
    MapSubscribeAPIMessage |
    ActionAPIMessage |
    LinkAPIMessage |
    CommandAPIMessage
)

export const isRegisterCharacterAPIMessage = (message: EphemeraAPIMessage): message is RegisterCharacterAPIMessage => (message.message === 'registercharacter')
export const isFetchEphemeraAPIMessage = (message: EphemeraAPIMessage): message is FetchEphemeraAPIMessage => (message.message === 'fetchEphemera')
export const isFetchImportDefaultsAPIMessage = (message: EphemeraAPIMessage): message is FetchImportDefaultsAPIMessage => (message.message === 'fetchImportDefaults')
export const isWhoAmIAPIMessage = (message: EphemeraAPIMessage): message is WhoAmIAPIMessage => (message.message === 'whoAmI')
export const isSyncAPIMessage = (message: EphemeraAPIMessage): message is SyncAPIMessage => (message.message === 'sync')
export const isMapSubscribeAPIMessage = (message: EphemeraAPIMessage): message is MapSubscribeAPIMessage => (message.message === 'subscribeToMaps')
export const isActionAPIMessage = (message: EphemeraAPIMessage): message is ActionAPIMessage => (message.message === 'action')
export const isLinkAPIMessage = (message: EphemeraAPIMessage): message is LinkAPIMessage => (message.message === 'link')
export const isCommandAPIMessage = (message: EphemeraAPIMessage): message is CommandAPIMessage => (message.message === 'command')

//
// TODO: Create EphemeraClientMessage types
//

export type EphemeraClientMessageEphemeraExit = {
    name: string;
    to: string;
}

export type EphemeraClientMessageEphemeraUpdateCharacterInPlayInactive = {
    type: 'CharacterInPlay';
    CharacterId: string;
    Connected: false;
}

export type EphemeraClientMessageEphemeraUpdateCharacterInPlayActive = {
    type: 'CharacterInPlay';
    CharacterId: string;
    Connected: true;
    RoomId: string;
    Name: string;
    fileURL?: string;
    Color: LegalCharacterColor;
}

export type EphemeraClientMessageEphemeraUpdateCharacterInPlay = EphemeraClientMessageEphemeraUpdateCharacterInPlayInactive | EphemeraClientMessageEphemeraUpdateCharacterInPlayActive

export type EphemeraClientMessageEphemeraUpdateMapItemInactive = {
    type: 'MapUpdate';
    MapId: string;
    active: false;
}

export type EphemeraClientMessageEphemeraUpdateMapItemActive = {
    type: 'MapUpdate';
    MapId: string;
    active: true;
    Name: string;
    fileURL?: string;
    rooms: {
        roomId: string;
        name: string;
        x: number;
        y: number;
        exits: EphemeraClientMessageEphemeraExit[];
    }[]
}

export type EphemeraClientMessageEphemeraUpdateMapItem = EphemeraClientMessageEphemeraUpdateMapItemInactive | EphemeraClientMessageEphemeraUpdateMapItemActive

export type EphemeraClientMessageEphemeraUpdateItem = EphemeraClientMessageEphemeraUpdateCharacterInPlay | EphemeraClientMessageEphemeraUpdateMapItem

export type EphemeraClientMessageEphemeraUpdate = {
    messageType: 'Ephemera';
    RequestId?: string;
    updates: EphemeraClientMessageEphemeraUpdateItem[];
}

export type EphemeraClientMessagePublishMessages = {
    messageType: 'Messages';
    messages: Message[];
}

export type EphemeraClientMessageReturnValue = {
    statusCode: 200;
    body: string;
}

export type EphemeraClientMessage = EphemeraClientMessageEphemeraUpdate |
    EphemeraClientMessageReturnValue |
    EphemeraClientMessagePublishMessages
