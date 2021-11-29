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

const render = async ({ assets, EphemeraId }, subsegment) => {
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
            const renderOutput = RoomItems
                .map(unmarshall)
                .filter(({ DataCategory }) => (DataCategory.slice(0, 6) === 'ASSET#' && assets.includes(DataCategory.slice(6))))
                //
                // TODO: Figure out a sorting sequence less naive than alphabetical
                //
                .sort(({ DataCategory: DCA }, { DataCategory: DCB }) => (DCA.localeCompare(DCB)))
                .reduce((previous, { render }) => ([
                        ...previous,
                        ...render
                            .filter(({ conditions }) => (evaluateConditionalList(conditions)))
                            .reduce((accumulate, { render }) => ([...accumulate, ...render]), [])
                    ]), [])
                //
                // TODO: Evaluate expressions before inserting them
                //
                .join('')
            return renderOutput
            //
            // TODO: Step 2
            //
            // Caching in the memoized list, evaluate conditionals as you go through to determine
            // which elements to add to the description.
            //

            //
            // TODO: Step 3
            //
            // Aggregate values for render, name, and exits.
            //

            //
            // TODO: Step 4
            //
            // Create a rough description heading, comparable to the prior version (below)
            //

            //
            // TODO: Step 5
            //
            // Rewrite publishMessage in place, to use this new data structure.
            //

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
