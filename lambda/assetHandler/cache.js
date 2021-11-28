const { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, BatchWriteItemCommand } = require("@aws-sdk/client-dynamodb")
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3")

const { wmlGrammar, dbEntries, validatedSchema } = require('./wml')
const { streamToString } = require('./utilities/stream')

const params = { region: process.env.AWS_REGION }
const { TABLE_PREFIX, S3_BUCKET } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const permanentsTable = `${TABLE_PREFIX}_permanents`

//
// TODO: Step 3
//
// A naive first-iteration that simply puts those entries
// into the ephemera table in some sensible way
//

//
// TODO: Step 4
//
// A more sophisticated second-iteration that compares
// against existing entries in the same space, and does
// the minimum delete/update/create changes needed to
// achieve the new state.
//

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

const fetchAssetMetaData = async (assetId) => {
    const dbClient = new DynamoDBClient(params)
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
    return dbEntries(schema)

}

const cacheAsset = async (assetId) => {
    const fileName = await fetchAssetMetaData(assetId)
    const dbEntries = parseWMLFile(fileName)
    return dbEntries
}

exports.cacheAsset = cacheAsset