const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { scopeMap } = require("../serialize/scopeMap");
const { streamToString } = require('../utilities/stream')
const { wmlGrammar, validatedSchema, assetRegistryEntries } = require("../wml/")
const { dbRegister } = require("../serialize/dbRegister")
const { putTranslateFile, getTranslateFile } = require("../serialize/translateFile")

const { S3_BUCKET } = process.env;


const healAsset = async ({ s3Client, dbClient }, fileName) => {
    const translateName = `${fileName}.translate.json`
    const getAssets = async () => {
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
            return {
                error: 'Schema failed validation'
            }
        }
        const schema = validatedSchema(match)

        return assetRegistryEntries(schema)
    }
    const getScopeMap = async () => {
        const scopeItem = await getTranslateFile(s3Client, { name: translateName })
        return scopeItem.scopeMap || {}
    }
    try {
        const [assetRegistryItems, currentScopeMap] = await Promise.all([
            getAssets(),
            getScopeMap()
        ])
        const asset = assetRegistryItems.find(({ tag }) => (tag === 'Asset'))
        const assetKey = (asset && asset.key) || 'UNKNOWN'
        const scopeMapContents = scopeMap(assetRegistryItems, currentScopeMap)
        await Promise.all([
            dbRegister(dbClient, {
                fileName,
                translateFile: translateName,
                scopeMap: scopeMapContents,
                assets: assetRegistryItems
            }),
            putTranslateFile(s3Client, {
                name: translateName,
                scopeMap: scopeMapContents,
                assetKey
            })
        ])
        return {
            scopeMap: scopeMapContents
        }
    }
    catch (error) {
        console.log('ERROR!')
        return { error: error.message }
    }
}

exports.healAsset = healAsset
