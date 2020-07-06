import { API, graphqlOperation } from 'aws-amplify'
import { getSettings } from '../graphql/queries'
import { updatePermanents } from '../graphql/mutations'

import { closeAdminDialog } from './UI/adminDialog'

export const SETTINGS_UPDATE = 'SETTINGS_UPDATE'

export const settingsUpdate = (settingsData) => ({
    type: SETTINGS_UPDATE,
    data: settingsData
})

export const fetchSettings = (dispatch) => {
    return API.graphql(graphqlOperation(getSettings))
        .then(({ data }) => (data || {}))
        .then(({ getSettings }) => (getSettings || []))
        .then(response => dispatch(settingsUpdate(response)))
        .catch((err) => { console.log(err)})
}

export const putSettingsAndCloseAdminDialog = ({ ChatPrompt }) => (dispatch) => {
    return API.graphql(graphqlOperation(updatePermanents, { Updates: [ { putSettings: { ChatPrompt } }]}))
    .then(() => dispatch(closeAdminDialog()))
    .catch((err) => { console.log(err)})
}
