// Import required AWS SDK clients and commands for Node.js
const { S3Client, CopyObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3")
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb")
const { v4: uuidv4 } = require("uuid")

const { wmlGrammar, validatedSchema, assetRegistryEntries } = require("./wml/")
const { replaceItem, mergeIntoDataRange } = require('./utilities/dynamoDB')
const { cacheAsset } = require('./cache.js')
const { streamToString } = require('./utilities/stream')
const { healAsset } = require("./selfHealing")
const { getAssets } = require("./serialize/s3Assets")
const { putTranslateFile, getTranslateFile } = require("./serialize/translateFile")
const { scopeMap } = require("./serialize/scopeMap")
const { dbRegister } = require('./serialize/dbRegister')

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)
const dbClient = new DynamoDBClient(params)

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

            const assetRegistryItems = await getAssets(s3Client, key)
            if (assetRegistryItems.length) {
                const asset = assetRegistryItems.find(({ tag }) => (['Asset', 'Character'].includes(tag)))
                if (asset && asset.key) {
                    console.log(`Asset: ${JSON.stringify(asset, null, 4)}`)
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
            const errorMsg = JSON.stringify(`Error: Unknown format ${event}`)
            console.log(errorMsg)
            context.fail(errorMsg)
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
