import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor } from './baseClasses'
import { AssetClientPlayerSettings } from '@tonylb/mtw-interfaces/dist/asset'

type CachePlayerSettingDataEntry = AssetClientPlayerSettings & {
    found: boolean;
    guestName?: string;
}

export class CachePlayerSettingData {
    PlayerSettings: Record<string, CachePlayerSettingDataEntry> = {}
    clear() {
        this.PlayerSettings = {}
    }
    async set(player: string, override: { onboardCompleteTags?: string[] }) {
        if (!(player in this.PlayerSettings)) {
            await this.get(player)
        }
        if (typeof override.onboardCompleteTags !== 'undefined') {
            this.PlayerSettings[player].onboardCompleteTags = override.onboardCompleteTags
        }
    }
    async get(player: string): Promise<AssetClientPlayerSettings> {
        if (!(player in this.PlayerSettings)) {
            const fetch = await assetDB.getItem<{
                Settings?: AssetClientPlayerSettings;
                guestName?: string;
            }>({
                AssetId: `PLAYER#${player}`,
                DataCategory: 'Meta::Player',
                ProjectionFields: ['Settings', 'guestName']
            })
            const { Settings = { onboardCompleteTags: [] }, guestName } = fetch || {}
            this.PlayerSettings[player] = {
                ...Settings,
                guestName,
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
