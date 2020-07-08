import { API, graphqlOperation } from 'aws-amplify'
import { updatePermanents } from '../graphql/mutations'

import { closeAdminDialog } from './UI/adminDialog'

export const putSettingsAndCloseAdminDialog = ({ ChatPrompt }) => (dispatch) => {
    return API.graphql(graphqlOperation(updatePermanents, { Updates: [ { putSettings: { ChatPrompt } }]}))
    .then(() => dispatch(closeAdminDialog()))
    .catch((err) => { console.log(err)})
}
