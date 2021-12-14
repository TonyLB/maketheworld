// Import required AWS SDK clients and commands for Node.js
const { S3Client, CopyObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3")
const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb")
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")

const { cacheAsset } = require('./cache.js')
const { healAsset } = require("./selfHealing")
const { getAssets } = require("./serialize/s3Assets")
const { putTranslateFile, getTranslateFile } = require("./serialize/translateFile")
const { scopeMap } = require("./serialize/scopeMap")
const { dbRegister } = require('./serialize/dbRegister')
const { splitType } = require('./utilities/types')

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)
const dbClient = new DynamoDBClient(params)

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

//
// TODO: Step 7
//
// Create web-client route for creating/editing characters
//

//
// TODO: Step 8
//
// Create outlet in controlChannel for getting presigned upload URLs for the upload directory
// in the assets bucket
//

//
// TODO: Step 9
//
// Use the presigned URLs to upload updated characters to the asset library
//

const handleS3Event = async(event) => {
    const bucket = event.bucket.name;
    const key = decodeURIComponent(event.object.key.replace(/\+/g, ' '));

    const keyPrefix = key.split('/').slice(0, 1).join('/')
    if (keyPrefix === 'upload') {
        const objectNameItems = key.split('/').slice(1)
        const objectPrefix = objectNameItems.length > 1
            ? `${objectNameItems.slice(0, -1).join('/')}/`
            : ''

        const assetRegistryItems = await getAssets(s3Client, key)
        if (assetRegistryItems.length) {
            const asset = assetRegistryItems.find(({ tag }) => (['Asset', 'Character'].includes(tag)))
            if (asset && asset.key) {
                const fileName = `drafts/${objectPrefix}${asset.fileName}.wml`
                const translateFile = `drafts/${objectPrefix}${asset.fileName}.translate.json`
                const currentScopeMap = await getTranslateFile(s3Client, { name: translateFile })
                const scopeMapContents = scopeMap(assetRegistryItems, (currentScopeMap.scopeMap || {}))

                await Promise.all([
                    dbRegister(dbClient, {
                        fileName,
                        translateFile,
                        scopeMap: scopeMapContents,
                        assets: assetRegistryItems
                    }),
                    putTranslateFile(s3Client, {
                        name: translateFile,
                        scopeMap: scopeMapContents,
                        assetKey: asset.key
                    }),
                    s3Client.send(new CopyObjectCommand({
                        Bucket: bucket,
                        CopySource: `${bucket}/${key}`,
                        Key: fileName
                    }))
                ])
            }
    
        }

        await s3Client.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: key
        }))
        return {}
    }
    else {
        const errorMsg = JSON.stringify(`Error: Unknown S3 target: ${JSON.stringify(event, null, 4) }`)
        console.log(errorMsg)
        //
        // TODO: Better error handling
        //
    }
}

const handleDynamoEvent = async (event) => {
    const { eventName, dynamodb } = event
    const oldImage = unmarshall(dynamodb.OldImage || {})
    const newImage = unmarshall(dynamodb.NewImage || {})
    if (newImage.DataCategory === 'Meta::Character') {
        const mappedValue = (key) => {
            if (newImage[key]) {
                if (!oldImage || (newImage[key] !== oldImage[key])) {
                    return { value: newImage[key] }
                }
            }
            else {
                if (oldImage[key]) {
                    return 'remove'
                }
            }
            return 'ignore'
        }
        const remap = ['Name', 'Pronouns', 'FirstImpression', 'Outfit', 'OneCoolThing']
            .reduce((previous, key) => ({ ...previous, [key]: mappedValue(key) }), {})
        const flagName = (key) => (key === 'Name' ? '#Name' : key)
        const setItems = Object.entries(remap)
            .filter(([key, value]) => (value instanceof Object))
            .map(([key]) => (`${flagName(key)} = :${key}`))
        const expressionValues = Object.entries(remap)
            .filter(([key, value]) => (value instanceof Object))
            .reduce((previous, [key, value]) => ({
                ...previous,
                [`:${key}`]: value.value
            }), {})
        const removeItems = Object.entries(remap)
            .filter(([key, value]) => (value === 'remove'))
            .map(([key]) => (flagName(key)))
        const UpdateExpression = [
            ...(setItems.length ? [`SET ${setItems.join(', ')}`] : []),
            ...(removeItems.length ? [`REMOVE ${removeItems.join(', ')}`] : [])
        ].join(' ')
        if (UpdateExpression) {
            const CharacterId = splitType(newImage.AssetId)[1]
            try {
                await dbClient.send(new UpdateItemCommand({
                    TableName: ephemeraTable,
                    Key: marshall({
                        EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                        DataCategory: 'Connection'
                    }),
                    UpdateExpression,
                    ...(expressionValues ? { ExpressionAttributeValues: marshall(expressionValues) }: {}),
                    ...(remap['Name'] !== 'ignore' ? { ExpressionAttributeNames: { '#Name': 'Name' }} : {})
                }))
            }
            catch (error) {
                //
                // TODO: Error handling for common Dynamo errors
                //
                throw error
            }
        }
    }
}

exports.handler = async (event, context) => {

    // Handle S3 Events
    if (event.Records) {
        await Promise.all([
            ...event.Records
                .filter(({ s3 }) => (s3))
                .map(({ s3 }) => (s3))
                .map(handleS3Event),
            ...event.Records
                .filter(({ dynamodb }) => (dynamodb))
                .map(handleDynamoEvent)
        ])
        return JSON.stringify(`Events Processed`)
    }

    //
    // In-Lambda testing outlet (to be removed once development complete)
    //

    if (event.Evaluate) {
        const assetId = event.assetId
        const fileName = await cacheAsset(assetId)

        return JSON.stringify({ fileName })
    }
    if (event.heal) {
        const returnVal = await healAsset({ s3Client, dbClient }, event.heal)
        return JSON.stringify(returnVal, null, 4)
    }
    context.fail(JSON.stringify(`Error: Unknown format ${JSON.stringify(event, null, 4) }`))

}
