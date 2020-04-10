export const CONNECTION_REGISTER = 'CONNECTION_REGISTER'

export const connectionRegister = ({ connectionId, characterId, roomId }) => ({
    type: CONNECTION_REGISTER,
    payload: {
        connectionId,
        characterId,
        roomId
    }
})
