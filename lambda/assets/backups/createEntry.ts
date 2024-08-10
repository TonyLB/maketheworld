import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { getCurrentDateString } from "./utils";
import internalCache from "../internalCache";
import { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/ts"

type CreateEntryArgs = {
    AssetId: EphemeraAssetId;
}

export const createEntry = async ({ AssetId }: CreateEntryArgs): Promise<{ suffix: string; address: AssetWorkspaceAddress, fileName: string }> => {
    const datePrefix = getCurrentDateString()
    const [todaysBackups, assetMetas] = await Promise.all([
        assetDB.query({
            Key: { AssetId },
            KeyConditionExpression: 'begins_with(DataCategory, :dc)',
            ExpressionAttributeValues: { ':dc': `BACKUP#${datePrefix}-`},
            ProjectionFields: ['DataCategory']
        }),
        internalCache.Meta.get([AssetId])
    ])
    const currentIndex = Math.max(0, ...(todaysBackups.map(({ DataCategory }) => (parseInt(DataCategory.split('-').slice(-1)[0])))))
    if (currentIndex >= 99) {
        throw new Error('Too many backups in one day')
    }
    const fileSuffix = `${datePrefix}-${`${currentIndex + 1}`.padStart(3, '0')}`
    const assetMeta = assetMetas.find(({ AssetId: checkAssetId }) => (checkAssetId === AssetId))
    const { address } = assetMeta ?? {}
    if (!address) {
        throw new Error('No address found for that key')
    }
    let fileFolder = ''
    switch(address.zone) {
        case 'Canon':
        case 'Library':
            fileFolder = `Backups/${address.zone}/${address.subFolder ? `${address.subFolder}/` : ''}${address.fileName}/`
            break
        case 'Personal':
            fileFolder = `Backups/${address.zone}/${address.player}/${address.subFolder ? `${address.subFolder}/` : ''}${address.fileName}/`
            break
        case 'Draft':
            fileFolder = `Backups/${address.zone}/${address.player}/Draft/`
            break
    }
    const fileName = `${fileFolder}${fileSuffix}.tar.gz`
    await assetDB.putItem({
        AssetId,
        DataCategory: `BACKUP#${fileSuffix}`,
        fileName
    })
    return {
        suffix: fileSuffix,
        address,
        fileName
    }
}

export default createEntry
