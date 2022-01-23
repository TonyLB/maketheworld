// Import required AWS SDK clients and commands for Node.js
import AWSXRay from 'aws-xray-sdk'

import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"

import compileCode from './compileCode.js'

const params = { region: process.env.AWS_REGION }
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

export const renderItem = async ({ assets, EphemeraId }, subsegment) => {
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

export const render = async ({ assets, EphemeraId }, subsegment) => {
    const [objectType, objectKey] = splitType(EphemeraId)
    switch(objectType) {
        case 'ROOM':
            const { render: Description, name: Name, exits, characters } = await renderItem({ assets, EphemeraId }, subsegment)
            const Message = {
                RoomId: objectKey,
                //
                // TODO:  Replace Ancestry with a new map system
                //
                Ancestry: '',
                Characters: characters.map(({ EphemeraId, ConnectionId, ...rest }) => ({ CharacterId: stripType(EphemeraId), ...rest })),
                Description,
                Name,
                Exits: exits.map(({ to, name }) => ({ RoomId: to, Name: name, Visibility: 'Public' }))
            }
            return Message
        default:
            return null        
    }
}

