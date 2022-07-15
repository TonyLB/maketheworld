import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { render } from '@tonylb/mtw-utilities/dist/perception'
// import messageBus from '../messageBus'
import { EphemeraUpdateEntry, FetchPlayerEphemeraMessage, MessageBus } from '../messageBus/baseClasses'
import internalCache from '../internalCache'

type EphemeraQueryResult = {
    EphemeraId: string;
} & Omit<EphemeraUpdateEntry, 'CharacterId' | 'type'>

const serialize = ({
    EphemeraId,
    Connected,
    RoomId,
    Name,
    fileURL
}: EphemeraQueryResult): EphemeraUpdateEntry | undefined => {
    const [type, payload] = splitType(EphemeraId)
    switch(type) {
        case 'CHARACTERINPLAY':
            return {
                type: 'CharacterInPlay',
                CharacterId: payload,
                Connected,
                RoomId,
                Name,
                fileURL
            }
        //
        // TODO:  More serializers for more data types!
        //
        default:
            return undefined
    }
}

export const fetchPlayerEphemera = async ({ payloads, messageBus }: { payloads: FetchPlayerEphemeraMessage[], messageBus: MessageBus }): Promise<void> => {
    if (payloads.length > 0) {
        const Items = await ephemeraDB.query<EphemeraQueryResult[]>({
            IndexName: 'DataCategoryIndex',
            DataCategory: 'Meta::Character',
            KeyConditionExpression: 'begins_with(EphemeraId, :EphemeraPrefix)',
            ExpressionAttributeValues: {
                ':EphemeraPrefix': 'CHARACTERINPLAY#'
            },
            ExpressionAttributeNames: {
                '#name': 'Name'
            },
            ProjectionFields: ['EphemeraId', 'Connected', 'RoomId', '#name', 'fileURL']
        })
        const returnItems = Items
            .map(serialize)
            .filter((value): value is EphemeraUpdateEntry => (!!value))
            .filter(({ Connected }) => (Connected))
    
        messageBus.send({
            type: 'EphemeraUpdate',
            updates: returnItems
        })
    }
}


export const fetchEphemeraForCharacter = async ({
    CharacterId
}) => {
    const RequestId = (await internalCache.get({
        category: 'Global',
        key: 'RequestId'
    })) || ''

    const [
        { assets: characterAssets = [] } = {},
        { assets: globalAssets = [] } = {}
    ] = await Promise.all([
        ephemeraDB.getItem({
            EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
            DataCategory: 'Meta::Character',
            ProjectionFields: ['assets']
        }),
        ephemeraDB.getItem({
            EphemeraId: 'Global',
            DataCategory: 'Assets',
            ProjectionFields: ['assets']
        })
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
