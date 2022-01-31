import { GetObjectCommand } from "@aws-sdk/client-s3"
import { streamToString } from '../utilities/stream.js'
import { wmlGrammar, validatedSchema, assetRegistryEntries } from "../wml/index.js"

const { S3_BUCKET } = process.env;

export const getAssets = async (s3Client, fileName) => {
    const { Body: contentStream } = await s3Client.send(new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: fileName
    }))
    const contents = await streamToString(contentStream)
    //
    // TODO: Error-handling in case the files have become corrupt
    //
    const match = wmlGrammar.match(contents)    
    if (!match.succeeded()) {
        console.log('ERROR: Schema failed validation')
        console.log(match.message)
        return []
    }
    const schema = validatedSchema(match)
    //
    // TODO: Stronger error-handling ... maybe create some user-defined exceptions
    // so that we can throw them here
    //

    return assetRegistryEntries(schema)
}
