export type RegisterCharacterAPIMessage = {
    message: 'registercharacter';
    CharacterId: string;
}

export type FetchEphemeraAPIMessage = {
    message: 'fetchEphemera';
    CharacterId?: string;
}

export type EphemeraAPIMessage = { RequestId?: string } & (
    RegisterCharacterAPIMessage |
    FetchEphemeraAPIMessage
)

export const isRegisterCharacterAPIMessage = (message: EphemeraAPIMessage): message is RegisterCharacterAPIMessage => (message.message === 'registercharacter')
export const isFetchEphemeraAPIMessage = (message: EphemeraAPIMessage): message is FetchEphemeraAPIMessage => (message.message === 'fetchEphemera')
