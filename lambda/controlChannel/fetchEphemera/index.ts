import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { connectionDB, ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { render } from '@tonylb/mtw-utilities/dist/perception'
import { EphemeraUpdateEntry, FetchPlayerEphemeraMessage, MessageBus } from '../messageBus/baseClasses'
import internalCache from '../internalCache'
import { CharacterMetaItem } from '../internalCache/characterMeta'

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
                .map(({ ConnectionId }) => (splitType(ConnectionId)[1]))
                .map(internalCache.CharacterMeta.get)
        )
        const returnItems = Items
            .map(serialize)

        messageBus.send({
            type: 'EphemeraUpdate',
            updates: returnItems
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
        ephemeraDB.getItem({
            EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
            DataCategory: 'Meta::Character',
            ProjectionFields: ['assets']
        }),
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
        mapQueryLists.reduce((previous, mapList) => (
            [ ...previous, ...mapList.map(({ EphemeraId }) => (EphemeraId))]
        ), [])
    ))]

    if (allMaps.length) {
        const renderOutput = await render({
            renderList: allMaps.map((EphemeraId) => ({ EphemeraId, CharacterId })),
            assetLists: {
                global: globalAssets,
                characters: {
                    [CharacterId]: characterAssets
                }
            }
        })
    
        return {
            messageType: 'Ephemera',
            RequestId,
            updates: renderOutput
        }    
    }
    return {
        messageType: 'Ephemera',
        RequestId,
        updates: []
    }    

}

// export default fetchEphemera
