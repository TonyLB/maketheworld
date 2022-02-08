// Import required AWS SDK clients and commands for Node.js
import AWSXRay from 'aws-xray-sdk'

import { DynamoDBClient, GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb"
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

export const renderItem = async ({ CharacterId, EphemeraId }, subsegment) => {
    const ddbClient = AWSXRay.captureAWSv3Client(new DynamoDBClient(params), subsegment)
    const [objectType] = splitType(EphemeraId)
    clearMemoSpace()
    switch(objectType) {
        case 'ROOM':
            const [
                    { Items: RoomItemsRaw = [] },
                    { Item: globalAssetItem = {} },
                    { Item: personalAssetItem = {} },
                ] = await Promise.all([
                ddbClient.send(new QueryCommand({
                    TableName: EphemeraTableName,
                    KeyConditionExpression: 'EphemeraId = :ephemera',
                    ExpressionAttributeValues: marshall({
                        ":ephemera": EphemeraId
                    })
                })),
                ddbClient.send(new GetItemCommand({
                    TableName: EphemeraTableName,
                    Key: marshall({
                        EphemeraId: 'Global',
                        DataCategory: 'Assets'
                    }),
                    ProjectionExpression: 'assets'
                })),
                ddbClient.send(new GetItemCommand({
                    TableName: EphemeraTableName,
                    Key: marshall({
                        EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                        DataCategory: 'Meta::Character'
                    }),
                    ProjectionExpression: 'assets'
                }))
            ])
            const RoomItems = RoomItemsRaw.map(unmarshall)
            const { assets: globalAssets = [] } = unmarshall(globalAssetItem)
            const { assets: personalAssets = [] } = unmarshall(personalAssetItem)
            const RoomMeta = RoomItems.find(({ DataCategory }) => (DataCategory === 'Meta::Room'))
            const RoomMetaByAsset = RoomItems
                .reduce((previous, { DataCategory, ...rest }) => {
                    if (DataCategory === 'Meta::Room') {
                        return previous
                    }
                    return {
                        ...previous,
                        [DataCategory]: rest
                    }
                }, {})
            const { render, name, exits } = [
                    ...globalAssets,
                    ...(personalAssets.filter((value) => (!globalAssets.includes(value))))
                ].reduce((previous, key) => {
                    if (RoomMetaByAsset[`ASSET#${key}`]) {
                        const { render, name, exits } = RoomMetaByAsset[`ASSET#${key}`]
                        return {
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
                        }
                    }
                    return previous
                }, { render: [], name: [], exits: [] })
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

export const render = async ({ CharacterId, EphemeraId }, subsegment) => {
    const [objectType, objectKey] = splitType(EphemeraId)
    switch(objectType) {
        case 'ROOM':
            const { render: Description, name: Name, exits, characters } = await renderItem({ CharacterId, EphemeraId }, subsegment)
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

