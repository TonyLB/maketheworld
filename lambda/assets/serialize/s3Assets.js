import { GetObjectCommand } from "@aws-sdk/client-s3"
import { streamToString } from '../utilities/stream.js'
import { validatedSchema } from "../wml/index.js"
import { wmlQueryFactory } from '../wml/wmlQuery/index.js'
import { assetGetItem } from "../utilities/dynamoDB/index.js"
import { splitType } from "../utilities/types.js"

const { S3_BUCKET } = process.env;

class AssetWorkspace {
    constructor(contents) {
        this.wmlQuery = wmlQueryFactory(contents)
    }
    contents() {
        return this.wmlQuery('').source()
    }
    match() {
        return this.wmlQuery('').matcher().match()
    }
    isMatched() {
        return this.match().succeeded()
    }
    schema() {
        if (!this.cachedContent || this.cachedContent !== this.contents()) {
            this.cachedContent = this.contents()
            if (!this.isMatched()) {
                return []
            }
            this.cachedSchema = validatedSchema(this.match())
        }
        return this.cachedSchema
    }
}

export const fileNameFromAssetId = ({ dbClient }) => async (AssetId) => {
    const [type] = splitType(AssetId)
    const { fileName } = await assetGetItem({
        dbClient,
        AssetId,
        DataCategory: type === 'CHARACTER' ? 'Meta::Character' : 'Meta::Asset',
        ProjectionFields: ['fileName']
    })
    return fileName
}

export const getAssets = async (s3Client, fileName) => {
    const { Body: contentStream } = await s3Client.send(new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: fileName
    }))
    const contents = await streamToString(contentStream)
    const assetWorkspace = new AssetWorkspace(contents)

    if (!assetWorkspace.isMatched()) {
        console.log('ERROR: Schema failed validation')
        console.log(match.message)
        return null
    }
    //
    // TODO: Stronger error-handling ... maybe create some user-defined exceptions
    // so that we can throw them here
    //

    return assetWorkspace
}
