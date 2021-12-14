// Import required AWS SDK clients and commands for Node.js
const AWSXRay = require('aws-xray-sdk')

const { DynamoDBClient, QueryCommand, BatchWriteItemCommand } = require("@aws-sdk/client-dynamodb")
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda')
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")
const { v4: uuid } = require("uuid")

const { compileCode } = require('./compileCode')

const params = { region: process.env.AWS_REGION }
const EphemeraTableName = `${process.env.TABLE_PREFIX}_ephemera`
const MessageTableName = `${process.env.TABLE_PREFIX}_messages`

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

let memoSpace = {}
const clearMemoSpace = () => {
    memoSpace = {}
}
const memoizedEvaluate = (expression) => {
    if (memoSpace[expression]) {
        return expression
    }
    //
    // TODO: Create sandbox serialization in Ephemera, and use it to populate
    // the sandbox for evaluating code
    //

    //
    // TODO: Create set operators for the sandbox that throw an error when
    // attempting to set global variables during a pure evaluation
    //
    try {
        const outcome = compileCode(`return (${expression})`)({})
        memoSpace[expression] = outcome
        return outcome
    }
    catch(e) {
        const outcome = '{#ERROR}'
        memoSpace[expression] = outcome
        return outcome
    }
}

const evaluateConditionalList = (list = []) => {
    if (list.length > 0) {
        const [first, ...rest] = list
        if (Boolean(memoizedEvaluate(first))) {
            return evaluateConditionalList(rest)
        }
        else {
            return false
        }
    }
    return true
}

const renderItem = async ({ assets, EphemeraId }, subsegment) => {
    const ddbClient = AWSXRay.captureAWSv3Client(new DynamoDBClient(params), subsegment)
    const [objectType] = splitType(EphemeraId)
    clearMemoSpace()
    switch(objectType) {
        case 'ROOM':
            const { Items: RoomItemsRaw } = await ddbClient.send(new QueryCommand({
                TableName: EphemeraTableName,
                KeyConditionExpression: 'EphemeraId = :ephemera',
                ExpressionAttributeValues: marshall({
                    ":ephemera": EphemeraId
                })
            }))
            const RoomItems = RoomItemsRaw.map(unmarshall)
            const RoomMeta = RoomItems.find(({ DataCategory }) => (DataCategory === 'Meta::Room'))
            const { render, name, exits } = RoomItems
                .filter(({ DataCategory }) => (DataCategory.slice(0, 6) === 'ASSET#' && assets.includes(DataCategory.slice(6))))
                //
                // TODO: Figure out a sorting sequence less naive than alphabetical
                //
                .sort(({ DataCategory: DCA }, { DataCategory: DCB }) => (DCA.localeCompare(DCB)))
                .reduce((previous, { render, name, exits }) => ({
                        ...previous,
                        render: render
                            .filter(({ conditions }) => (evaluateConditionalList(conditions)))
                            .reduce((accumulate, { render }) => ([...accumulate, ...render]), previous.render),
                        name: name
                            .filter(({ conditions }) => (evaluateConditionalList(conditions)))
                            .reduce((accumulate, { name }) => ([...accumulate, ...name]), previous.name),
                        exits: exits
                            .filter(({ conditions }) => (evaluateConditionalList(conditions)))
                            .reduce((accumulate, { exits }) => ([...accumulate, ...exits.map(({ to, ...rest }) => ({ to: stripType(to), ...rest }))]), previous.exits),
                }), { render: [], name: [], exits: [] })
                //
                // TODO: Evaluate expressions before inserting them
                //
            return {
                render: render.join(''),
                name: name.join(''),
                exits,
                characters: Object.values((RoomMeta ?? {}).activeCharacters || {})
            }

            //
            // TODO: Step 10
            //
            // Restructure messagePublish lambda to take advantage of the room meta-data when
            // resolving Room targets
            //
        default:
            return null
    }
}

//
// TODO: Accept more types of objects, and parse their data accordingly
//
const publishMessage = async ({ CreatedTime, CharacterId, PermanentId, additionalMessages = [] }, subsegment) => {
    //
    // TODO:  Expand what you query from DynamoDB for the record
    //
    const ddbClient = AWSXRay.captureAWSv3Client(new DynamoDBClient(params), subsegment)
    const lambdaClient = AWSXRay.captureAWSv3Client(new LambdaClient(params), subsegment)
    const [objectType, objectKey] = splitType(PermanentId)
    switch(objectType) {
        case 'ROOM':
            //
            // TODO: Create a system to look up the assets that a given character has access to
            //
            const { render: Description, name: Name, exits, characters } = await renderItem({ assets: ['TEST'], EphemeraId: PermanentId })
            const Message = {
                CreatedTime,
                Targets: [`CHARACTER#${CharacterId}`],
                MessageId: `MESSAGE#${uuid()}`,
                DataCategory: 'Meta::Message',
                DisplayProtocol: "RoomDescription",
                RoomId: objectKey,
                //
                // TODO:  Replace Ancestry with a new map system
                //
                Ancestry: '',
                RoomCharacters: characters.map(({ EphemeraId, ...rest }) => ({ CharacterId: stripType(EphemeraId), ...rest })),
                Description,
                Name,
                Exits: exits.map(({ to, name }) => ({ RoomId: to, Name: name, Visibility: 'Public' }))
            }
            await ddbClient.send(new BatchWriteItemCommand({ RequestItems: {
                [MessageTableName]: [
                    Message,
                    ...additionalMessages
                ].map((item) => ({ PutRequest: { Item: marshall(item) }}))
            }}))
            return
        default:
            return
    }
}

exports.handler = async (event, context) => {

    const { CreatedTime, CharacterId, PermanentId } = event

    if (event.render) {
        return AWSXRay.captureAsyncFunc('render', async (subsegment) => {
            const returnVal = await render({
                EphemeraId: event.EphemeraId,
                assets: event.assets
            }, subsegment)
            subsegment.close()
            return returnVal
        })
    }
    if (CreatedTime && CharacterId && PermanentId) {
        return AWSXRay.captureAsyncFunc('publish', async (subsegment) => {
            const returnVal = await publishMessage(event, subsegment)
            subsegment.close()
            return returnVal
        })
    }

    context.fail(JSON.stringify(`Error: Unknown format ${event}`))

}
