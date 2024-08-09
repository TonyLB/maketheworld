import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { getCurrentDateString } from "./utils";

type CreateEntryArgs = {
    AssetId: EphemeraAssetId;
}

export const createEntry = async ({ AssetId }: CreateEntryArgs): Promise<string> => {
    const datePrefix = getCurrentDateString()
    const todaysBackups = await assetDB.query({
        Key: { AssetId },
        KeyConditionExpression: 'begins_with(DataCategory, :dc)',
        ExpressionAttributeValues: { ':dc': `BACKUP#${datePrefix}-`},
        ProjectionFields: ['DataCategory']
    })
    const currentIndex = Math.max(0, ...(todaysBackups.map(({ DataCategory }) => (parseInt(DataCategory.split('-').slice(-1)[0])))))
    if (currentIndex >= 99) {
        throw new Error('Too many backups in one day')
    }
    const fileSuffix = `${datePrefix}-${`${currentIndex + 1}`.padStart(3, '0')}`
    await assetDB.putItem({
        AssetId,
        DataCategory: `BACKUP#${fileSuffix}`
    })
    return fileSuffix
}

export default createEntry
