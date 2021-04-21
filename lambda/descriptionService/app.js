// Import required AWS SDK clients and commands for Node.js
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns")

// Import required AWS SDK clients and commands for Node.js
const { DynamoDB } = require("@aws-sdk/client-dynamodb")
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")
const { v4: uuid } = require("uuid")

const params = { region: process.env.AWS_REGION }
const TableName = `${process.env.TABLE_PREFIX}_permanents`

const sns = new SNSClient(params)
const dynamoDB = new DynamoDB(params)

const splitType = (value) => {
    const sections = value.split('#')
    if (sections.length) {
        return [sections[0], sections.slice(1).join('#')]
    }
    else {
        return ['', '']
    }
}

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
            const { Item } = await dynamoDB.getItem({
                TableName,
                Key: marshall({
                    PermanentId,
                    DataCategory: 'Details'
                })
            })
            const unmarshalled = unmarshall(Item)
            const Message = JSON.stringify([{
                CreatedTime,
                Characters: [CharacterId],
                MessageId: uuid(),
                DisplayProtocol: "RoomDescription",
                Description: unmarshalled.Description,
                Name: unmarshalled.Name,
                Ancestry: '',
                RoomId: objectKey,
                Exits: [],
                RoomCharacters: []
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
