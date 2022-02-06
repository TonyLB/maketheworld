import { splitType } from "/opt/utilities/types.js"
import { ephemeraDB, assetDB } from "/opt/utilities/dynamoDB/index.js"
import { healGlobalValues, generatePersonalAssetList } from "/opt/utilities/selfHealing/index.js"

const healPersonalAssets = async ({ PlayerName }) => {
    if (!PlayerName) {
        return
    }

    const [personalAssets, characters] = await Promise.all([
        generatePersonalAssetList(PlayerName),
        assetDB.query({
            IndexName: 'PlayerIndex',
            player: PlayerName,
            KeyConditionExpression: "DataCategory = :dc",
            ExpressionAttributeValues: {
                ":dc": `Meta::Character`
            },
            ProjectionFields: ['AssetId']
        })
    ])
    await Promise.all(
        characters
            .filter(({ AssetId }) => (AssetId))
            .map(({ AssetId }) => (
                ephemeraDB.update({
                    EphemeraId: `CHARACTERINPLAY#${splitType(AssetId)[1]}`,
                    DataCategory: 'Connection',
                    UpdateExpression: `SET assets = :assets`,
                    ExpressionAttributeValues: {
                        ':assets': personalAssets
                    }
                })        
            ))
    )

}

export const handleAssetEvents = async ({ events }) => {
    const oldImagePlayers = events
        .filter(({ oldImage }) => (oldImage.zone === 'Personal'))
        .filter(({ oldImage, newImage }) => (!(oldImage.player === newImage.player)))
        .map(({ oldImage }) => (oldImage.player))
    const newImagePlayers = events
        .filter(({ newImage }) => (newImage.zone === 'Personal'))
        .filter(({ oldImage, newImage }) => (!(oldImage.player === newImage.player)))
        .map(({ newImage }) => (newImage.player))
    const playersToUpdate = [...(new Set([...oldImagePlayers, ...newImagePlayers]))]
    await Promise.all([
        ...(events.find(({ oldImage, newImage }) => ([oldImage.zone, newImage.zone].includes('Canon')))
            ? [healGlobalValues({ shouldHealConnections: false })]
            : []
        ),
        Promise.all(playersToUpdate.map((PlayerName) => (healPersonalAssets({ PlayerName }))))
    ])
}
