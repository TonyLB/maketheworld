import { PayloadAction } from '@reduxjs/toolkit'
import { EphemeraCharacterId, EphemeraMapId, EphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import { ActiveCharacterMap } from './baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardMap } from '@tonylb/mtw-wml/ts/standardize/components/map'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { isSchemaImage } from '@tonylb/mtw-base/ts/schema/image'
import { treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'

export type ActiveCharacterMapChange = (ActiveCharacterMap & {
    type: 'MapUpdate';
    active: true;
    targets: EphemeraCharacterId[];
}) | {
    type: 'MapUpdate';
    active: false;
    MapId: EphemeraMapId;
    targets: EphemeraCharacterId[];
}

export type ActiveCharacterChange = ActiveCharacterMapChange

const extractMapDataFromStandardForm = (standardForm: StandardForm, mapId: EphemeraMapId): Omit<ActiveCharacterMap, 'MapId'> => {
    const mapComponent = standardForm.byUniversalId[mapId]
    
    if (!mapComponent || !(mapComponent instanceof StandardMap)) {
        return {
            description: '',
            shortName: '',
            rooms: [],
            assets: {},
            fileURL: undefined
        }
    }

    // Extract display name from shortName
    const shortName = mapComponent.shortName?._payload?.plain?.toJSON() ?? ''

    // Extract rooms from positions
    const rooms = mapComponent.positions.items
        .map((facet) => {
            const roomId = facet.reference.universalKey
            if (!roomId) return undefined
            
            const roomComponent = standardForm.byUniversalId[roomId]
            if (!(roomComponent instanceof StandardRoom)) return undefined

            const position = facet.payload.plain
            if (!position) return undefined

            // Extract exits
            const exits = roomComponent.exits.items
                .map((exitFacet) => {
                    const to = exitFacet.reference.universalKey ?? ''
                    const description = exitFacet.payload.toJSON() ?? ''
                    return { description, to }
                })
                .filter((exit) => exit.to !== '')

            return {
                roomId: roomId as string,
                shortName: roomComponent.shortName?._payload?.plain?.toJSON() ?? '',
                x: position.x ?? 0,
                y: position.y ?? 0,
                exits
            }
        })
        .filter((room): room is NonNullable<typeof room> => room !== undefined)

    // Extract assets (from imports/references in the StandardForm)
    const assets: Record<EphemeraAssetId, string> = {}
    // TODO: Extract assets from StandardForm imports/references if needed
    // For now, return empty object

    // Extract fileURL from first image
    const firstImage = mapComponent.images.find((node) => treeNodeTypeguard(isSchemaImage)(node))
    const fileURL = firstImage && treeNodeTypeguard(isSchemaImage)(firstImage) 
        ? firstImage.data.key 
        : undefined

    return {
        description: '', // Keep original description for backwards compatibility if needed
        shortName,
        rooms,
        assets,
        fileURL
    }
}

export const receiveMapEphemera = (state: any, action: PayloadAction<ActiveCharacterChange>) => {
    if (action.payload.active) {
        const { MapId, description } = action.payload
        
        // Parse WML description into StandardForm
        let mapData: Omit<ActiveCharacterMap, 'MapId'>
        try {
            const standardForm = new StandardForm(description)
            mapData = extractMapDataFromStandardForm(standardForm, MapId)
        } catch (error) {
            console.warn('Failed to parse WML content for MapUpdate:', error)
            // Fallback to empty structure
            mapData = {
                description,
                shortName: '',
                rooms: [],
                assets: {},
                fileURL: undefined
            }
        }
        
        state.maps[MapId] = {
            MapId,
            ...mapData
        }    
    }
    else {
        delete state.maps[action.payload.MapId]
    }
}

export default receiveMapEphemera
