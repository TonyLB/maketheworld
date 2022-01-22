import { PayloadAction } from '@reduxjs/toolkit'
import { PlayerPublic } from './baseClasses'

//
// TODO: Figure out what type-constraint the lifeline will provide for an incoming
// Player update, and import that constraint in order to create a public reducer for
// the Player subscription
//

export const receivePlayer = (state: PlayerPublic, action: PayloadAction<PlayerPublic>) => {
    const { PlayerName, CodeOfConductConsent, Characters } = action.payload
    state.PlayerName = PlayerName
    state.CodeOfConductConsent = CodeOfConductConsent
    state.Characters = Characters
}

export default receivePlayer
