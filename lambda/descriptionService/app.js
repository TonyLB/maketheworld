// Import required AWS SDK clients and commands for Node.js
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns")

// Import required AWS SDK clients and commands for Node.js
const { DynamoDBClient, QueryCommand, BatchGetItemCommand } = require("@aws-sdk/client-dynamodb")
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")
const { v4: uuid } = require("uuid")

const params = { region: process.env.AWS_REGION }
const PermanentTableName = `${process.env.TABLE_PREFIX}_permanents`
const EphemeraTableName = `${process.env.TABLE_PREFIX}_ephemera`

const sns = new SNSClient(params)
const ddbClient = new DynamoDBClient(params)

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
// TODO: Accept more types of objects, and parse their data accordingly
//
const publishMessage = async ({ CreatedTime, CharacterId, PermanentId }) => {
    //
    // TODO:  Expand what you query from DynamoDB for the record
    //
    const [objectType, objectKey] = splitType(PermanentId)
    switch(objectType) {
        case 'ROOM':
            //
            // TODO:  After debugging, combine two sequential awaits in a parallel Promise.all
            //
            const { Items: RoomItems } = await ddbClient.send(new QueryCommand({
                    TableName: PermanentTableName,
                    KeyConditionExpression: "PermanentId = :PermanentId",
                    ExpressionAttributeValues: marshall({
                        ":PermanentId": PermanentId,
                    })
                }))
            const characterResults = await ddbClient.send(new QueryCommand({
                    TableName: EphemeraTableName,
                    KeyConditionExpression: "RoomId = :RoomId",
                    FilterExpression: 'Connected = :True',
                    ExpressionAttributeValues: marshall({
                        ":RoomId": stripType(PermanentId),
                        ":True": true
                    }),
                    ProjectionExpression: 'EphemeraId',
                    IndexName: 'RoomIndex'
                })).then(({ Items }) => {
                    if (Items.length === 0) {
                        return { Items: [] }
                    }
                    const Keys = Items
                        .map(unmarshall)
                        .map(({ EphemeraId }) => (stripType(EphemeraId)))
                        .filter((value) => (value))
                        .map((CharacterId) => (marshall({
                            PermanentId: `CHARACTER#${CharacterId}`,
                            DataCategory: 'Details'
                        }))
                    )
                    //
                    // TODO:  Research whether in v3 I need a batch-splitter to deal with the 25-item maximum
                    // on batch operations.
                    //
                    return ddbClient.send(new BatchGetItemCommand({
                        RequestItems: {
                            [PermanentTableName]: {
                                Keys
                            }
                        }
                    }))
                })
            const CharacterItems = characterResults && characterResults.Responses && characterResults.Responses[PermanentTableName]
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
            const Message = JSON.stringify([{
                CreatedTime,
                Targets: [CharacterId],
                MessageId: uuid(),
                DisplayProtocol: "RoomDescription",
                RoomId: objectKey,
                //
                // TODO:  Replace Ancestry with a new map system
                //
                Ancestry: '',
                RoomCharacters: CharacterItems.map(unmarshall).map(({ PermanentId, Name, FirstImpression, OneCoolThing, Outfit, Pronouns }) => ({
                    CharacterId: PermanentId.split('#').slice(1).join('#'),
                    Name,
                    FirstImpression,
                    OneCoolThing,
                    Outfit,
                    Pronouns,
                })),
                ...aggregate
            }], null, 4)
            await sns.send(new PublishCommand({
                TopicArn: process.env.MESSAGE_TOPIC_ARN,
                Message
            }))
            return
        default:
            return
    }
}

exports.handler = async (event, context) => {
    const { CreatedTime, CharacterId, PermanentId } = event

    if (CreatedTime && CharacterId && PermanentId) {
        return publishMessage(event)
    }
    else {
        context.fail(JSON.stringify(`Error: Unknown format ${event}`))
    }

}
