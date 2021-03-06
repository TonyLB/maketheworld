export const fetchCachedMessages = (CharacterId) => (dispatch) => {
    dispatch({
        type: 'TEST_FETCH_CACHE',
        payload: CharacterId
    })
}