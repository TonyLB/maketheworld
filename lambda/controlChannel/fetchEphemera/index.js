import { splitType, RoomKey } from '/opt/utilities/types.js'
import { ephemeraDB } from '/opt/utilities/dynamoDB/index.js'
import { renderItems } from '../__mocks__/opt/utilities/perception'

const serialize = ({
    EphemeraId,
    Connected,
    RoomId,
    Name
}) => {
    const [type, payload] = splitType(EphemeraId)
    switch(type) {
        case 'CHARACTERINPLAY':
            return {
                type: 'CharacterInPlay',
                CharacterId: payload,
                Connected,
                RoomId,
                Name
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
        ProjectionFields: ['EphemeraId', 'Connected', 'RoomId', '#name']
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
        [ ...globalAssets, ...characterAssets ].map((asset) => (
            ephemeraDB.query({
                IndexName: 'DataCategoryIndex',
                DataCategory: `ASSET#${asset}`
            })
        ))
    )

    const allMaps = [...(new Set(
        mapQueryLists.reduce((previous, mapList) => (
            [ ...previous, ...mapList.map(({ EphemeraId }) => (EphemeraId))]
        ), [])
    ))]

    if (allMaps.length) {
        const renderOutput = await renderItems(
            allMaps.map((EphemeraId) => ({ EphemeraId, CharacterId })),
            {},
            {
                global: globalAssets,
                characters: {
                    [CharacterId]: characterAssets
                }
            }
        )
    
        return {
            type: 'Ephemera',
            RequestId,
            updates: renderOutput
        }    
    }
    return {
        type: 'Ephemera',
        RequestId,
        updates: []
    }    

}

export default fetchEphemera
