const splitType = (value: string) => {
    if (value) {
        const sections = value.split('#')
        if (sections.length) {
            return [sections[0], sections.slice(1).join('#')]
        }
    }
    return ['', '']
}

type EphemeraWrappedId<T extends string> = `${T}#${string}`

export type EphemeraFeatureId = EphemeraWrappedId<'FEATURE'>
export const isEphemeraFeatureId = (key: string): key is EphemeraFeatureId => (splitType(key)[0] === 'FEATURE')

export type EphemeraRoomId = EphemeraWrappedId<'ROOM'>
export const isEphemeraRoomId = (key: string): key is EphemeraRoomId => (splitType(key)[0] === 'ROOM')

export type EphemeraMapId = EphemeraWrappedId<'MAP'>
export const isEphemeraMapId = (key: string): key is EphemeraMapId => (splitType(key)[0] === 'MAP')

export type EphemeraCharacterId = EphemeraWrappedId<'CHARACTER'>
export const isEphemeraCharacterId = (key: string): key is EphemeraCharacterId => (splitType(key)[0] === 'CHARACTER')

export type EphemeraActionId = EphemeraWrappedId<'ACTION'>
export const isEphemeraActionId = (key: string): key is EphemeraActionId => (splitType(key)[0] === 'ACTION')

export type EphemeraVariableId = EphemeraWrappedId<'VARIABLE'>
export const isEphemeraVariableId = (key: string): key is EphemeraVariableId => (splitType(key)[0] === 'VARIABLE')

export type EphemeraComputedId = EphemeraWrappedId<'COMPUTED'>
export const isEphemeraComputedId = (key: string): key is EphemeraComputedId => (splitType(key)[0] === 'COMPUTED')

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
        CharacterId: string;
        EphemeraId: string;
    }
}

type ActionAPICommunicationMetaMessage = {
    payload: {
        CharacterId: string;
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
        CharacterId: string;
        RoomId: string;
        ExitName?: string;
    }
}

type ActionAPIHomeMessage = {
    actionType: 'home';
    payload: {
        CharacterId: string;
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
    CharacterId: string;
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
