import { PerceptionMessage, MessageBus } from "../messageBus/baseClasses"
import { render } from "@tonylb/mtw-utilities/dist/perception"
import { deliverRenders } from "@tonylb/mtw-utilities/dist/perception/deliverRenders"
import { tagFromEphemeraId } from "../internalCache/dependencyGraph"
import internalCache from "../internalCache"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { EphemeraRoomAppearance } from "../cacheAsset/baseClasses"
import { componentAppearanceReduce } from "./components"

export const perceptionMessage = async ({ payloads, messageBus }: { payloads: PerceptionMessage[], messageBus: MessageBus }): Promise<void> => {
    const renderOutputs = await render({
        renderList: payloads
            // .filter(({ ephemeraId }) => (!(['Room', 'Feature'].includes(tagFromEphemeraId(ephemeraId)))))
            .map(({ characterId, ephemeraId }) => ({
                CharacterId: characterId,
                EphemeraId: ephemeraId
            }))
    })
    //
    // TODO: Replace deliverRenders with a messageBus handler
    //
    await deliverRenders({
        renderOutputs
    })

    //
    // TODO: Translate other types, above, into directly-handled format like below
    //
    await Promise.all(payloads.filter(({ ephemeraId }) => (['Room', 'Feature'].includes(tagFromEphemeraId(ephemeraId))))
        .map(async ({ characterId, ephemeraId }) => {
            const [globalAssets, { assets: characterAssets }] = await Promise.all([
                internalCache.Global.get('assets'),
                internalCache.CharacterMeta.get(characterId)
            ])
            const appearancesByAsset = await internalCache.ComponentMeta.getAcrossAssets(ephemeraId, unique(globalAssets, characterAssets) as string[])

            const tag = tagFromEphemeraId(ephemeraId) as 'Room' | 'Feature'
            switch(tag) {
                case 'Room':
                    const possibleAppearances = [...(globalAssets || []), ...characterAssets]
                        .map((assetId) => ((appearancesByAsset[assetId]?.appearances || []) as EphemeraRoomAppearance[]))
                        .reduce<EphemeraRoomAppearance[]>((previous, appearances) => ([ ...previous, ...appearances ]), [])
                    const renderAppearances = (await Promise.all(
                        possibleAppearances.map(async (appearance) => {
                            const conditionsPassList = await Promise.all(appearance.conditions.map(async ({ if: source, dependencies }) => (
                                internalCache.EvaluateCode.get({
                                    source,
                                    mapping: dependencies.reduce<Record<string, string>>((previous, { EphemeraId, key }) => ({ ...previous, [key]: EphemeraId }), {})
                                })
                            )))
                            const allConditionsPass = conditionsPassList.reduce<boolean>((previous, value) => (previous && Boolean(value)), true)
                            if (allConditionsPass) {
                                return appearance
                            }
                            else {
                                return undefined
                            }
                        })
                    )).filter((value: EphemeraRoomAppearance | undefined): value is EphemeraRoomAppearance => (Boolean(value)))
                    const render = componentAppearanceReduce(...renderAppearances)
                    break
                    //
                    // TODO: Send the render message to the messageBus
                    //

                    //
                    // TODO: Create analogous render pipeline for Features
                    //
            }

        })
    )

    messageBus.send({
        type: 'ReturnValue',
        body: {
            messageType: "ActionComplete"
        }
    })
}

export default perceptionMessage
