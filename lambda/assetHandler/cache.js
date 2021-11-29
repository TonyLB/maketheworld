const { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand } = require("@aws-sdk/client-dynamodb")
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3")

const { wmlGrammar, dbEntries, validatedSchema } = require('./wml')
const { mergeIntoDataRange } = require('./utilities/dynamoDB')
const { streamToString } = require('./utilities/stream')

const params = { region: process.env.AWS_REGION }
const { TABLE_PREFIX, S3_BUCKET } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const permanentsTable = `${TABLE_PREFIX}_permanents`

//
// TODO: Step 5
//
// Create functionality inside the descriptionService to
// use the denormalized ephemera info in creating a
// description
//

//
// TODO: Step 6
//
// Consider how to handle the various cases of change,
// in relation to the characters possibly occupying the rooms
//

const fetchAssetMetaData = async (dbClient, assetId) => {
    const { Item } = await dbClient.send(new GetItemCommand({
        TableName: permanentsTable,
        Key: marshall({
            PermanentId: `ASSET#${assetId}`,
            DataCategory: 'Details'
        }),
        ProjectionExpression: 'fileName'
    }))
    return (Item && unmarshall(Item).fileName) || ''
}

const parseWMLFile = async (fileName) => {
    const s3Client = new S3Client(params)
    const { Body: contentStream } = await s3Client.send(new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: fileName
    }))
    const contents = await streamToString(contentStream)
    //
    // TODO: Error-handling in case the files have become corrupt
    //
    const match = wmlGrammar.match(contents)
    const schema = validatedSchema(match)
    return Object.entries(dbEntries(schema)).map(([key, rest]) => ({ key, ...rest }))

}

//
// At current levels of functionality, it is sufficient to do a deep-equality
// check.
//
const compareEntries = (current, incoming) => {
    return JSON.stringify(current) === JSON.stringify(incoming)
}

const pushMetaData = async (dbClient, assetId) => {
    await dbClient.send(new PutItemCommand({
        TableName: ephemeraTable,
        Item: marshall({
            EphemeraId: `ASSET#${assetId}`,
            DataCategory: 'Details'
        })
    }))
}

const globalizeDBEntries = async (dbClient, assetId, dbEntriesList) => {
    //
    // Pull scope-to-uuid mapping from Permanents and pre-map incoming records
    //
    const { Items = [] } = await dbClient.send(new QueryCommand({
        TableName: permanentsTable,
        IndexName: 'DataCategoryIndex',
        KeyConditionExpression: "DataCategory = :dc",
        ExpressionAttributeValues: marshall({
            ":dc": `ASSET#${assetId}`
        }),
        ProjectionExpression: 'PermanentId, scopedId'
    }))
    //
    // Derive all existing scope-to-uuid mappings from stored data
    //
    const currentScopedToPermanentMapping = Items
        .map(unmarshall)
        .reduce((previous, { scopedId, PermanentId }) => ({
            ...previous,
            ...(scopedId ? { [scopedId]: PermanentId } : {})
        }), {})
    //
    // Add any incoming entries that have not yet been mapped
    //
    const scopedToPermanentMapping = dbEntriesList
        .reduce((previous, { key, isGlobal }) => {
            const newEphemeraId = isGlobal
                ? `ROOM#${key}`
                : previous[key] || `ROOM#${uuidv4()}`
            return {
                ...previous,
                [key]: newEphemeraId
            }
        }, currentScopedToPermanentMapping)
    const globalizedDBEntries = dbEntriesList
        .map(({ key, isGlobal, exits, ...rest }) => ({
            EphemeraId: scopedToPermanentMapping[key],
            exits: exits.map(({ exits, ...rest }) => {
                    const remapped = exits
                        .map(({ to, ...other }) => ({ to: scopedToPermanentMapping[to], ...other }))
                        .filter(({ to }) => (to))
                    return {
                        exits: remapped,
                        ...rest
                    }
                })
                .filter(({ exits }) => (exits.length > 0)),
            ...rest
        }))
        .filter(({ EphemeraId }) => (EphemeraId))
    return globalizedDBEntries
}

const mergeEntries = async (dbClient, assetId, dbEntriesList) => {
    await Promise.all([
        pushMetaData(dbClient, assetId),
        mergeIntoDataRange({
            dbClient,
            table: 'ephemera',
            search: { DataCategory: `ASSET#${assetId}` },
            items: dbEntriesList,
            mergeFunction: ({ current, incoming }) => {
                if (!incoming) {
                    return 'delete'
                }
                if (!current) {
                    return incoming
                }
                if (compareEntries(current, incoming)) {
                    return 'ignore'
                }
                else {
                    return incoming
                }
            }
        })
    ])
}

const cacheAsset = async (assetId) => {
    const dbClient = new DynamoDBClient(params)
    const fileName = await fetchAssetMetaData(dbClient, assetId)
    const dbEntriesList = await parseWMLFile(fileName)
    const globalEntries = await globalizeDBEntries(dbClient, assetId, dbEntriesList)
    await mergeEntries(dbClient, assetId, globalEntries)
}

exports.cacheAsset = cacheAsset