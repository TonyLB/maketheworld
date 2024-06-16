import { PayloadAction } from '@reduxjs/toolkit'
import { PlayerPublic } from './baseClasses'

//
// TODO: Figure out what type-constraint the lifeline will provide for an incoming
// Player update, and import that constraint in order to create a public reducer for
// the Player subscription
//

export const receivePlayer = (state: PlayerPublic, action: PayloadAction<PlayerPublic>) => {
    const { PlayerName, CodeOfConductConsent, Assets, Characters, Settings, SessionId } = action.payload
    state.PlayerName = PlayerName
    if (CodeOfConductConsent !== undefined) {
        state.CodeOfConductConsent = CodeOfConductConsent
    }
    state.Assets = Assets
    state.Characters = Characters
    state.Settings = Settings
    state.SessionId = SessionId
}

export default receivePlayer
