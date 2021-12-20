const { ListUsersCommand } = require("@aws-sdk/client-cognito-identity-provider")
const { UpdateItemCommand, QueryCommand } = require("@aws-sdk/client-dynamodb")
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")
const { scopeMap } = require("../serialize/scopeMap");
const { dbRegister } = require("../serialize/dbRegister")
const { putTranslateFile, getTranslateFile } = require("../serialize/translateFile")
const { getAssets } = require("../serialize/s3Assets")
const { splitType } = require("../utilities/types")

const { COGNITO_POOL_ID, TABLE_PREFIX } = process.env
const assetsTable = `${TABLE_PREFIX}_assets`

const healAsset = async ({ s3Client, dbClient }, fileName) => {
    const baseFileName = fileName.replace(/\.wml$/, '')
    const translateName = `${baseFileName}.translate.json`
    const getScopeMap = async () => {
        const scopeItem = await getTranslateFile(s3Client, { name: translateName })
        return scopeItem.scopeMap || {}
    }
    try {
        const [assetRegistryItems, currentScopeMap] = await Promise.all([
            getAssets(s3Client, fileName),
            getScopeMap()
        ])
        const asset = assetRegistryItems.find(({ tag }) => (['Asset', 'Character'].includes(tag)))
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
        // return { error: error.message }
        throw error
    }
}

const healPlayers = async ({ cognitoClient, dbClient }) => {
    //
    // TODO: Filter on only confirmed players, to prevent healing in lots of unconfirmed names
    //
    const [{ Users = [] }, { Items = []}] = await Promise.all([
        cognitoClient.send(new ListUsersCommand({
            UserPoolId: COGNITO_POOL_ID
        })),
        dbClient.send(new QueryCommand({
            TableName: assetsTable,
            KeyConditionExpression: 'DataCategory = :metachar',
            IndexName: 'DataCategoryIndex',
            ExpressionAttributeValues: marshall({
                ':metachar': 'Meta::Character'
            }),
            ProjectionExpression: "AssetId, #name, player",
            ExpressionAttributeNames: {
                '#name': 'Name'
            }
        }))
    ])
    const userNames = Users
        .map(({ Username }) => (Username))
        .filter((userName) => (userName))
    const charactersByPlayer = Items
        .map(unmarshall)
        .map(({ player, AssetId, Name }) => ({
            player,
            Name,
            CharacterId: splitType(AssetId)[1]
        }))
        .reduce((previous, { player, CharacterId, Name }) => ({
            ...previous,
            [player]: {
                ...(previous[player] || {}),
                [CharacterId]: {
                    Name
                }
            }
        }), {})
    await Promise.all(
        userNames.map((userName) => (
            dbClient.send(new UpdateItemCommand({
                TableName: assetsTable,
                Key: marshall({
                    AssetId: `PLAYER#${userName}`,
                    DataCategory: 'Meta::Player'
                }),
                UpdateExpression: "SET #code = if_not_exists(#code, :false), #characters = :characters",
                ExpressionAttributeValues: marshall({
                    ':false': false,
                    ':characters': charactersByPlayer[userName] || {}
                }),
                ExpressionAttributeNames: {
                    '#code': 'CodeOfConductConsent',
                    '#characters': 'Characters'
                }
            }))
        ))
    )
    return {}
}

exports.healAsset = healAsset
exports.healPlayers = healPlayers
