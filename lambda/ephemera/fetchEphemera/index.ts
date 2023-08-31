import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { FetchPlayerEphemeraMessage, MessageBus } from '../messageBus/baseClasses'
import internalCache from '../internalCache'
import { CharacterMetaItem } from '../internalCache/characterMeta'
import { isEphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { EphemeraClientMessageEphemeraUpdateItem } from '@tonylb/mtw-interfaces/dist/ephemera'

const serialize = ({
    EphemeraId,
    RoomId,
    Name,
    fileURL,
    Color
}: CharacterMetaItem): EphemeraClientMessageEphemeraUpdateItem => {
    return {
        type: 'CharacterInPlay',
        CharacterId: EphemeraId,
        Connected: true,
        RoomId,
        Name,
        fileURL: fileURL || '',
        Color: Color || 'grey'
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
        const [Items, connectionId] = await Promise.all([
            Promise.all(
                connectedCharacters
                    .map(({ ConnectionId }) => (ConnectionId))
                    .filter(isEphemeraCharacterId)
                    .map((value) => (internalCache.CharacterMeta.get(value)))
            ),
            internalCache.Global.get("ConnectionId")
        ])
        const returnItems = Items
            .map(serialize)

        messageBus.send({
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
