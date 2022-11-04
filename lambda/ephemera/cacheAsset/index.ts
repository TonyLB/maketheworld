import putAssetNormalized from './putAssetNormalized.js'
import StateSynthesizer from './stateSynthesis'
import AssetWorkspace from '@tonylb/mtw-asset-workspace/dist/'
import {
    isNormalAsset,
    NormalItem,
    NormalForm,
    isNormalExit,
    isNormalAction,
    NormalCharacter,
    isNormalCharacter,
    ComponentRenderItem,
    isNormalRoom,
    isNormalFeature,
    isNormalMap,
    isNormalVariable,
    isNormalComputed,
    isNormalImage,
    NormalReference,
    isNormalCondition,
    MapAppearanceRoom
} from '@tonylb/mtw-wml/dist/normalize/baseClasses.js'
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
import {
    EphemeraCharacter,
    EphemeraCondition,
    EphemeraExit,
    EphemeraItem,
    EphemeraItemDependency,
    EphemeraMapRoom,
    EphemeraPushArgs
} from './baseClasses'
import { objectEntryMap } from '../lib/objects.js'
import { conditionsFromContext } from './utilities'
import { defaultColorFromCharacterId } from '../lib/characterColor'
import { AssetKey, splitType } from '@tonylb/mtw-utilities/dist/types.js'
import { CacheAssetMessage, MessageBus } from '../messageBus/baseClasses.js'
import { mergeIntoEphemera } from './perAsset'
import { EphemeraError, EphemeraRoomId, isEphemeraActionId, isEphemeraCharacterId, isEphemeraComputedId, isEphemeraFeatureId, isEphemeraMapId, isEphemeraRoomId, isEphemeraVariableId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { TaggedConditionalItemDependency, TaggedMessageContent, TaggedMessageContentFlat } from '@tonylb/mtw-interfaces/dist/messages.js'

//
// TODO:
//
// Consider how to handle the various cases of change,
// in relation to the characters possibly occupying the rooms
//
// What does it mean when the underlying assets of a room change, in terms
// of notifying people in it?
//

type CacheAssetOptions = {
    check?: boolean;
    recursive?: boolean;
    forceCache?: boolean;
}

//
// Translates from normal form to a fetch-ready record to be stored in the Ephemera table.
//
const ephemeraTranslateRender = (assetWorkspace: AssetWorkspace) => (renderItem: ComponentRenderItem): TaggedMessageContent => {
    if (renderItem.tag === 'Link') {
        const to = assetWorkspace.namespaceIdToDB[renderItem.to]
        if (!(isEphemeraActionId(to) || isEphemeraCharacterId(to) || isEphemeraFeatureId(to))) {
            throw new EphemeraError(`Illegal target in link: ${to}`)
        }
        return {
            ...renderItem,
            to
        }
    }
    else if (renderItem.tag === 'Condition') {
        const mappedConditions = renderItem.conditions.map<EphemeraCondition>((condition) => {
            const dependencies = condition.dependencies.map<TaggedConditionalItemDependency>((depend) => {
                const dependTranslated = assetWorkspace.namespaceIdToDB[depend]
                if (!(isEphemeraComputedId(dependTranslated) || isEphemeraVariableId(dependTranslated))) {
                    throw new EphemeraError(`Illegal dependency in If: ${depend}`)
                }
                return {
                    key: depend,
                    EphemeraId: dependTranslated
                }
            })
            return {
                if: condition.if,
                dependencies
            }
        })
        return {
            ...renderItem,
            conditions: mappedConditions,
            contents: renderItem.contents.map(ephemeraTranslateRender(assetWorkspace))
        }
    }
    else {
        return renderItem
    }
}

//
// Extract fetch-ready list of exits from EphemeraRoom contents
//
const ephemeraExtractExits = (assetWorkspace: AssetWorkspace) => (contents: NormalReference[]): EphemeraExit[] => {
    return contents.reduce<EphemeraExit[]>((previous, item) => {
        const itemLookup = assetWorkspace.normal?.[item.key]
        if (itemLookup) {
            if (isNormalExit(itemLookup)) {
                const to = assetWorkspace.namespaceIdToDB[itemLookup.to]
                if (!isEphemeraRoomId(to)) {
                    throw new EphemeraError(`Illegal target in exit: ${to}`)
                }
                return [
                    ...previous,
                    {
                        conditions: [],
                        name: itemLookup.name || '',
                        to
                    }
                ]
            }
            if (isNormalCondition(itemLookup)) {
                const nestedExits = ephemeraExtractExits(assetWorkspace)(itemLookup.appearances[item.index].contents)
                if (nestedExits.length) {
                    const mappedConditions = itemLookup.conditions.map<EphemeraCondition>((condition) => {
                        const dependencies = condition.dependencies.map<EphemeraItemDependency>((depend) => {
                            const dependTranslated = assetWorkspace.namespaceIdToDB[depend]
                            if (!dependTranslated) {
                                throw new EphemeraError(`Illegal dependency in If: ${depend}`)
                            }
                            if (!(isEphemeraComputedId(dependTranslated) || isEphemeraVariableId(dependTranslated))) {
                                throw new EphemeraError(`Illegal dependency in If: ${depend}`)
                            }
                            return {
                                key: depend,
                                EphemeraId: dependTranslated
                            }
                        })
                        return {
                            if: condition.if,
                            dependencies
                        }
                    })
                    return [
                        ...previous,
                        ...(nestedExits.map((exit) => ({
                            ...exit,
                            conditions: [
                                ...mappedConditions,
                                ...exit.conditions
                            ]
                        })))
                    ]
                }
            }
        }
        return previous
    }, [])
}

const ephemeraItemFromNormal = (assetWorkspace: AssetWorkspace) => (item: NormalItem): EphemeraItem | undefined => {
    const { namespaceIdToDB: namespaceMap, normal = {} } = assetWorkspace
    const conditionsTransform = conditionsFromContext(assetWorkspace)
    const conditionsRemap = (conditions: { if: string; dependencies: string[] }[]): EphemeraCondition[] => {
        return conditions.map((condition) => {
            const dependencies = condition.dependencies.reduce<EphemeraCondition["dependencies"]>((previous, key) => {
                const dependencyLookup = assetWorkspace.namespaceIdToDB[key]
                if (!(isEphemeraComputedId(dependencyLookup) || isEphemeraVariableId(dependencyLookup))) {
                    throw new EphemeraError(`Illegal dependency: ${key}`)
                }
                return [
                    ...previous,
                    {
                        key,
                        EphemeraId: dependencyLookup
                    }
                ]
            }, [])
            return {
                if: condition.if,
                dependencies
            }
        })
    }
    const EphemeraId = namespaceMap[item.key]
    if (!EphemeraId) {
        return undefined
    }
    const renderTranslate = ephemeraTranslateRender(assetWorkspace)
    const exitTranslate = ephemeraExtractExits(assetWorkspace)
    if (isEphemeraRoomId(EphemeraId) && isNormalRoom(item)) {
        return {
            key: item.key,
            EphemeraId: EphemeraId,
            appearances: item.appearances
                .map((appearance) => ({
                    conditions: conditionsTransform(appearance.contextStack),
                    name: (appearance.name ?? []).map(renderTranslate),
                    render: (appearance.render || []).map(renderTranslate),
                    exits: exitTranslate(appearance.contents)
                }))
        }
    }
    if (isEphemeraFeatureId(EphemeraId) && isNormalFeature(item)) {
        return {
            key: item.key,
            EphemeraId,
            appearances: item.appearances
                .map((appearance) => ({
                    conditions: conditionsTransform(appearance.contextStack),
                    name: (appearance.name ?? []).map(renderTranslate),
                    render: (appearance.render || []).map(renderTranslate),
                }))
        }
    }
    if (isEphemeraMapId(EphemeraId) && isNormalMap(item)) {
        return {
            key: item.key,
            EphemeraId,
            appearances: item.appearances
                .map((appearance) => {
                    const image = appearance.images.length > 0 && normal[appearance.images.slice(-1)[0]]
                    const fileURL = (image && isNormalImage(image) && image.fileURL) || ''
                    return {
                        conditions: conditionsTransform(appearance.contextStack),
                        name: (appearance.name ?? []).map(renderTranslate),
                        fileURL,
                        rooms: appearance.rooms.map(({ conditions, key,  x, y }) => ({
                            conditions: conditionsRemap(conditions),
                            EphemeraId: namespaceMap[key] || '',
                            x,
                            y
                        }))
                    }
                })
        }
    }
    if (isEphemeraCharacterId(EphemeraId) && isNormalCharacter(item)) {
        return {
            key: item.key,
            EphemeraId,
            address: assetWorkspace.address,
            Name: item.Name,
            Pronouns: item.Pronouns,
            FirstImpression: item.FirstImpression,
            OneCoolThing: item.OneCoolThing,
            Outfit: item.Outfit,
            Color: defaultColorFromCharacterId(splitType(EphemeraId)[1]) as any,
            fileURL: item.fileURL,
            Connected: false,
            ConnectionIds: [],
            RoomId: 'VORTEX'
        }

    }
    if (isEphemeraActionId(EphemeraId) && isNormalAction(item)) {
        return {
            key: item.key,
            EphemeraId,
            src: item.src
        }    
    }
    if (isEphemeraVariableId(EphemeraId) && isNormalVariable(item)) {
        return {
            key: item.key,
            EphemeraId,
            default: item.default
        }
    }
    if (isEphemeraComputedId(EphemeraId) && isNormalComputed(item)) {
        return {
            key: item.key,
            EphemeraId,
            src: item.src,
            dependencies: item.dependencies
                .map((key) => ({
                    key,
                    EphemeraId: (assetWorkspace.namespaceIdToDB[key] || '')
                }))
        }
    }
    console.log(`WARNING: Unknown combination of types in cacheAsset:  NormalItem with tag '${item.tag}' and Ephemera wrapper: '${splitType(EphemeraId)[0]}'`)
    return undefined
}


export const pushEphemera = async({
    EphemeraId,
    scopeMap = {}
}: EphemeraPushArgs) => {
    await ephemeraDB.putItem<EphemeraPushArgs & { DataCategory: 'Meta::Asset' }>({
        EphemeraId,
        DataCategory: 'Meta::Asset',
        scopeMap
    })
}

export const pushCharacterEphemera = async (character: EphemeraCharacter) => {
    const updateKeys: (keyof EphemeraCharacter)[] = ['address', 'Pronouns', 'FirstImpression', 'OneCoolThing', 'Outfit', 'fileURL', 'Color']
    await ephemeraDB.optimisticUpdate({
        key: {
            EphemeraId: character.EphemeraId,
            DataCategory: 'Meta::Character'
        },
        updateKeys: [...updateKeys, '#name'],
        ExpressionAttributeNames: {
            '#name': 'Name'
        },
        updateReducer: (draft) => {
            draft.Name = character.Name
            updateKeys.forEach((key) => {
                draft[key] = character[key]
            })
        },
    })
}

//
// TODO: Extend cacheAsset to also cache characters where needed
//
export const cacheAssetMessage = async ({ payloads, messageBus }: { payloads: CacheAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    //
    // To avoid race conditions, Cache payloads are currently evaluated sequentially
    //
    for (const { address, options } of payloads) {
        const { check = false, recursive = false, forceCache = false } = options

        const assetWorkspace = new AssetWorkspace(address)
        await assetWorkspace.loadJSON()
        //
        // Process file if an Asset
        //
        const assetItem = Object.values(assetWorkspace.normal || {}).find(isNormalAsset)
        if (assetItem) {
            if (check) {
                const assetEphemeraId = assetWorkspace.namespaceIdToDB[assetItem.key] || ''
                if (!assetEphemeraId) {
                    continue
                }
                const { EphemeraId = null } = await ephemeraDB.getItem<{ EphemeraId: string }>({
                    EphemeraId: assetEphemeraId,
                    DataCategory: 'Meta::Asset',
                }) || {}
                if (Boolean(EphemeraId)) {
                    continue
                }
            }
        
            //
            // Instanced stories are not directly cached, they are instantiated ... so
            // this would be a miscall, and should be ignored.
            //
            if (assetItem.instance) {
                continue
            }
            const assetId = assetItem.key
        
            const ephemeraExtractor = ephemeraItemFromNormal(assetWorkspace)
            const ephemeraItems: EphemeraItem[] = Object.values(assetWorkspace.normal || {})
                .map(ephemeraExtractor)
                .filter((value: EphemeraItem | undefined): value is EphemeraItem => (Boolean(value)))
        
            const stateSynthesizer = new StateSynthesizer(assetWorkspace, messageBus)
        
            await Promise.all([
                putAssetNormalized({ assetId, normalForm: ephemeraItems }),
                mergeIntoEphemera(assetId, ephemeraItems)
            ])
        
            stateSynthesizer.sendDependencyMessages()

            await Promise.all([
                pushEphemera({
                    EphemeraId: AssetKey(assetItem.key),
                    scopeMap: assetWorkspace.namespaceIdToDB
                })
            ])
        }

        //
        // Process file if a Character
        //
        const characterItem = Object.values(assetWorkspace.normal || {}).find(isNormalCharacter)
        if (characterItem) {
            const ephemeraItem = ephemeraItemFromNormal(assetWorkspace)(characterItem)
            if (ephemeraItem) {
                await pushCharacterEphemera(ephemeraItem as EphemeraCharacter)
            }
        }
    }

}
