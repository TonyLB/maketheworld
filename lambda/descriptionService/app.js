// Import required AWS SDK clients and commands for Node.js
const AWSXRay = require('aws-xray-sdk')

const { DynamoDBClient, QueryCommand, BatchGetItemCommand } = require("@aws-sdk/client-dynamodb")
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda')
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")
const { v4: uuid } = require("uuid")

const params = { region: process.env.AWS_REGION }
const PermanentTableName = `${process.env.TABLE_PREFIX}_permanents`
const EphemeraTableName = `${process.env.TABLE_PREFIX}_ephemera`

const { wmlGrammar } = require('./wml')

const splitType = (value) => {
    const sections = value.split('#')
    if (sections.length) {
        return [sections[0], sections.slice(1).join('#')]
    }
    else {
        return ['', '']
    }
}

const stripType = (value) => value.split('#').slice(1).join('#')

//
// TODO: Create a data-structure for Version-View
//
// TODO: Decide whether to recalculate Version-View reactively, or denormalize its calculation into
//       an always-updated variable on the character.
// DENORMALIZED OPTION:
//    * Recalculation would be caused by:
//      - Activation of a Scene or Adventure
//      - Deactivation of a Scene or Adventure
//      - Addition of a Room to the character's default personal Version or draft version in Preview
//      - Activation of Preview-Mode on a character draft Version
//      - Deactivation of Preview-Mode on a character draft version
//      - ?? Addition/removal of a Room from a Scene or Adventure in progress ??
//
// DENORMALIZATION FIRST ITERATION:
//    * Only global Scenes/Adventures ... denormalize only on activate/deactivate
//
// COMPROMISE:
//    * Denormalize not the Version-View, but rather then current Version of the RoomId the character
//      is currently inhabiting.  Recalculate on any of the Denormalize options above, or on movement.
//    * Still recalculate the Version-View reactively, when needed
//    * This allows you to calculate a Rooms-Effected x Character-Effected differential when one of
//      the denormalizing events up above fires, and then limit your recalculation to those players
//      who are in a room that is effected for them
//
// NEEDED:
//    * Function to calculate Room x Character for a denormalizing action
//    * Function to calculate Version for RoomId x CharacterId (when denormalizing or when moving)
//    * Utility function to calculate Version-View hierarchy as a helper to the Room-Version-find
//    * Eventually, some way to prevent or resolve conflicting Versions (or to merge Diffs, in the most
//      sophisticated implementation)
//
// NEEDED???:
//    * A way, further, within a given version to calculate which *Layer* Room representation the
//      character is inhabiting?  Maybe too soon for that iteration (since there's no Value-Net
//      yet)
//

//
// INSTEAD OF THE ABOVE
//
// Create a world-markup-language combining XML notation with JSX-like inclusion of code,
// parsed by an Ohm-generated parser and evaluated within a context that layers
// World-state, Story-Global-State, Story-Character-State, and Character-State.
// Allow the definition of the schema of variables stored within each context in
// the WML files and keep their values updated in Ephemera.  Evaluate and execute
// code on each describe to give a custom description per character.
//


//
// TODO: Accept more types of objects, and parse their data accordingly
//
const publishMessage = async ({ CreatedTime, CharacterId, PermanentId }, subsegment) => {
    //
    // TODO:  Expand what you query from DynamoDB for the record
    //
    const ddbClient = AWSXRay.captureAWSv3Client(new DynamoDBClient(params), subsegment)
    const lambdaClient = AWSXRay.captureAWSv3Client(new LambdaClient(params), subsegment)
    const [objectType, objectKey] = splitType(PermanentId)
    switch(objectType) {
        case 'ROOM':
            //
            // TODO:  After debugging, combine two sequential awaits in a parallel Promise.all
            //
            // TODO:  Instead of having RoomItems pull from whatever table entry has the right
            // PermanentId, consider the following:
            //    * The different Versions of the relevant Room
            //    * What the character's current Version-View order is (as defined by Version
            //      inheritance, their personal Versions (need a name for that), and any Adventure
            //      or scene they are active in (whether invite-only, opt-in, or global))
            //
            const { Items: RoomItems } = await ddbClient.send(new QueryCommand({
                    TableName: PermanentTableName,
                    KeyConditionExpression: "PermanentId = :PermanentId",
                    ExpressionAttributeValues: marshall({
                        ":PermanentId": PermanentId,
                    })
                }))
            const { Items = [] } = await ddbClient.send(new QueryCommand({
                TableName: EphemeraTableName,
                KeyConditionExpression: "RoomId = :RoomId",
                FilterExpression: 'Connected = :True',
                ExpressionAttributeValues: marshall({
                    ":RoomId": stripType(PermanentId),
                    ":True": true
                }),
                ExpressionAttributeNames: {
                    '#name': 'Name'
                },
                ProjectionExpression: 'EphemeraId, #name, FirstImpression, OneCoolThing, Outfit, Pronouns',
                IndexName: 'RoomIndex'
            }))
            const CharacterItems = (Items && Items.map(unmarshall)) || []
            const aggregate = RoomItems.map(unmarshall)
                .reduce(({ Description, Name, Exits }, Item) => {
                    const dataType = Item.DataCategory.split('#')[0]
                    switch(dataType) {
                        case 'Details':
                            return {
                                Name: Item.Name,
                                Description: Item.Description,
                                Exits
                            }
                        //
                        // TODO: Remove EXIT storage at the Room level, and replace it with EXIT storage at the
                        // Map level.
                        //
                        case 'EXIT':
                            return {
                                Description,
                                Name,
                                Exits: [
                                    ...Exits,
                                    {
                                        RoomId: stripType(Item.DataCategory),
                                        Name: Item.Name,
                                        //
                                        // TODO:  Figure out how to rework maps to do away with Grant-based visibility,
                                        // and then put the proper logic here.
                                        //
                                        Visibility: 'Public'
                                    }
                                ]
                            }
                        default:
                            return { Description, Name, Exits }
                    }
                }, { Description: '', Name: '', Exits: [] })
            const Message = {
                CreatedTime,
                Targets: [`CHARACTER#${CharacterId}`],
                MessageId: uuid(),
                DisplayProtocol: "RoomDescription",
                RoomId: objectKey,
                //
                // TODO:  Replace Ancestry with a new map system
                //
                Ancestry: '',
                RoomCharacters: CharacterItems.map(({ EphemeraId, Name, FirstImpression, OneCoolThing, Outfit, Pronouns }) => ({
                    CharacterId: EphemeraId.split('#').slice(1).join('#'),
                    Name,
                    FirstImpression,
                    OneCoolThing,
                    Outfit,
                    Pronouns,
                })),
                ...aggregate
            }
            await lambdaClient.send(new InvokeCommand({
                FunctionName: process.env.MESSAGE_SERVICE,
                InvocationType: 'Event',
                Payload: new TextEncoder().encode(JSON.stringify({ Messages: [Message] }))
            }))
            return
        default:
            return
    }
}

exports.handler = async (event, context) => {

    const { CreatedTime, CharacterId, PermanentId, Evaluate, wml } = event

    if (CreatedTime && CharacterId && PermanentId) {
        return AWSXRay.captureAsyncFunc('publish', async (subsegment) => {
            const returnVal = await publishMessage(event, subsegment)
            subsegment.close()
            return returnVal
        })
    }

    if (Evaluate) {
        const match = wmlGrammar.match(wml)
        if (match.succeeded()) {
            return JSON.stringify({ evaluated: wml })
        }
        return JSON.stringify({ error: match.message })
    }
    context.fail(JSON.stringify(`Error: Unknown format ${event}`))

}
