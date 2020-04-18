import { API, graphqlOperation } from 'aws-amplify'

import { sendMessage } from '../messages'

import { getCurrentName, getCurrentRoomId } from '../../selectors/connection'
import { getMyCurrentCharacter } from '../../selectors/myCharacters'

import { activateConfirmDialog } from '../UI/confirmDialog'

export const announce = () => (dispatch, getState) => {
    const state = getState()
    const { connection } = state
    const currentCharacter = getMyCurrentCharacter()(state)
    if (connection.characterId) {
        const currentName = getCurrentName(state)
        const currentRoomId = getCurrentRoomId(state)
        dispatch(activateConfirmDialog({
            title: `Announcement from ${currentName} at ???`,
            content: `Are you sure you want to post this announcement?`,
            resolveButtonTitle: 'Announce!',
            resolve: () => {
                console.log('Announce!')
            }
        }))
    }    
}

export default announce