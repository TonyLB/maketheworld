export const CONNECTION_REGISTER = 'CONNECTION_REGISTER'

export const connectionRegister = ({ connectionId }) => ({
    type: CONNECTION_REGISTER,
    payload: { connectionId }
})
