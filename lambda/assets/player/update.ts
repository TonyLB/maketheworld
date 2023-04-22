import { PlayerSettingsMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import { assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { unique } from "@tonylb/mtw-utilities/dist/lists"

export const playerSettingMessage = async ({ payloads, messageBus }: { payloads: PlayerSettingsMessage[], messageBus: MessageBus }): Promise<void> => {
    const basePlayer = await internalCache.Connection.get("player")
    if (basePlayer) {
        const settingsUpdate = payloads.reduce<Record<string, Omit<PlayerSettingsMessage, 'message'>[]>>((previous, { player, ...rest }) => ({
            ...previous,
            [player || basePlayer]: [
                ...(previous[player || basePlayer] || []),
                rest
            ]
        }), {})
        await Promise.all(Object.entries(settingsUpdate).map(async ([player, updates]) => {
            const { Settings } = await assetDB.optimisticUpdate({
                key: {
                    AssetId: `PLAYER#${player}`,
                    DataCategory: 'Meta::Player'
                },
                //
                // TODO: Allow optimisticUpdate to distinguish between a no-record return, and a return that has a record but none
                // of the requested keys are defined, and remove DataCategory from below
                //
                updateKeys: ['Settings', 'DataCategory'],
                updateReducer: (draft) => {
                    if (!draft.Settings) {
                        draft.Settings = { onboardCompleteTags: [] }
                    }
                    if (!Array.isArray(draft.Settings.onboardCompleteTags)) {
                        draft.Settings.onboardCompleteTags = []
                    }
                    updates.forEach(({ action, values }) => {
                        if (action === 'addOnboarding') {
                            draft.Settings.onboardCompleteTags = unique(draft.Settings.onboardCompleteTags, values)
                        }
                        if (action === 'removeOnboarding') {
                            draft.Settings.onboardCompleteTags = draft.Settings.onboardCompleteTags.filter((tag) => (!values.includes(tag)))
                        }
                    })
                }
            })
            if (Settings) {
                internalCache.PlayerSettings.set(player, Settings)
            }
        }))
        payloads.forEach(({ player, RequestId }) => {
            messageBus.send({
                type: 'PlayerInfo',
                player,
                RequestId
            })
        })
    }
}

export default playerSettingMessage
