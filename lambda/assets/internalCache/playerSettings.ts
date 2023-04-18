import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor } from './baseClasses'

type PlayerSettings = {
    onboardCompleteTags: string[];
}

export class CachePlayerSettingData {
    PlayerSettings: Record<string, PlayerSettings> = {}
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
    async get(player: string): Promise<PlayerSettings> {
        if (!(player in this.PlayerSettings)) {
            const { settings = { onboardCompleteTags: [] } } = (await assetDB.getItem<{ settings?: PlayerSettings }>({
                AssetId: `PLAYER#${player}`,
                DataCategory: 'Meta::Player',
                ProjectionFields: ['settings']
            })) || {}
            this.PlayerSettings[player] = settings
        }
        return this.PlayerSettings[player] || { onboardCompleteTags: [] }
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
