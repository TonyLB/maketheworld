import { socketDispatch } from '../communicationsLayer/lifeLine'

import help from './help'

export const parseCommand = (CharacterId) => ({ entry, raiseError }) => (dispatch, getState) => {
    if (entry.match(/^\s*help\s*$/gi)) {
        dispatch(help())
        return true
    }

    //
    // TODO: Add more graphical mode-switching to the text entry, so that you can visually differentiate whether you're
    // saying things, or entering commands, or posing, or spoofing.  Replace prefix codes with keyboard shortcuts that
    // change the mode (as well as a Speed-Dial set of buttons for switching context)
    //
    if (entry.slice(0,1) === '"' && entry.length > 1) {
        dispatch(socketDispatch('action')({ actionType: 'say', payload: { CharacterId, Message: entry.slice(1) } }))
        return true
    }
    if (entry.slice(0,1) === '@' && entry.length > 1) {
        dispatch(socketDispatch('action')({ actionType: 'spoof', payload: { CharacterId, Message: entry.slice(1) } }))
        return true
    }
    if (entry.slice(0,1) === ':' && entry.length > 1) {
        dispatch(socketDispatch('action')({ actionType: 'pose', payload: { CharacterId, Message: entry.slice(1) } }))
        return true
    }
    if (entry) {
        dispatch(socketDispatch('command')({ CharacterId, command: entry }))
        //
        // TODO: Use raiseError to handle return errors from the back-end command parser
        //
        return true
    }
    return false
}