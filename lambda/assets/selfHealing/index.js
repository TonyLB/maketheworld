import { ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider"
import { UpdateItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { scopeMap } from "../serialize/scopeMap.js"
import { dbRegister } from "../serialize/dbRegister.js"
import { putTranslateFile, getTranslateFile } from "../serialize/translateFile.js"
import { importedAssetIds } from '../serialize/importedAssets.js'
import { getAssets } from "../serialize/s3Assets.js"
import { splitType } from "../utilities/types.js"

const { COGNITO_POOL_ID, TABLE_PREFIX } = process.env
const assetsTable = `${TABLE_PREFIX}_assets`

export const healAsset = async ({ s3Client, dbClient }, fileName) => {
    const baseFileName = fileName.replace(/\.wml$/, '')
    const translateName = `${baseFileName}.translate.json`
    const getScopeMap = async () => {
        const translateFileItem = await getTranslateFile(s3Client, { name: translateName })
        return translateFileItem.scopeMap || {}
    }
    try {
        const [assetRegistryItems, currentScopeMap] = await Promise.all([
            getAssets(s3Client, fileName),
            getScopeMap()
        ])
        const asset = assetRegistryItems.find(({ tag }) => (['Asset', 'Character'].includes(tag)))
        const assetKey = (asset && asset.key) || 'UNKNOWN'
        const importMap = asset.importMap || {}
        const importedIds = await importedAssetIds({ dbClient }, importMap)
        const scopeMapContents = scopeMap(
            assetRegistryItems,
            {
                ...currentScopeMap,
                ...importedIds
            }
        )
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

export const healPlayers = async ({ cognitoClient, dbClient }) => {
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
            ProjectionExpression: "AssetId, #name, fileName, scopedId, player",
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
        .map(({ player, AssetId, Name, fileName, scopedId }) => ({
            player,
            Name,
            fileName,
            scopedId,
            CharacterId: splitType(AssetId)[1]
        }))
        .reduce((previous, { player, CharacterId, Name, scopedId, fileName }) => ({
            ...previous,
            [player]: {
                ...(previous[player] || {}),
                [CharacterId]: {
                    Name,
                    fileName,
                    scopedId
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
