// Import required AWS SDK clients and commands for Node.js
const AWSXRay = require('aws-xray-sdk')

const { DynamoDBClient, QueryCommand, BatchGetItemCommand } = require("@aws-sdk/client-dynamodb")
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda')
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")
const { v4: uuid } = require("uuid")

const params = { region: process.env.AWS_REGION }
const PermanentTableName = `${process.env.TABLE_PREFIX}_permanents`
const EphemeraTableName = `${process.env.TABLE_PREFIX}_ephemera`

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

    const { CreatedTime, CharacterId, PermanentId } = event

    if (CreatedTime && CharacterId && PermanentId) {
        return AWSXRay.captureAsyncFunc('publish', async (subsegment) => {
            const returnVal = await publishMessage(event, subsegment)
            subsegment.close()
            return returnVal
        })
    }
    else {
        context.fail(JSON.stringify(`Error: Unknown format ${event}`))
    }

}
