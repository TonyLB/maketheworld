import { GetObjectCommand } from "@aws-sdk/client-s3"
import { streamToString } from '@tonylb/mtw-utilities/dist/stream'
import SourceStream from '@tonylb/mtw-wml/dist/parser/tokenizer/sourceStream.js'
import tokenizer from '@tonylb/mtw-wml/dist/parser/tokenizer/index.js'
import parse from '@tonylb/mtw-wml/dist/parser/index.js'
import { schemaFromParse } from '@tonylb/mtw-wml/dist/schema/index.js'
import { WMLQuery } from '@tonylb/mtw-wml/dist/wmlQuery/index.js'

import { assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB/index"
import { splitType } from "@tonylb/mtw-utilities/dist/types"

const { S3_BUCKET } = process.env;

export class AssetWorkspace {
    wmlQuery: WMLQuery;
    cachedContent?: string;
    cachedSchema?: any;
    constructor(contents: string) {
        this.wmlQuery = new WMLQuery(contents)
    }
    contents() {
        return this.wmlQuery.source
    }
    get valid() {
        return this.wmlQuery.valid
    }
    schema() {
        if (!this.cachedContent || this.cachedContent !== this.contents()) {
            this.cachedContent = this.contents()
            this.cachedSchema = schemaFromParse(parse(tokenizer(new SourceStream(this.contents()))))
        }
        return this.cachedSchema
    }
    normalize() {
        return this.wmlQuery.normalize()
    }

    get assetId() {
        const asset = Object.values(this.normalize()).find(({ tag }) => (['Asset', 'Character'].includes(tag)))
        const assetKey = (asset && asset.key) || 'UNKNOWN'
        return assetKey
    }
}

export const fileNameFromAssetId = async (AssetId) => {
    const [type] = splitType(AssetId)
    let dataCategory = 'Meta::Asset'
    switch(type) {
        case 'CHARACTER':
            dataCategory = 'Meta::Character'
            break
    }
    const { fileName } = (await assetDB.getItem<{ fileName: string }>({
        AssetId,
        DataCategory: dataCategory,
        ProjectionFields: ['fileName']
    })) || {}
    return fileName
}

export const getAssets = async (s3Client, fileName) => {
    const { Body: contentStream } = await s3Client.send(new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: fileName
    }))
    const contents = await streamToString(contentStream)
    const assetWorkspace = new AssetWorkspace(contents)

    if (!assetWorkspace.valid) {
        console.log('ERROR: Schema failed validation')
        console.log(assetWorkspace.wmlQuery._error)
        return null
    }
    //
    // TODO: Stronger error-handling ... maybe create some user-defined exceptions
    // so that we can throw them here
    //

    return assetWorkspace
}
