const { QueryCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb')
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const permanentsTable = `${TABLE_PREFIX}_permanents`

const splitType = (value) => {
    const sections = value.split('#')
    if (sections.length) {
        return [sections[0], sections.slice(1).join('#')]
    }
    else {
        return ['', '']
    }
}

const getCurrentRoom = async (dbClient, CharacterId) => {
    const { Item } = await dbClient.send(new GetItemCommand({
        TableName: ephemeraTable,
        Key: marshall({
            EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
            DataCategory: 'Connection'
        }),
        ProjectionExpression: 'RoomId'
    }))
    const { RoomId } = (Item && unmarshall(Item)) || {}
    if (RoomId) {
        const { Items = [] } = await dbClient.send(new QueryCommand({
            TableName: ephemeraTable,
            KeyConditionExpression: "EphemeraId = :Room",
            ExpressionAttributeValues: marshall({
                ":Room": `ROOM#${RoomId}`
            }),
            ProjectionExpression: "DataCategory, exits, activeCharacters"
        }))
        console.log(`Items: ${JSON.stringify(Items, null, 4)}`)
        const { exits, characters } = (Items
            .map(unmarshall)
            .reduce((previous, { DataCategory, ...rest }) => {
                if (DataCategory === 'Meta::Room') {
                    return {
                        ...previous,
                        characters: Object.values(rest.activeCharacters || {})
                    }
                }
                const [tag, value] = splitType(DataCategory)
                if (tag === 'ASSET') {
                    //
                    // TODO: Look up what assets the character has a view of, and
                    // limit whether or not to include exits here.  Also, evaluate
                    // the conditions on each incoming exit, to make sure that
                    // they are valid before including.
                    //
                    console.log(`Asset data: ${JSON.stringify(rest, null, 4)}`)
                    return {
                        ...previous,
                        exits: rest.exits
                            .map(({ exits }) => (exits))
                            .reduce((accumulate, exits) => ([...accumulate, ...exits]), previous.exits)
                    }
                }
            }, { exits: [], characters: [] }))
        return { roomId: RoomId, exits, characters }
    }
    else {
        return { roomId: null, exits: [], characters: [] }
    }
}

const parseCommand = async ({
    dbClient,
    CharacterId,
    command
}) => {
    //
    // TODO: Build ControlChannel functions to parse free text entries looking for actions of
    // looking at characters, looking at the room, and traversing exits.  Replace the front-end
    // parsing with a round-trip call to the back-end parser.
    //

    const { roomId, exits, characters } = await getCurrentRoom(dbClient, CharacterId)
    if (command.match(/^\s*(?:look|l)\s*$/gi)) {
        return { actionType: 'look', payload: { CharacterId, PermanentId: `ROOM#${roomId}` } }
    }
    if (command.match(/^\s*home\s*$/gi)) {
        return { actionType: 'home', payload: { CharacterId } }
    }
    const lookMatch = (/^\s*(?:look|l)(?:\s+at)?\s+(.*)$/gi).exec(command)
    if (lookMatch) {
        const object = lookMatch.slice(1)[0].toLowerCase().trim()
        const characterMatch = characters.find(({ Name }) => (Name.toLowerCase() === object))
        if (characterMatch) {
            //
            // TODO:  Build a perception function for looking at characters, and route to it here.
            //
            return {}
        }
    }
    //
    // TODO: Add syntax for exit aliases, and expand the match here to include them
    //
    const matchedExit = exits.find(({ name }) => ( command.toLowerCase().trim() === name.toLowerCase() || command.toLowerCase().trim() === `go ${name.toLowerCase()}`))
    if (matchedExit) {
        return { actionType: 'move', payload: { CharacterId, ExitName: matchedExit.name, RoomId: splitType(matchedExit.to)[1] } }
    }
    return {}
}

exports.parseCommand = parseCommand
