// Import required AWS SDK clients and commands for Node.js
const AWSXRay = require('aws-xray-sdk')

const { DynamoDBClient, QueryCommand, BatchGetItemCommand } = require("@aws-sdk/client-dynamodb")
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda')
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")
const { v4: uuid } = require("uuid")

const { compileCode } = require('./compileCode')

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
            const { Items: RoomItems } = await ddbClient.send(new QueryCommand({
                TableName: EphemeraTableName,
                KeyConditionExpression: 'EphemeraId = :ephemera',
                ExpressionAttributeValues: marshall({
                    ":ephemera": EphemeraId
                })
            }))
            const { render, name, exits } = RoomItems
                .map(unmarshall)
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
                            .reduce((accumulate, { exits }) => ([...accumulate, ...exits]), previous.exits),
                }), { render: [], name: [], exits: [] })
                //
                // TODO: Evaluate expressions before inserting them
                //
            return {
                render: render.join(''),
                name: name.join(''),
                exits
            }
            //
            // TODO: Step 6
            //
            // Create a Meta::Room DataCategory in Ephemera to hold information about the Room:
            //    * What characters are actively present in the room (with denormalized data)
            //    * What inactive characters are present in the room
            //    * (Maybe) What Assets exist in the Asset Manager for the room (to limit the search
            //      of what Assets to cache, based on where a character is and what their access is)
            //

            //
            // TODO: Step 7
            //
            // Update Meta::Room whenever a character moves, connects, or disconnects
            //

            //
            // TODO: Step 8
            //
            // Update Meta::Room whenever a character is updated?  Or maybe we should stop hover-showing
            // that information, and instead make a perception function for looking at characters?
            //

            //
            // TODO: Step 9
            //
            // Update render to include the characters present in the room
            //
        default:
            return null
    }
}

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
            // TODO: Create a system to look up the assets that a given character has access to
            //
            const { render: Description, name: Name, exits } = await renderItem({ assets: ['TEST'], EphemeraId: PermanentId })
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
                RoomCharacters: [],
                Description,
                Name,
                Exits: exits.map(({ to, name }) => ({ RoomId: to, Name: name, Visibility: 'Public' }))
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
