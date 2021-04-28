const { ScanCommand } = require('@aws-sdk/client-dynamodb')
const { unmarshall } = require('@aws-sdk/util-dynamodb')

const TABLE_PREFIX = process.env.TABLE_PREFIX
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

const removeType = (value) => value.split('#').slice(1).join('#')

//
// TODO: Architect a stronger system of recording messages to non-character targets
// (e.g. rooms for recap, stories for log assembly)
//
const resolveTargets = (dbClient) => async (messages) => {
    //
    // TODO:  Figure out an efficient way to resolve just the queries and getItems that we
    // actually *need* to do from the ephemeraTable.
    //
    const charactersInPlay = await dbClient.send(new ScanCommand({
            TableName: ephemeraTable,
            ProjectionExpression: "EphemeraId, ConnectionId, RoomId, Connected"
        }))
        .then(({ Items }) => (Items.map(unmarshall)))
    const characterIdMapping = charactersInPlay.reduce((previous, { EphemeraId, RoomId, ConnectionId, Connected }) => ({ ...previous, [`CHARACTER#${removeType(EphemeraId)}`]: { ConnectionId, RoomId, Connected } }), {})
    const resolvedMessages = messages.map(({ Targets = [], ...rest }) => {
        //
        // Translate Room targets into lists of Characters, and then deduplicate
        //
        // TODO:  Figure out how to refactor so that non-connected characters who are EXPLICITLY added
        // to the address list still get their messages persisted (but not broadcast).  Will it be more efficient
        // if the calling procedure includes 'CHARACTER#' and 'ROOM#' prefixes?
        //
        const CharacterTargets = Targets.filter((targetId) => (characterIdMapping[targetId]))
        const RoomTargets = Object.entries(characterIdMapping)
            .filter(([_, { RoomId, Connected }]) => (Connected && Targets.includes(`ROOM#${RoomId}`))).map(([key]) => (key))
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
                    [ConnectionId]: [...(prev[ConnectionId] || []), { Target: removeType(Target), ...rest }]
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