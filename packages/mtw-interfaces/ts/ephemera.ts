export type RegisterCharacterAPIMessage = {
    message: 'registercharacter';
    CharacterId: string;
}

export type EphemeraAPIMessage = { RequestId?: string } & (
    RegisterCharacterAPIMessage
)

export const isRegisterCharacterAPIMessage = (message: EphemeraAPIMessage): message is RegisterCharacterAPIMessage => (message.message === 'registercharacter')
