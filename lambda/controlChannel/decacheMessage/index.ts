import { marshall } from "@aws-sdk/util-dynamodb";
import {
    ephemeraDB,
    batchWriteDispatcher
} from "@tonylb/mtw-utilities/dist/dynamoDB"
import { AssetKey } from "@tonylb/mtw-utilities/dist/types"
import { DecacheAssetMessage, MessageBus } from "../messageBus/baseClasses"

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

export const decacheAssetMessage = async ({ payloads, messageBus }: { payloads: DecacheAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async ({ assetId }) => {
        const cachedItems = await ephemeraDB.query<{ EphemeraId: string }[]>({
            IndexName: 'DataCategoryIndex',
            DataCategory: AssetKey(assetId),
        })
        await batchWriteDispatcher({
            table: ephemeraTable,
            items: cachedItems.map(({ EphemeraId }) => ({
                DeleteRequest: {
                    Key: marshall({
                        EphemeraId,
                        DataCategory: AssetKey(assetId)
                    })
                }
            }))
        })
    }))
    messageBus.send({
        type: 'ReturnValue',
        body: { messageType: "Success" }
    })    
}

export default decacheAssetMessage
