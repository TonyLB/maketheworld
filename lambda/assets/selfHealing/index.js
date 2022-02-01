import { ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider"
import { scopeMap } from "../serialize/scopeMap.js"
import { dbRegister } from "../serialize/dbRegister.js"
import { putTranslateFile, getTranslateFile } from "../serialize/translateFile.js"
import { importedAssetIds, assetIdsFromTree } from '../serialize/importedAssets.js'
import { getAssets } from "../serialize/s3Assets.js"
import { splitType } from "../utilities/types.js"
import { assetDataCategoryQuery, updateAsset } from "../utilities/dynamoDB/index.js"
import { asyncSuppressExceptions } from '../utilities/errors.js'

const { COGNITO_POOL_ID, TABLE_PREFIX } = process.env
const assetsTable = `${TABLE_PREFIX}_assets`

export const healAsset = async ({ s3Client, dbClient }, fileName) => {
    const baseFileName = fileName.replace(/\.wml$/, '')
    const translateName = `${baseFileName}.translate.json`
    const getScopeMap = async () => {
        const translateFileItem = await getTranslateFile(s3Client, { name: translateName })
        return translateFileItem.scopeMap || {}
    }
    return asyncSuppressExceptions(async () => {
        const [assetRegistryItems, currentScopeMap] = await Promise.all([
            getAssets(s3Client, fileName),
            getScopeMap()
        ])
        const asset = assetRegistryItems.find(({ tag }) => (['Asset', 'Character'].includes(tag)))
        const assetKey = (asset && asset.key) || 'UNKNOWN'
        const { importTree, scopeMap: importedIds } = await importedAssetIds({ dbClient }, asset.importMap || {})
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
                importTree,
                scopeMap: scopeMapContents,
                assets: assetRegistryItems
            }),
            putTranslateFile(s3Client, {
                name: translateName,
                importTree,
                scopeMap: scopeMapContents,
                assetKey
            })
        ])
        return {
            scopeMap: scopeMapContents
        }
    }, {})
}

export const healPlayers = async ({ cognitoClient, dbClient }) => {
    //
    // TODO: Filter on only confirmed players, to prevent healing in lots of unconfirmed names
    //
    const [{ Users = [] }, characterQueryReturn] = await Promise.all([
        cognitoClient.send(new ListUsersCommand({
            UserPoolId: COGNITO_POOL_ID
        })),
        assetDataCategoryQuery({
            dbClient,
            DataCategory: 'Meta::Character',
            ProjectionFields: ['AssetId', '#name', 'fileName', 'scopedId', 'player'],
            ExpressionAttributeNames: { '#name': 'Name' }
        })
    ])
    const userNames = Users
        .map(({ Username }) => (Username))
        .filter((userName) => (userName))
    const charactersByPlayer = characterQueryReturn
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
            updateAsset({
                dbClient,
                AssetId: `PLAYER#${userName}`,
                DataCategory: 'Meta::Player',
                UpdateExpression: "SET #code = if_not_exists(#code, :false), #characters = :characters",
                ExpressionAttributeValues: {
                    ':false': false,
                    ':characters': charactersByPlayer[userName] || {}
                },
                ExpressionAttributeNames: {
                    '#code': 'CodeOfConductConsent',
                    '#characters': 'Characters'
                }
            })
        ))
    )
    return {}
}
