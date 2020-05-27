import cacheDB from '../cacheDB'

export const UPDATE_CLIENT_SETTINGS = 'UPDATE_CLIENT_SETTINGS'

export const loadClientSettings = (dispatch) => {
    cacheDB.clientSettings.toArray()
        .then((settings) => (settings.reduce((previous, { key, value }) => ({ ...previous, [key]: value }), {})))
        .then((settingMap) => {
            dispatch({
                type: UPDATE_CLIENT_SETTINGS,
                settings: settingMap
            })
        })
}

export const putClientSettings = (settings) => (dispatch) => {
    cacheDB.clientSettings.bulkPut(Object.entries(settings).map(([key, value]) => ({ key, value })))
        .then(() => {
            dispatch({
                type: UPDATE_CLIENT_SETTINGS,
                settings
            })
        })
}
