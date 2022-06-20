import { wmlGrammar, validatedSchema } from '../wml/index.js'
import { normalize } from '../wml/normalize.js'
import { streamToString } from '@tonylb/mtw-utilities/stream.js'
import { s3Client, GetObjectCommand } from '../clients.js'

const { S3_BUCKET } = process.env;

export const parseWMLFile = async (fileName) => {
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
    const normalized = normalize(schema)
    return normalized
}

export default parseWMLFile
