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
    startingAt: number;
    limit?: number;
}

export type EphemeraAPIMessage = { RequestId?: string } & (
    RegisterCharacterAPIMessage |
    FetchEphemeraAPIMessage |
    FetchImportDefaultsAPIMessage |
    WhoAmIAPIMessage |
    SyncAPIMessage
)

export const isRegisterCharacterAPIMessage = (message: EphemeraAPIMessage): message is RegisterCharacterAPIMessage => (message.message === 'registercharacter')
export const isFetchEphemeraAPIMessage = (message: EphemeraAPIMessage): message is FetchEphemeraAPIMessage => (message.message === 'fetchEphemera')
export const isFetchImportDefaultsAPIMessage = (message: EphemeraAPIMessage): message is FetchImportDefaultsAPIMessage => (message.message === 'fetchImportDefaults')
export const isWhoAmIAPIMessage = (message: EphemeraAPIMessage): message is WhoAmIAPIMessage => (message.message === 'whoAmI')
export const isSyncAPIMessage = (message: EphemeraAPIMessage): message is SyncAPIMessage => (message.message === 'sync')
