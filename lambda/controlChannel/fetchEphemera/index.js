import { splitType, RoomKey } from '/opt/utilities/types.js'
import { ephemeraDB } from '/opt/utilities/dynamoDB/index.js'
import { render } from '/opt/utilities/perception/index.js'

const serialize = ({
    EphemeraId,
    Connected,
    RoomId,
    Name,
    fileURL
}) => {
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
            return null
    }
}

export const fetchEphemera = async (RequestId) => {
    const Items = await ephemeraDB.query({
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
        .filter((value) => value)
        .filter(({ Connected }) => (Connected))

    return {
        messageType: 'Ephemera',
        RequestId,
        updates: returnItems
    }
}

export const fetchEphemeraForCharacter = async ({
    RequestId,
    CharacterId
}) => {
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

export default fetchEphemera
