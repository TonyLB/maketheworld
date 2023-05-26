import { CognitoIdentityProviderClient, ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider"

import { assetDB, ephemeraDB } from '../dynamoDB'
import { splitType } from '../types'
import { asyncSuppressExceptions } from '../errors'

const { COGNITO_POOL_ID } = process.env

const params = { region: process.env.AWS_REGION }
const cognitoClient = new CognitoIdentityProviderClient(params)

//
// TODO: Lift healPlayers from mtw-utilities to asset lambda where it belongs
//

//
// TODO: Refactor healPlayers to call healPlayer message (from player messages)
// and reduce code repetition
//
export const healPlayers = async () => {
    //
    // TODO: Filter on only confirmed players, to prevent healing in lots of unconfirmed names
    //
    const [{ Users = [] }, characterQueryReturn] = await Promise.all([
        cognitoClient.send(new ListUsersCommand({
            UserPoolId: COGNITO_POOL_ID
        })),
        assetDB.query({
            IndexName: 'DataCategoryIndex',
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
        userNames.map((userName = '') => (
            assetDB.update({
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

//
// TODO: Lift healGlobalValues into an EventBridge routine, and subscribe the Ephemera
// and Assets lambdas to that event in order to handle repsective updates
//
export const healGlobalValues = async ({ shouldHealConnections = true, shouldHealGlobalAssets = true }) => {
    return await asyncSuppressExceptions(async () => {
        const healConnections = async () => {
            const Items = await ephemeraDB.query({
                IndexName: 'DataCategoryIndex',
                DataCategory: 'Meta::Connection',
                ProjectionFields: ['EphemeraId', 'player']
            })
        
            const connectionMap = Items
                .map(({ EphemeraId, player }) => ({ Player: player, Connection: splitType(EphemeraId)[1]}))
                .reduce((previous, { Player, Connection }) => ({ ...previous, [Connection]: Player }), {})
        
            await ephemeraDB.putItem({
                EphemeraId: 'Global',
                DataCategory: 'Connections',
                connections: connectionMap
            })
        }

        const healGlobalAssets = async () => {
            const Items = await assetDB.query({
                IndexName: 'DataCategoryIndex',
                DataCategory: 'Meta::Asset',
                FilterExpression: "#zone = :canon",
                ExpressionAttributeNames: {
                    '#zone': 'zone'
                },
                ExpressionAttributeValues: {
                    ':canon': 'Canon'
                },
                ProjectionFields: ['AssetId', 'importTree']
            })
            const globalAssets = Items
                .map(({ AssetId, importTree }) => ({ AssetId: splitType(AssetId)[1], importTree }))
                .filter(({ AssetId }) => (AssetId))
                .map(({ AssetId, importTree }) => ({ [AssetId]: importTree }))

            //
            // TODO: As part of moving fetchImportDefaults into asset lambda, figure out how the ancestry should
            // be sorted
            //
            const unencumberedImports = (tree: Record<string, any>, excludeList: string[] = [], depth = 0) => {
                if (depth > 200) {
                    return []
                }
                const directImports = Object.entries(tree)
                    .filter(([key]) => (!excludeList.includes(key)))
                const unencumbered = directImports
                    .map(([key, imports = {}]) => ({ key, imports: Object.keys(imports)}))
                    .map(({ key, imports }: { key: string, imports: string[] }) => ([
                        key,
                        imports.filter((dependency) => (!excludeList.includes(dependency)))
                    ]))
                const unencumberedImportsAll = [
                    ...unencumbered.filter(([key, imports]) => (imports.length === 0)).map(([key]) => key),
                    ...Object.values(tree).map((recurse = {}) => (unencumberedImports(recurse, excludeList, depth + 1))).reduce((previous, list) => ([...previous, ...list]), [])
                ]
                return [...(new Set(unencumberedImportsAll))]
            }
            
            const sortImportTree = (tree: Record<string, any>, currentList: string[] = []): string[] => {
                const readyImports = unencumberedImports(tree, currentList)
                if (readyImports.length > 0) {
                    return [
                        ...readyImports.sort((a, b) => (a.localeCompare(b))),
                        ...sortImportTree(tree, [...currentList, ...readyImports])
                    ]
                }
                else {
                    return []
                }
            }
            const globalAssetsSorted = sortImportTree(Object.assign({}, ...globalAssets))
            await ephemeraDB.update({
                EphemeraId: 'Global',
                DataCategory: 'Assets',
                UpdateExpression: `SET assets = :assets`,
                ExpressionAttributeValues: {
                    ':assets': globalAssetsSorted
                }
            })
        }

        if (shouldHealConnections) {
            const [connections] = await Promise.all([
                healConnections(),
                ...(shouldHealGlobalAssets ? [healGlobalAssets()] : [])
            ])
            return connections    
        }
        else {
            if (shouldHealGlobalAssets) {
                await healGlobalAssets()
            }
        }
        return
    }, async () => ({}))
}

export const convertAssetQuery = (queryItems) => {
    const Characters = queryItems
        .filter(({ DataCategory }) => (DataCategory === 'Meta::Character'))
        .map(({ AssetId, Name, scopedId, fileName, fileURL }) => ({ CharacterId: splitType(AssetId)[1], Name, scopedId, fileName, fileURL }))
    const Assets = queryItems
        .filter(({ DataCategory }) => (DataCategory === 'Meta::Asset'))
        .map(({ AssetId, scopedId, Story, instance }) => ({ AssetId: splitType(AssetId)[1], scopedId, Story, instance }))

    return {
        Characters,
        Assets
    }
}

export const generatePersonalAssetLibrary = async (player) => {
    if (player) {
        const items = await assetDB.query({
            IndexName: 'PlayerIndex',
            player,
            ProjectionFields: ['AssetId', 'DataCategory', '#name', 'scopedId', 'fileName', 'fileURL', 'Story', 'instance'],
            ExpressionAttributeNames: {
                '#name': 'Name'
            }
        })
        const { Characters, Assets } = convertAssetQuery(items)
        return {
            PlayerName: player,
            Characters,
            Assets
        }
    }
    return {}
}

export const generateLibrary = async () => {
    const items = await assetDB.query({
        IndexName: 'ZoneIndex',
        zone: 'Library',
        ProjectionFields: ['AssetId', 'DataCategory', '#name', 'scopedId', 'fileName', 'fileURL', 'Story', 'instance'],
        ExpressionAttributeNames: {
            '#name': 'Name'
        }
    })
    const { Characters, Assets } = convertAssetQuery(items)
    return {
        Characters,
        Assets
    }
}
