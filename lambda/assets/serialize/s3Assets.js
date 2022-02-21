import { GetObjectCommand } from "@aws-sdk/client-s3"
import { streamToString } from '/opt/utilities/stream.js'
import { validatedSchema } from "../wml/index.js"
import { normalize } from '../wml/normalize.js'
import { wmlQueryFactory } from '../wml/wmlQuery/index.js'
import { assetDB } from "/opt/utilities/dynamoDB/index.js"
import { splitType } from "/opt/utilities/types.js"

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
    normalize() {
        if (!this.isMatched) {
            return {}
        }
        return normalize(this.schema())
    }
}

export const fileNameFromAssetId = async (AssetId) => {
    const [type] = splitType(AssetId)
    const { fileName } = await assetDB.getItem({
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
        console.log(assetWorkspace.match().message)
        return null
    }
    //
    // TODO: Stronger error-handling ... maybe create some user-defined exceptions
    // so that we can throw them here
    //

    return assetWorkspace
}
