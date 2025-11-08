import { AssetsDataSource } from '../dataSource/abstract'
import internalCache from '../internalCache'
import {
    PlayerEventSerializer,
    PlayerSnapshot,
    PlayerEventUpdate
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/players'

const generatePlayerSnapshot = async (playerName: string): Promise<PlayerSnapshot> => {
    const [library, settings] = await Promise.all([
        internalCache.PlayerLibrary.get(playerName),
        internalCache.PlayerSettings.get(playerName)
    ])

    const assets = Object.values(library.Assets ?? {})
    const characters = Object.values(library.Characters ?? {})
    const { onboardCompleteTags = [], guestName, guestId } = settings || {}

    return {
        type: 'Snapshot',
        assets,
        characters,
        settings: {
            onboardCompleteTags,
            ...(guestName ? { guestName } : {}),
            ...(guestId ? { guestId } : {})
        }
    }
}

export const playersDataSource = new AssetsDataSource<PlayerSnapshot, PlayerEventUpdate>({
    dataSourceKey: 'mtw.assets.players',
    replayable: true,
    snapshotContentGenerator: generatePlayerSnapshot,
    eventSerializer: new PlayerEventSerializer()
})

playersDataSource.subscribe()

export default playersDataSource

