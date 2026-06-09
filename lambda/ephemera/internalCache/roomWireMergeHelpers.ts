/**
 * Shared room WML merge helpers for render-path composition (ComponentRender, GenerationContext).
 * Not used for affordance terminal deliverables (see affordanceRoomDeliverable.ts).
 */
import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { ExitFacetList } from '@tonylb/mtw-wml/ts/standardize/keys/facets/exit'
import { StandardCharacterData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/character'
import { RoomCharacterListItem } from './baseClasses'

export function mergeRoomExitsToJSON(assetData: StandardRoom[]) {
    const allExitFacets = assetData.map((asset) => asset.exits.items || []).flat(1)
    return new ExitFacetList(allExitFacets).toJSON()
}

export function mergeRoomShortNameLiteral(assetData: StandardRoom[]): StandardLiteral | undefined {
    return assetData
        .map((component) => component.shortName)
        .filter(excludeUndefined)
        .reduce<StandardLiteral | undefined>(
            (previous, current: StandardLiteral) => (previous ? previous.merge(current) : current),
            undefined
        )
}

export function roomCharacterListToStandardCharacterData(
    roomCharacterList: RoomCharacterListItem[]
): StandardCharacterData[] {
    return roomCharacterList.map((char) => ({
        tag: 'Character' as const,
        universalKey: char.EphemeraId,
        displayName: char.DisplayName ?? undefined,
        image: char.fileURL
            ? {
                  data: { tag: 'Image' as const, key: '', fileURL: char.fileURL },
                  children: [],
              }
            : undefined,
    }))
}
