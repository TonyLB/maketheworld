import { connectionDB, assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor } from './baseClasses'
import { splitType } from '@tonylb/mtw-utilities/dist/types'

export type CacheUploadSubscriptionItem = {
    connections: string[];
    player: string;
    RequestId: string;
}

export class CacheUploadSubscriptionsData {
    uploadSubscriptions: Record<string, CacheUploadSubscriptionItem[]> = {}
    clear() {
        this.uploadSubscriptions = {}
    }
    async get(key: string): Promise<CacheUploadSubscriptionItem[]> {
        if (!(key in this.uploadSubscriptions)) {
            const subscriptionFetch = await assetDB.query({
                AssetId: `UPLOAD#${key}`,
                ProjectionFields: ['DataCategory', 'RequestId']
            })
            const subscriptions = subscriptionFetch
                .map(({ DataCategory, RequestId }) => ({ PlayerName: splitType(DataCategory)[1], RequestId }))
        
            this.uploadSubscriptions[key] = await Promise.all(subscriptions
                .map(async ({ PlayerName, RequestId }) => {
                    const Items = await connectionDB.query({
                        IndexName: 'DataCategoryIndex',
                        DataCategory: 'Meta::Connection',
                        FilterExpression: 'player = :player',
                        ExpressionAttributeValues: {
                            ':player': PlayerName
                        },
                    })
                    const connections = Items.map(({ ConnectionId }) => (ConnectionId))
                    return {
                        RequestId,
                        player: PlayerName,
                        connections
                    }
                })
            )
        }
        return this.uploadSubscriptions[key] || []
    }
}

export const CacheUploadSubscriptions = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheConnection extends Base {
        UploadSubscriptions: CacheUploadSubscriptionsData = new CacheUploadSubscriptionsData()

        override clear() {
            this.UploadSubscriptions.clear()
            super.clear()
        }
    }
}

export default CacheUploadSubscriptions
