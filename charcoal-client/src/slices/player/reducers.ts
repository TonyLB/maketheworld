import { PayloadAction } from '@reduxjs/toolkit'
import { EphemeraAssetId, EphemeraCharacterId, isEphemeraAssetId, isEphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { PlayerPublic } from './baseClasses'

export const addAsset = (state: PlayerPublic, action: PayloadAction<EphemeraAssetId | EphemeraCharacterId>) => {
    if (isEphemeraAssetId(action.payload)) {
        state.Assets.push({
            AssetId: action.payload.split('#')[1],
            Story: undefined,
            instance: undefined
        })
    }
    if (isEphemeraCharacterId(action.payload)) {
        state.Characters.push({
            CharacterId: action.payload,
            Name: ''
        })
    }
}
