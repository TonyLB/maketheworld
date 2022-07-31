import { schemaFromParse } from '@tonylb/mtw-wml/dist/'
import tokenizer from '@tonylb/mtw-wml/dist/parser/tokenizer/'
import parse from '@tonylb/mtw-wml/dist/parser/'
import SourceStream from '@tonylb/mtw-wml/dist/parser/tokenizer/sourceStream'
import { normalize } from '@tonylb/mtw-wml/dist/normalize'
import { streamToString } from '@tonylb/mtw-utilities/dist/stream'
import { GetObjectCommand } from '../clients.js'
import internalCache from '../internalCache/'

const { S3_BUCKET } = process.env;

export const parseWMLFile = async (fileName) => {
    const s3Client = await internalCache.Connection.get('s3Client')
    const { Body: contentStream } = await s3Client.send(new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: fileName
    }))
    const contents = await streamToString(contentStream)
    //
    // TODO: Error-handling in case the files have become corrupt
    //
    // TODO: Create better handling for multiple top-level tags in a single WML file
    //
    const schema = schemaFromParse(parse(tokenizer(new SourceStream(contents))))[0]
    const normalized = normalize(schema)
    return normalized
}

export default parseWMLFile
