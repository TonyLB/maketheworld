const { ScanCommand } = require('@aws-sdk/client-dynamodb')
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')

const TABLE_PREFIX = process.env.TABLE_PREFIX
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

const removeType = (value) => value.split('#').slice(1).join('#')

//
// TODO: Architect a stronger system of recording messages to non-character targets
// (e.g. rooms for recap, stories for log assembly)
//
const resolveTargets = (dbClient) => async (messages) => {
    const charactersInPlay = await dbClient.send(new ScanCommand({
            TableName: ephemeraTable,
            FilterExpression: "Connected = :true",
            ExpressionAttributeValues: marshall({
                ':true': true
            }),
            ProjectionExpression: "EphemeraId, ConnectionId, RoomId"
        }))
        .then(({ Items }) => (Items.map(unmarshall)))
    const characterIdMapping = charactersInPlay.reduce((previous, { EphemeraId, RoomId, ConnectionId }) => ({ ...previous, [removeType(EphemeraId)]: { ConnectionId, RoomId } }), {})
    const resolvedMessages = messages.map(({ Targets = [], ...rest }) => {
        //
        // Translate Room targets into lists of Characters, and then deduplicate
        //
        const CharacterTargets = Targets.filter((targetId) => (characterIdMapping[targetId]))
        const RoomTargets = Object.entries(characterIdMapping).filter(([_, { RoomId }]) => (Targets.includes(RoomId))).map(([key]) => (key))
        const resolvedTargets = [...(new Set([
            ...CharacterTargets,
            ...RoomTargets
        ]))]                        
        return {
            Targets: resolvedTargets,
            ...rest
        }
    })
    const byConnectionId = resolvedMessages.reduce((previous, { Targets = [], ...rest }) => {
        return Targets.reduce((prev, Target) => {
            const ConnectionId = characterIdMapping[Target].ConnectionId
            if (ConnectionId) {
                return {
                    ...prev,
                    [ConnectionId]: [...(prev[ConnectionId] || []), { Target, ...rest }]
                }    
            }
            else {
                return prev
            }
        }, previous)
    }, {})

    return {
        resolvedMessages,
        byConnectionId
    }
}

exports.resolveTargets = resolveTargets