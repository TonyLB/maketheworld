export const getLastMessageSync = async () => ('567')

export const syncAction = ({ CharacterId, LastMessageSync }) => async (dispatch) => {
    dispatch({
        type: 'TEST_MESSAGE_SYNC',
        payload: {
            CharacterId,
            LastMessageSync
        }
    })
}
