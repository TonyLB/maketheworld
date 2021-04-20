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

//
// TODO:  Create descriptionTopic SNS topic in Template, and assign an Endpoint to this Lambda
//
exports.handler = async (event, context) => {
    const { Records } = event

    //
    // First check for Records, to see whether this is coming from the SNS topic subscription.
    //
    if (Records) {
        const descriptions = Records.filter(({ Sns = {} }) => (Sns.Message))
            .map(({ Sns }) => (Sns.Message))
            .map((message) => (JSON.parse(message)))
            .filter(({ CreatedTime, CharacterId }) => (CreatedTime && CharacterId))
        await Promise.all(descriptions.map(description => (publishMessage(description))))
    }
    //
    // Otherwise return a format error
    //
    else {
        context.fail(JSON.stringify(`Error: Unknown format ${event}`))
    }

}
