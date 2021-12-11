// Import required AWS SDK clients and commands for Node.js
const { S3Client, CopyObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3")
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb")
const { v4: uuidv4 } = require("uuid")

const { wmlGrammar, validatedSchema, assetRegistryEntries } = require("./wml/")
const { replaceItem, mergeIntoDataRange } = require('./utilities/dynamoDB')
const { cacheAsset } = require('./cache.js')
const { streamToString } = require('./utilities/stream')
const { healAsset } = require("./selfHealing")

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)
const dbClient = new DynamoDBClient(params)

//
// TODO: Step 2
//
// Create Character schema for WML, to allow for Character S3 objects
//

//
// TODO: Step 3
//
// Update selfHealing to include Character objects as well
//

//
// TODO: Step 4
//
// Create DBStream event handling for asset table changes
//

//
// TODO: Step 5
//
// Replace ephemera::denormalize with event-driven updates into the ephemera tables
//

//
// TODO: Step 6
//
// Update ephemera selfHealing to read from the existing Assets and rebuild denormalized
// data where necessary
//

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
exports.handler = async (event, context) => {

    console.log(`Event: ${JSON.stringify(event, null, 4)}`)
    // Get the object from the event and show its content type
    if (event.Records && event.Records[0]?.s3) {
        const bucket = event.Records[0].s3.bucket.name;
        const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    
        const keyPrefix = key.split('/').slice(0, 1).join('/')
        if (keyPrefix === 'upload') {
            const objectNameItems = key.split('/').slice(1)
            const objectPrefix = objectNameItems.length > 1
                ? `${objectNameItems.slice(0, -1).join('/')}/`
                : ''
            const { Body: contentStream } = await s3Client.send(new GetObjectCommand({
                Bucket: bucket,
                Key: key
            }))
            const contents = await streamToString(contentStream)
            const match = wmlGrammar.match(contents)
    
            if (match.succeeded()) {
    
                const schema = validatedSchema(match)
                if (schema.errors.length || !schema.fileName) {
                    //
                    // TODO: Stronger error handling
                    //
                    console.log(`ERROR`)
                }
                else {
                    const assetRegistryItems = assetRegistryEntries(schema)
                    const asset = assetRegistryItems.find(({ tag }) => (tag === 'Asset'))
                    if (asset && asset.key) {
                        const fileName = `drafts/${objectPrefix}${schema.fileName}`
                        await Promise.all([
                            replaceItem(dbClient, {
                                PermanentId: `ASSET#${asset.key}`,
                                DataCategory: 'Details',
                                fileName,
                                name: asset.name,
                                description: asset.description
                            }),
                            mergeIntoDataRange({
                                dbClient,
                                table: 'permanent',
                                search: { DataCategory: `ASSET#${asset.key}` },
                                items: assetRegistryItems
                                    .filter(({ tag }) => (tag === 'Room'))
                                    .map(({ tag, ...rest }) => (rest)),
                                mergeFunction: ({ current, incoming }) => {
                                    if (!incoming) {
                                        return 'delete'
                                    }
                                    if (!current) {
                                        const { key, isGlobal, ...rest } = incoming
                                        return {
                                            scopedId: key,
                                            ...rest
                                        }
                                    }
                                    //
                                    // TODO: When Room entries are expanded to store more than the sheer fact of their
                                    // existence (likely as part of Map storage), extend this function to compensate
                                    // by testing whether an update is needed
                                    //
                                    return 'ignore'
                                },
                                extractKey: (item, current) => {
                                    if (item.isGlobal) {
                                        return `ROOM#${item.key}`
                                    }
                                    const scopedToPermanent = current.find(({ scopedId }) => (scopedId === item.key))
                                    if (scopedToPermanent) {
                                        return scopedToPermanent.PermanentId
                                    }
                                    return `ROOM#${uuidv4()}`
                                }
                            }),
                            s3Client.send(new CopyObjectCommand({
                                Bucket: bucket,
                                CopySource: `${bucket}/${key}`,
                                Key: fileName
                            }))
                        ])
                    }
                }
        
            }
    
            await s3Client.send(new DeleteObjectCommand({
                Bucket: bucket,
                Key: key
            }))
            return {}
        }
        else {
            context.fail(JSON.stringify(`Error: Unknown format ${event}`))
        }

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
    context.fail(JSON.stringify(`Error: Unknown format ${event}`))

}
