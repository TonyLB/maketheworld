import { splitType, RoomKey } from '/opt/utilities/types.js'
import { ephemeraDB } from '/opt/utilities/dynamoDB/index.js'

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
    //
    // TODO:  Instead of depending upon APIGateway to route the message back
    // to its own connection, maybe manually route multiple messages, so that
    // you can break a large scan into limited message-lengths.
    //
    return {
        messageType: 'Ephemera',
        RequestId,
        updates: returnItems
    }
}

export default fetchEphemera
