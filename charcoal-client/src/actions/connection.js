export const CONNECTION_REGISTER = 'CONNECTION_REGISTER'

export const connectionRegister = ({ connectionId, characterId }) => (dispatch, getState) => {
    dispatch({
        type: CONNECTION_REGISTER,
        payload: {
            connectionId,
            characterId
        }
    })
}