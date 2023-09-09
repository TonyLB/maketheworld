import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor } from './baseClasses'
import { AssetClientPlayerSettings } from '@tonylb/mtw-interfaces/ts/asset'

type CachePlayerSettingDataEntry = AssetClientPlayerSettings & {
    found: boolean;
    guestName?: string;
    guestId?: string;
}

export class CachePlayerSettingData {
    PlayerSettings: Record<string, CachePlayerSettingDataEntry> = {}
    clear() {
        this.PlayerSettings = {}
    }
    async set(player: string, override: { onboardCompleteTags?: string[], guestName?: string; guestId?: string; }) {
        if (!(player in this.PlayerSettings)) {
            await this.get(player)
        }
        if (typeof override.onboardCompleteTags !== 'undefined') {
            this.PlayerSettings[player].onboardCompleteTags = override.onboardCompleteTags
        }
        if (typeof override.guestName !== 'undefined') {
            this.PlayerSettings[player].guestName = override.guestName
        }
        if (typeof override.guestId !== 'undefined') {
            this.PlayerSettings[player].guestId = override.guestId
        }
    }
    async get(player: string): Promise<CachePlayerSettingDataEntry> {
        if (!(player in this.PlayerSettings)) {
            const fetch = await assetDB.getItem<{
                Settings?: AssetClientPlayerSettings;
                guestName?: string;
                guestId?: string;
            }>({
                Key: {
                    AssetId: `PLAYER#${player}`,
                    DataCategory: 'Meta::Player'
                },
                ProjectionFields: ['Settings', 'guestName', 'guestId']
            })
            const { Settings = { onboardCompleteTags: [] }, guestName, guestId } = fetch || {}
            this.PlayerSettings[player] = {
                ...Settings,
                guestName,
                guestId,
                found: !(typeof fetch === 'undefined')
            }
        }
        return this.PlayerSettings[player] || { onboardCompleteTags: [], found: false }
    }
}

export const CachePlayerSettings = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CachePlayerSettings extends Base {
        PlayerSettings: CachePlayerSettingData = new CachePlayerSettingData()

        override clear() {
            this.PlayerSettings.clear()
            super.clear()
        }
    }
}

export default CachePlayerSettings
