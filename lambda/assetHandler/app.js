// Import required AWS SDK clients and commands for Node.js
const { S3Client, CopyObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3")

const { wmlGrammar, wmlSemantics } = require("./wml/")

const params = { region: process.env.AWS_REGION }

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
            const client = new S3Client(params)
            const { Body: contentStream } = await client.send(new GetObjectCommand({
                Bucket: bucket,
                Key: key
            }))
            const contents = await streamToString(contentStream)
            const match = wmlGrammar.match(contents)
    
            if (match.succeeded()) {
    
                const dbSchema = wmlSemantics(match).dbSchema()
                if (dbSchema.errors.length || !dbSchema.fileName) {
                    //
                    // TODO: Implement DynamoDB asset-handler storage to keep meta-data
                    // about the asset registry for the system
                    //
                }
                else {
                    await client.send(new CopyObjectCommand({
                        Bucket: bucket,
                        CopySource: `${bucket}/${key}`,
                        Key: `drafts/${objectPrefix}${dbSchema.fileName}`
                    }))
                }
        
            }
    
            await client.send(new DeleteObjectCommand({
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
            const dbSchema = wmlSemantics(match).dbSchema()
            console.log(JSON.stringify(dbSchema, null, 4))
            return JSON.stringify({ evaluated: dbSchema })
        }
        return JSON.stringify({ error: match.message })
    }
    context.fail(JSON.stringify(`Error: Unknown format ${event}`))

}
