import { PayloadAction } from '@reduxjs/toolkit'
import { LibraryPublic } from './baseClasses'

export const receiveLibrary = (state: LibraryPublic, action: PayloadAction<LibraryPublic>) => {
    const { Assets, Characters } = action.payload
    state.Assets = Assets
    state.Characters = Characters
}

export default receiveLibrary
