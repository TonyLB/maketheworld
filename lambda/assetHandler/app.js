// Import required AWS SDK clients and commands for Node.js
const { S3Client, CopyObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3")
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb")

const { wmlGrammar, dbEntries, validatedSchema, assetRegistryEntries } = require("./wml/")
const {
    wmlProcessDown,
    assignContextTagIds
} = require('./wml/semantics/schema/processDown')
const { replaceItem, replaceRangeByDataCategory } = require('./utilities/dynamoDB')

const params = { region: process.env.AWS_REGION }
const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const permanentsTable = `${TABLE_PREFIX}_permanents`

const streamToString = (stream) => (
    new Promise((resolve, reject) => {
      const chunks = []
      stream.on("data", (chunk) => chunks.push(chunk))
      stream.on("error", reject)
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    })
)

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
            const s3Client = new S3Client(params)
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
                    const dbClient = new DynamoDBClient(params)
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
                            replaceRangeByDataCategory(
                                dbClient,
                                `ASSET#${asset.key}`,
                                assetRegistryItems
                                    .filter(({ tag }) => (tag === 'Room'))
                                    .map(({ tag, key, ...rest }) => ({ PermanentId: `ROOM#${key}`, ...rest })),
                                //
                                // TODO: When Room entries are expanded to store more than the sheer fact of their
                                // existence (likely as part of Map storage), extend this equality function to compensate
                                //
                                (incoming) => Boolean(incoming?.PermanentId)
                            ),
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
        const match = wmlGrammar.match(event.wml)
        if (match.succeeded()) {
            const schema = validatedSchema(match)
            if (schema.errors.length > 0)  {
                return JSON.stringify({ errors: schema.errors })
            }
            const assetRegistryItems = assetRegistryEntries(schema)
            console.log(JSON.stringify(assetRegistryItems, null, 4))
            return JSON.stringify({ evaluated: assetRegistryItems })
        }
        return JSON.stringify({ errors: [match.message] })
    }
    context.fail(JSON.stringify(`Error: Unknown format ${event}`))

}
