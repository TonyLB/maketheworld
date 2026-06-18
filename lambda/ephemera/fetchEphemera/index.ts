import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { isEphemeraCharacterId, EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { FetchPlayerEphemeraMessage, MessageBus } from '../messageBus/baseClasses'
import internalCache from '../internalCache'
import { CharacterMetaItem } from '../internalCache/characterMeta'
import { EphemeraClientMessageEphemeraUpdateItem } from '@tonylb/mtw-interfaces/ts/ephemera'
import { resolveCharacterRoomId } from '../dataSource/positions/membership/resolveCharacterRoomId'

const serialize = async (
    characterMeta: CharacterMetaItem
): Promise<EphemeraClientMessageEphemeraUpdateItem> => {
    const RoomId = await resolveCharacterRoomId(characterMeta.EphemeraId)
    return {
        type: 'CharacterInPlay',
        CharacterId: characterMeta.EphemeraId,
        Connected: true,
        RoomId,
        DisplayName: characterMeta.Name,
        fileURL: characterMeta.fileURL || '',
        Color: characterMeta.Color || 'grey',
    }
}

export const fetchPlayerEphemera = async ({ payloads, messageBus }: { payloads: FetchPlayerEphemeraMessage[], messageBus: MessageBus }): Promise<void> => {
    if (payloads.length > 0) {
        const connectedCharacters = await connectionDB.query<{ ConnectionId: string; DataCategory: string }>({
            IndexName: 'DataCategoryIndex',
            Key: {
                DataCategory: 'Meta::Character'
            },
            ProjectionFields: ['ConnectionId']
        })
        const characterIds = connectedCharacters
            .map(({ ConnectionId }) => ConnectionId)
            .filter(isEphemeraCharacterId)

        const [returnItems, connectionId] = await Promise.all([
            Promise.all(
                characterIds.map(async (characterId: EphemeraCharacterId) => {
                    const characterMeta = await internalCache.CharacterMeta.get(characterId)
                    return serialize(characterMeta)
                })
            ),
            internalCache.Global.get('ConnectionId'),
        ])

        messageBus.publish({
            type: 'EphemeraUpdate',
            updates: returnItems.map((item) => ({ ...item, Connected: true, connectionTargets: [`CONNECTION#${connectionId}`] })) as any
        })
    }
}


export const fetchEphemeraForCharacter = async ({
    CharacterId
}) => {
    const RequestId = (await internalCache.Global.get('RequestId')) || ''

    return {
        messageType: 'Ephemera',
        RequestId,
        updates: []
    }    

}

// export default fetchEphemera
