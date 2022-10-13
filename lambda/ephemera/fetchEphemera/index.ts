import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { connectionDB, ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { EphemeraUpdateEntry, FetchPlayerEphemeraMessage, MessageBus } from '../messageBus/baseClasses'
import internalCache from '../internalCache'
import { CharacterMetaItem } from '../internalCache/characterMeta'
import { EphemeraMapId, isEphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'

type EphemeraQueryResult = {
    EphemeraId: string;
} & Omit<EphemeraUpdateEntry, 'CharacterId' | 'type'>

const serialize = ({
    EphemeraId,
    RoomId,
    Name,
    fileURL,
    Color
}: CharacterMetaItem): EphemeraUpdateEntry => {
    const [type, payload] = splitType(EphemeraId)
    return {
        type: 'CharacterInPlay',
        CharacterId: payload,
        Connected: true,
        RoomId,
        Name,
        fileURL: fileURL || '',
        Color: Color || 'grey'
    }
}

export const fetchPlayerEphemera = async ({ payloads, messageBus }: { payloads: FetchPlayerEphemeraMessage[], messageBus: MessageBus }): Promise<void> => {
    if (payloads.length > 0) {
        const connectedCharacters = await connectionDB.query<{ ConnectionId: string }[]>({
            IndexName: 'DataCategoryIndex',
            DataCategory: 'Meta::Character',
            ProjectionFields: ['ConnectionId']
        })
        const Items = await Promise.all(
            connectedCharacters
                .map(({ ConnectionId }) => (ConnectionId))
                .filter(isEphemeraCharacterId)
                .map((value) => (internalCache.CharacterMeta.get(value)))
        )
        const returnItems = Items
            .map(serialize)

        messageBus.send({
            type: 'EphemeraUpdate',
            global: false,
            updates: returnItems.map((item) => ({ ...item, Connected: true })) as any
        })
    }
}


export const fetchEphemeraForCharacter = async ({
    CharacterId
}) => {
    const RequestId = (await internalCache.Global.get('RequestId')) || ''

    const [
        { assets: characterAssets = [] } = {},
        globalAssets = []
    ] = await Promise.all([
        internalCache.CharacterMeta.get(`CHARACTER#${CharacterId}`),
        internalCache.Global.get('assets')
    ])

    const mapQueryLists = await Promise.all(
        [...(new Set([ ...globalAssets, ...characterAssets ]))].map((asset) => (
            ephemeraDB.query({
                IndexName: 'DataCategoryIndex',
                DataCategory: `ASSET#${asset}`,
                KeyConditionExpression: 'begins_with(EphemeraId, :map)',
                ExpressionAttributeValues: {
                    ':map': 'MAP#'
                }
            })
        ))
    )

    const allMaps = [...(new Set(
        mapQueryLists.reduce<EphemeraMapId[]>((previous, mapList) => (
            [ ...previous, ...mapList.map(({ EphemeraId }) => (EphemeraId as EphemeraMapId))]
        ), [])
    ))]

    if (allMaps.length) {
        const renderOutput = await Promise.all(allMaps.map((mapId) => (internalCache.ComponentRender.get(`CHARACTER#${CharacterId}`, mapId))))
    
        return {
            messageType: 'Ephemera',
            RequestId,
            updates: renderOutput.map((mapDescribe) => ({
                type: 'MapUpdate',
                targets: [{ characterId: `CHARACTER#${CharacterId}` }],
                ...mapDescribe,
                MapId: splitType(mapDescribe.MapId)[1]
            }))
        }    
    }
    return {
        messageType: 'Ephemera',
        RequestId,
        updates: []
    }    

}

// export default fetchEphemera
