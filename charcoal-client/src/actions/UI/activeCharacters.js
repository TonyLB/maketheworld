import { getActiveCharacterState } from '../../selectors/UI/activeCharacters'

export const ACTIVATE_CHARACTER = 'ACTIVATE_CHARACTER'
export const DEACTIVATE_CHARACTER = 'DEACTIVATE_CHARACTER'
export const ACTIVE_CHARACTER_SUBSCRIBE_ATTEMPT = 'ACTIVE_CHARACTER_SUBSCRIBE_ATTEMPT'
export const ACTIVE_CHARACTER_SUBSCRIBE_SUCCESS = 'ACTIVE_CHARACTER_SUBSCRIBE_SUCCESS'
export const ACTIVE_CHARACTER_SUBSCRIBE_FAIL = 'ACTIVE_CHARACTER_SUBSCRIBE_FAIL'
export const ACTIVE_CHARACTER_CONNECT_ATTEMPT = 'ACTIVE_CHARACTER_CONNECT_ATTEMPT'
export const ACTIVE_CHARACTER_CONNECT_SUCCESS = 'ACTIVE_CHARACTER_CONNECT_SUCCESS'
export const ACTIVE_CHARACTER_CONNECT_FAIL = 'ACTIVE_CHARACTER_CONNECT_FAIL'
export const ACTIVE_CHARACTER_RECONNECT_ATTEMPT = 'ACTIVE_CHARACTER_RECONNECT_ATTEMPT'

export const ACTIVE_CHARACTER_FSM_INVALID = 'FSM_INVALID'
export const ACTIVE_CHARACTER_FSM_INITIAL = 'FSM_INITIAL'
export const ACTIVE_CHARACTER_FSM_SUBSCRIBING = 'FSM_SUBSCRIBING'
export const ACTIVE_CHARACTER_FSM_SUBSCRIBED = 'FSM_SUBSCRIBED'
export const ACTIVE_CHARACTER_FSM_CONNECTING = 'FSM_CONNECTING'
export const ACTIVE_CHARACTER_FSM_CONNECTED = 'FSM_CONNECTED'
export const ACTIVE_CHARACTER_FSM_RECONNECTING = 'FSM_RECONNECTING'

export const activateCharacter = (CharacterId) => ({ type: ACTIVATE_CHARACTER, CharacterId })

export const deactivateCharacter = (CharacterId) => ({ type: DEACTIVATE_CHARACTER, CharacterId })

//
// Finite State Machine
//
// Each entry in the activeCharacters object is paralleled in this functionality by an FSM
// of the following structure
//
//                                +---------+           +-----------------+
//                                | INITIAL |<----------| SUBSCRIBE ERROR |
//                                +---------+           +-----------------+
//                                     |                          ^
//                                     V                          |
//                              +-------------+                   |
//                              | SUBSCRIBING |-------------------+
//                              +-------------+
//                                     |
//                                     V
//                               +------------+             +---------------+
//              +--------------->| SUBSCRIBED |<------------| CONNECT ERROR |
//              |                +------------+             +---------------+
//              |                      |                             ^
//              |                      V                             |
//              |                +------------+                      |
//              |                | CONNECTING |----------------------+
//              |                +------------+                      |
//              |                      |                             |
//              |                      V                             |
//              |                +-----------+               +--------------+
//              |                |           |-------------->|              |
//              +----------------| CONNECTED |               | RECONNECTING |
//                               |           |<--------------|              |
//                               +-----------+               +--------------+
//
// In any state other than INITIAL, the subscribe dispatch action should result in a no-op.
// In any state other than SUBSCRIBED, the connect dispatch action should result in a no-op.
//

//
// subscribeToMessages(CharacterId) will return an action that kicks of an attempt
// to subscribe to character messages from the back-end.  It is only valid in INITIAL
// state of the FSM.
//
export const subscribeToMessages = (CharacterId) => (dispatch, getState) => {
    const state = getState()
    const fsmState = getActiveCharacterState(CharacterId)(state)
    if (fsmState === ACTIVE_CHARACTER_FSM_INITIAL) {
        dispatch({
            type: ACTIVE_CHARACTER_SUBSCRIBE_ATTEMPT,
            CharacterId
        })
    }
}