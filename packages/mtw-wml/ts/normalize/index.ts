import { produce } from 'immer'
import { ParseException } from '../parser/baseClasses';
import {
    isSchemaExit,
    isSchemaWithKey,
    SchemaActionTag,
    SchemaAssetTag,
    SchemaCharacterTag,
    SchemaComputedTag,
    SchemaConditionTag,
    SchemaTaggedMessageLegalContents,
    SchemaFeatureTag,
    SchemaImageTag,
    SchemaImportTag,
    SchemaMapTag,
    SchemaRoomTag,
    SchemaStoryTag,
    SchemaTag,
    SchemaVariableTag,
    SchemaWithKey,
    SchemaBookmarkTag,
    SchemaMessageTag,
    isSchemaImage,
    SchemaException,
    SchemaMomentTag,
    isSchemaImport,
    SchemaKnowledgeTag,
    isImportableTag,
    isSchemaExport,
    isSchemaRoom,
    isImportable,
    isSchemaLink,
    isSchemaCondition,
    isSchemaComputed
} from '../simpleSchema/baseClasses'
import {
    BaseAppearance,
    ComponentRenderItem,
    isNormalAsset,
    isNormalBookmark,
    isNormalCharacter,
    isNormalComputed,
    isNormalCondition,
    isNormalExit,
    isNormalFeature,
    isNormalImport,
    isNormalKnowledge,
    isNormalMap,
    isNormalMessage,
    isNormalReference,
    isNormalRoom,
    MapAppearance,
    MessageAppearance,
    NormalAction,
    NormalAsset,
    NormalBookmark,
    NormalCharacter,
    NormalComputed,
    NormalCondition,
    NormalFeature,
    NormalForm,
    NormalImage,
    NormalImport,
    NormalItem,
    NormalizeKeyMismatchError,
    NormalizeTagMismatchError,
    NormalKnowledge,
    NormalMap,
    NormalMessage,
    NormalMoment,
    NormalReference,
    NormalRoom,
    NormalVariable
} from './baseClasses'
import { compressIfKeys, keyForIfValue, keyForValue } from './keyUtil';
import SourceStream from '../parser/tokenizer/sourceStream';
import { WritableDraft } from 'immer/dist/internal';
import { objectFilterEntries, objectMap } from '../lib/objects';
import { schemaFromParse, defaultSchemaTag } from '../simpleSchema';
import parse from '../simpleParser';
import tokenizer from '../parser/tokenizer';
import { buildNormalPlaceholdersFromExport, rebuildContentsFromImport } from './importExportUtil';
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered } from '../sequence/tree/baseClasses';
import mergeSchemaTrees from '../simpleSchema/treeManipulation/merge';
import { extractConditionedItemFromContents } from '../simpleSchema/utils';
import SchemaTagTree from '../tagTree/schema';
import { map } from '../sequence/tree/map';

export type SchemaTagWithNormalEquivalent = SchemaWithKey | SchemaImportTag | SchemaConditionTag

const isSchemaTagWithNormalEquivalent = (node: SchemaTag): node is SchemaTagWithNormalEquivalent => (
    isSchemaWithKey(node) || (['Import', 'If'].includes(node.tag))
)

type NormalizerContext = {
    contextStack: NormalReference[];
    index?: number;
}

type NormalizeTagTranslationMap = Record<string, "Asset" | "Image" | "Variable" | "Computed" | "Action" | "Import" | "If" | "Exit" | "Map" | "Room" | "Feature" | "Knowledge" | "Bookmark" | "Character" | "Message" | "Moment" | "After" | "Before" | "Replace">

type RenameItemOptions = {
    updateExports?: boolean;
}

export const componentRenderToSchemaTaggedMessage = (renderItem: ComponentRenderItem): SchemaTaggedMessageLegalContents => {
    switch(renderItem.tag) {
        case 'Condition':
            return {
                tag: 'If',
                conditions: renderItem.conditions,
            }
        case 'Link':
            return {
                tag: 'Link',
                to: renderItem.to,
                text: renderItem.text
            }
        case 'Bookmark':
            return {
                tag: 'Bookmark',
                key: renderItem.to,
            }
        case 'LineBreak':
            return {
                tag: 'br'
            }
        case 'Space':
            return {
                tag: 'Space'
            }
        case 'String':
            return {
                tag: 'String',
                value: renderItem.value
            }
        case 'After':
        case 'Before':
        case 'Replace':
            return {
                tag: renderItem.tag,
            }
    }
}

export type NormalizerInsertPosition = {
    contextStack: NormalReference[];
    index?: number;
    replace?: boolean;
}

export class Normalizer {
    _normalForm: NormalForm = {};
    _tags: NormalizeTagTranslationMap = {}

    constructor() {}

    _lookupAppearance(reference: NormalReference): BaseAppearance | undefined {
        return this._normalForm?.[reference.key]?.appearances?.[reference.index]
    }

    _updateAppearance(reference: NormalReference, update: (draft: WritableDraft<BaseAppearance>) => void): void {
        if (this._lookupAppearance(reference)) {
            this._normalForm = { ...produce(this._normalForm, (draft) => {
                const draftAppearance = draft[reference.key]?.appearances?.[reference.index]
                if (!draftAppearance) {
                    throw new Error(`No matching appearance on _updateAppearance (${reference.key} x ${reference.index})`)
                }
                update(draftAppearance)
            })}
        }
    }

    _referenceToInsertPosition(reference: NormalReference): NormalizerInsertPosition {
        const appearance = this._lookupAppearance(reference)
        if (!appearance) {
            throw new Error('Reference error in Normalizer')
        }
        const parent = appearance.contextStack.length > 0 ? appearance.contextStack.slice(-1)[0] : undefined
        if (parent) {
            const index = (this._normalForm[parent.key]?.appearances?.[parent.index]?.children ?? []).findIndex(({ data }) => (
                isNormalReference(data) && data.key === reference.key && data.index === reference.index
            ))
            if (index === -1) {
                return { contextStack: appearance.contextStack }
            }
            else {
                return {
                    contextStack: appearance.contextStack,
                    index,
                    replace: true
                }
            }
        }
        else {
            //
            // TODO: Refactor NormalForm to usefully remember the order in which multiple top-level elements are stored,
            // without counting on the current restriction of only one top-level element per asset
            //
            return {
                contextStack: [],
                index: 0,
                replace: true
            }
        }
    }

    _insertPositionToReference(position: NormalizerInsertPosition): NormalReference | undefined {
        if (typeof position.index !== 'number') {
            return undefined
        }
        const parent = this._getParentReference(position.contextStack)
        if (!parent) {
            const index = (this.rootNode?.appearances ?? []).findIndex(({ contextStack }) => (contextStack.length === 0))
            if (!this.rootNode || index === -1) {
                return undefined
            }
            return {
                key: this.rootNode.key,
                tag: this.rootNode.tag,
                index
            }
        }
        const parentAppearance = this._lookupAppearance(parent)
        if (!parentAppearance) {
            throw new Error('Reference error in Normalizer')
        }
        const returnValue = parentAppearance.children[position.index].data
        if (isNormalReference(returnValue)) {
            return returnValue
        }
        return undefined
    }

    _insertPositionSortOrder(locationA: NormalizerInsertPosition | NormalReference, locationB: NormalizerInsertPosition | NormalReference): number {
        const isInsertPosition = (value: NormalizerInsertPosition | NormalReference): value is NormalizerInsertPosition => ('contextStack' in value)
        const positionA = isInsertPosition(locationA) ? locationA : this._referenceToInsertPosition(locationA)
        const positionB = isInsertPosition(locationB) ? locationB : this._referenceToInsertPosition(locationB)
        const firstIndexA = positionA.contextStack.length
            ? (this._referenceToInsertPosition(positionA.contextStack[0]) ?? { index: -1 }).index
            : positionA.index
        const firstIndexB = positionB.contextStack.length
            ? (this._referenceToInsertPosition(positionB.contextStack[0]) ?? { index: -1 }).index
            : positionB.index
        if (typeof firstIndexA === 'undefined' && typeof firstIndexB === 'undefined') {
            return 0
        }
        if (typeof firstIndexA === 'undefined') {
            return 1
        }
        if (typeof firstIndexB === 'undefined') {
            return -1
        }
        if (firstIndexA !== firstIndexB) {
            return firstIndexA - firstIndexB
        }
        else {
            if (positionA.contextStack.length === 0) {
                if (positionB.contextStack.length === 0) {
                    //
                    // As both positions reference the same place exactly,
                    // the only question now is whether one of them references
                    // *before* that element, while the other references the element
                    // itself
                    //
                    if (positionA.replace && !(positionB.replace)) {
                        return 1
                    }
                    if (positionB.replace && !(positionA.replace)) {
                        return -1
                    }
                    return 0
                }
                else {
                    return -1
                }
            }
            if (positionB.contextStack.length === 0) {
                return 1
            }
            return this._insertPositionSortOrder(
                {
                    contextStack: positionA.contextStack.slice(1),
                    index: positionA.index,
                    replace: positionA.replace
                },
                {
                    contextStack: positionB.contextStack.slice(1),
                    index: positionB.index,
                    replace: positionB.replace
                }
            )
        }
    }

    _getParentReference(context: NormalReference[]): NormalReference | undefined {
        if (context.length) {
            return context.slice(-1)[0]
        }
        else {
            return undefined
        }
    }

    _mergeAppearance(key: string, item: NormalItem, position: NormalizerInsertPosition): number {
        if (key in this._normalForm) {
            const tag = this._normalForm[key].tag
            //
            // When position is provided, compare against existing appearances (if any) in order
            // to find the right place to splice the new entry into the list, and then reindex all of
            // the later appearances
            //
            const insertBefore = (this._normalForm[key]?.appearances ?? []).findIndex((_, index) => (
                this._insertPositionSortOrder(position, { key, index, tag }) <= 0
            ))
            //
            // If the insert is happening in the middle of the appearances, first shift all indexes occur after the
            // insertion point upwards by one, and reindex them.  Place an undefined entry as a placeholder, to be
            // replaced later
            //
            if (insertBefore !== -1) {
                this._normalForm = produce(this._normalForm, (draft) => {
                    const appearances = draft[key]?.appearances
                    if (!appearances) {
                        throw new Error('Lookup failure in _mergeAppearance')
                    }
                    appearances.splice(insertBefore, 0, undefined as any)
                })
                const appearances = this._normalForm[key].appearances ?? []
                const tag = this._normalForm[key].tag
                appearances.forEach((_, index) => {
                    if (index > insertBefore) {
                        this._reindexReference({ key, tag, index }, { fromIndex: index - 1 })
                    }
                })
            }
            this._normalForm = produce(this._normalForm, (draft) => {
                const appearances = draft[key].appearances
                if (!appearances) {
                    throw new Error('Appearance error in _mergeAppearance')
                }
                if (draft[key].tag !== item.tag) {
                    throw new NormalizeTagMismatchError(`Item "${key}" is defined with conflict tags `)
                }
                const newAppearance = item.appearances?.[0]
                if (!newAppearance) {
                    throw new Error('Appearance error in _mergeAppearance')
                }
                if (insertBefore === -1) {
                    appearances.push(newAppearance as any)
                }
                else {
                    appearances.splice(insertBefore, 1, newAppearance)
                }
            })
            return insertBefore > -1 ? insertBefore : (this._normalForm[key]?.appearances ?? []).length - 1
        }
        else {
            this._normalForm = produce(this._normalForm, (draft) => {
                const newAppearance = item.appearances?.[0]
                if (!newAppearance) {
                    throw new Error('Appearance error in _mergeAppearance')
                }
                draft[key] = {
                    ...item,
                    appearances: [newAppearance]
                } as NormalItem
            })
            return 0
        }
    }

    //
    // _recalculateDenormalizedFields fills in fields that are denormalized (during Schema creation) from the contents
    // of the element (e.g. the "rooms" property on a Map tag)
    //
    _recalculateDenormalizedFields(reference: NormalReference): void {
        const { key, index: appearance } = reference
        if (!(key in this._normalForm)) {
            throw new NormalizeKeyMismatchError(`Key "${key}" does not match any tag in asset`)
        }
        if (appearance >= (this._normalForm[key]?.appearances ?? []).length) {
            throw new NormalizeKeyMismatchError(`Illegal appearance referenced on key "${key}"`)
        }
        switch(this._normalForm[key].tag) {
            case 'Map':
                this._normalForm = produce(this._normalForm, (draft) => {
                    const mapItem = draft[key]
                    if (isNormalMap(mapItem)) {
                        const appearanceData = mapItem.appearances[appearance]
                        if (!appearanceData) {
                            throw new Error('Appearance error in _recalculateDenormalizedFields')
                        }        
                        appearanceData.rooms = extractConditionedItemFromContents({
                            children: this._expandNormalRefTree(appearanceData.children),
                            typeGuard: isSchemaRoom,
                            transform: ({ key, x, y }) => {
                                if (typeof x === 'undefined' || typeof y === 'undefined') {
                                    throw new Error('No position specified in Map _recalculateDenormalizedFields')
                                }
                                return {
                                    conditions: [],
                                    key,
                                    x,
                                    y
                                }
                            }
                        })
                    }
                })
                break
            case 'Character':
                this._normalForm = produce(this._normalForm, (draft) => {
                    const characterItem = draft[key]
                    if (isNormalCharacter(characterItem)) {
                        characterItem.images = [...(new Set(characterItem.appearances.reduce<string[]>((previous, { children }) => ([
                            ...previous,
                            ...this._expandNormalRefTree(children)
                                .map(({ data }) => (data))
                                .filter(isSchemaImage)
                                .map(({ key }) => (key))
                        ]), [])))]
                        characterItem.assets = [...(new Set(characterItem.appearances.reduce<string[]>((previous, { children }) => ([
                            ...previous,
                            ...this._expandNormalRefTree(children)
                                .map(({ data }) => (data))
                                .filter(isSchemaImport)
                                .map(({ key }) => {
                                    if (!key) { return undefined }
                                    const importItem = this._normalForm[key]
                                    if (isNormalImport(importItem)) {
                                        return importItem.from
                                    }
                                    else {
                                        return undefined
                                    }
                                })
                                .filter((value: string | undefined): value is string => (typeof value !== 'undefined'))
                        ]), [])))]
                    }
                })
                break
        }
    }

    //
    // TODO: Figure out how to recalculate properties that are derived from children (or further ancestors)
    // when the contents of an item are changed (e.g. recalculate rooms on Map when a room is added or
    // removed)
    //
    _updateAppearanceContents(key: string, appearance: number, children: GenericTree<NormalReference | SchemaTag>): void {
        if (!(key in this._normalForm)) {
            throw new NormalizeKeyMismatchError(`Key "${key}" does not match any tag in asset`)
        }
        if (appearance >= (this._normalForm[key]?.appearances ?? []).length) {
            throw new NormalizeKeyMismatchError(`Illegal appearance referenced on key "${key}"`)
        }
        this._normalForm = { ...produce(this._normalForm, (draft) => {
            const draftAppearance = draft[key]?.appearances?.[appearance]
            if (!draftAppearance) {
                throw new Error(`Appearance mismatch in _updateAppearanceContents`)
            }
            draftAppearance.children = children
        }) }
        const referencesNeedingRecalculation = [ { key, tag: this._normalForm[key].tag, index: appearance }, ...[ ...(this._normalForm[key]?.appearances?.[appearance]?.contextStack ?? []) ].reverse()]
        referencesNeedingRecalculation.forEach((itemRef) => {
            this._recalculateDenormalizedFields(itemRef)
        })
}

    //
    // _reindexReference accepts a NormalReference and walks down all of its content tree,
    // updating the contextStack entries of each appearance to make sure that they reflect
    // the correct (e.g. updated) reference
    //

    _reindexReference(reference: NormalReference, options?: { contextStack?: NormalReference[], fromIndex?: number }): void {
        const { contextStack, fromIndex } = options ?? {}
        const appearance = this._lookupAppearance(reference)
        if (!appearance) {
            throw new Error('Appearance mismatch in _reindexReference')
        }
        const parent = this._getParentReference(contextStack || appearance.contextStack)
        if (appearance) {
            if (contextStack) {
                this._updateAppearance(reference, (draft) => {
                    draft.contextStack = contextStack
                })
            }
            if (typeof fromIndex === 'number' && parent) {
                this._updateAppearance(parent, (draft) => {
                    const appearanceIndex = draft.children.map(({ data }) => (data)).findIndex((data) => (isNormalReference(data) && data.key === reference.key && data.index === fromIndex))
                    const data = draft.children[appearanceIndex].data
                    if (isNormalReference(data)) {
                        data.index = reference.index
                    }
                })
            }
            const { children } = appearance
            const newContextStack = [ ...(contextStack || appearance.contextStack), reference ]
            children
                .map(({ data }) => (data))
                .forEach((contentReference) => {
                    if (isNormalReference(contentReference)) {
                        this._reindexReference(contentReference, { contextStack: newContextStack })
                    }
                })
        }
    }

    renameItem(fromKey: string, toKey: string, options?: RenameItemOptions): void {
        const { updateExports = false } = options || {}
        const appearances = this._normalForm[fromKey]?.appearances || []
        this._normalForm = { ...this._normalForm, [toKey]: {
            ...this._normalForm[fromKey],
            key: toKey,
            ...(updateExports ? { exportAs: this._normalForm[fromKey]?.exportAs ?? fromKey } : {}),
            appearances: appearances.map(({ data, ...rest }) => {
                if (isSchemaWithKey(data)) {
                    return {
                        data: { ...data, key: toKey },
                        ...rest
                    }
                }
                else {
                    return { data, ...rest }
                }
            })
        } } as NormalForm
        const tag = this._normalForm[toKey].tag
        appearances.forEach(({ contextStack }, index) => {
            //
            // Change references for all parents that have this key in their contents
            //
            if (contextStack.length > 0) {
                const parent = contextStack.slice(-1)[0]
                this._updateAppearance(parent, (draft) => {
                    draft.children.forEach(({ data }) => {
                        if (isNormalReference(data) && data.key === fromKey) {
                            data.key = toKey
                        }
                    })
                })
            }

            //
            // Change references for all descendants that have this key in their contextStack
            //
            this._reindexReference({ key: toKey, index, tag }, { contextStack })
        })
        //
        // A list of all key type properties that refer from one item to
        // another (e.g. to/from for EXIT, to for LINK):
        //    - Link:To
        //    - Bookmark:To
        //    - Map:Appearance:Rooms
        //    - Exit:To
        //    - Exit:From
        //    - Computed:Dependencies
        //    - Condition:Dependencies
        //    - Message:Appearance:Rooms
        //    - Moment:Appearance:Messages

        //
        // First, outside of Immer, rename all exits that have the fromKey as either
        // their from or to property
        //
        Object.values(this._normalForm)
            .filter(isNormalExit)
            .filter(({ to, from }) => ([to, from].includes(fromKey)))
            .forEach((item) => {
                const [newTo, newFrom] = [
                    item.to === fromKey ? toKey : item.to,
                    item.from === fromKey ? toKey: item.from
                ]
                this._normalForm[item.key] = {
                    ...item,
                    to: newTo,
                    from: newFrom,
                    appearances: (this._normalForm[item.key]?.appearances ?? []).map((appearance) => {
                        const { data, children } = appearance
                        if (isSchemaExit(data)) {
                            return {
                                ...appearance,
                                data: {
                                    ...data,
                                    to: newTo,
                                    from: newFrom
                                },
                                children
                            }
                        }
                        else {
                            return appearance
                        }
                    })
                }
                this.renameItem(item.key, `${newFrom}#${newTo}`)
            })

        //
        // Next use immer to create an immutable derivative of the original normalForm,
        // with differences of every non-exit property value (i.e., properties that can
        // be changed in place within a record)
        //
        this._normalForm = produce(this._normalForm, (draft) => {
            Object.values(draft).forEach((item) => {
                if (isNormalCondition(item)) {
                    item.conditions.forEach((condition, index) => {
                        if ((condition.dependencies ?? []).includes(fromKey)) {
                            condition.dependencies = (condition.dependencies ?? []).filter((dependency) => (dependency !== fromKey))
                        }
                    })
                }
                if (isNormalComputed(item)) {
                    if ((item.dependencies ?? []).includes(fromKey)) {
                        item.dependencies = (item.dependencies ?? []).filter((dependency) => (dependency !== fromKey))
                    }
                }
                if (isNormalRoom(item) || isNormalFeature(item) || isNormalKnowledge(item) || isNormalBookmark(item)) {
                    item.appearances.forEach((appearance) => {
                        const renameChildren = (tree: GenericTree<NormalReference | SchemaTag>): void => {
                            tree.forEach(({ data, children }) => {
                                if (!isNormalReference(data) && isSchemaLink(data) && (data.to === fromKey)) {
                                    data.to = toKey
                                }
                                renameChildren(children)
                            })
                        }
                        renameChildren(appearance.children)
                    })
                }
                if (isNormalMap(item) || isNormalMessage(item)) {
                    item.appearances.forEach((appearance) => {
                        const roomToRename = appearance.rooms.findIndex(({ key }) => (key === fromKey))
                        if (roomToRename !== -1) {
                            appearance.rooms[roomToRename].key = toKey
                        }
                    })
                }
            })
        })
        //
        // TODO: Search all normal items for such references to the key being
        // remapped, and update them accordingly (should be a data-only change,
        // and not need sophisticated structure changes like above).
        //
        // TODO: Add an exportAs property to the original key (if it does not already
        // have one) to point to fromKey.
        //
        this._normalForm = objectFilterEntries(this._normalForm, ([key]) => (key !== fromKey))
    }

    //
    // _renameAllConditions takes an altered normal form (e.g., one in which a condition
    // has been removed, leaving a gap in the naming sequence) and compresses all of the
    // synthetic keys, reassigning where necessary.
    //
    _renameAllConditions(): void {
        const conditionItems: NormalCondition[] = Object.values(this._normalForm)
            .filter(isNormalCondition)
            .sort(({ key: keyA }, { key: keyB }) => {
                const indexA = parseInt(keyA.slice(3))
                const indexB = parseInt(keyB.slice(3))
                return indexA - indexB
            })
        compressIfKeys(conditionItems.map(({ key }) => (key)))
        conditionItems.forEach(({ key, conditions }) => {
            const newKey = keyForIfValue(conditions)
            if (key !== newKey) {
                this.renameItem(key, newKey)
            }
        })
    }

    _validateTags({ data: node, children }: GenericTreeNode<SchemaTag>): void {
        if (!isSchemaTagWithNormalEquivalent(node)) {
            return
        }
        let tagToCompare = node.tag
        let keyToCompare = node.key
        if (!keyToCompare) {
            return
        }
        switch(node.tag) {
            case 'Story':
                tagToCompare = 'Asset'
                break
            case 'Import':
                keyToCompare = keyForValue('Import', node.from)
                break
            case 'If':
                keyToCompare = keyForIfValue(node.conditions)
                break
        }
        if (this._tags[keyToCompare] && this._tags[keyToCompare] !== tagToCompare) {
            throw new NormalizeTagMismatchError(`Key '${keyToCompare}' is used to define elements of different tags ('${this._tags[keyToCompare]}' and '${tagToCompare}')`)
        }
        if (!(keyToCompare in this._tags)) {
            this._tags[keyToCompare] = tagToCompare as NormalItem["tag"]
        }
        children.forEach(this._validateTags.bind(this))

        if (node.tag === 'Import') {
            Object.entries(node.mapping).forEach(([key, { type }]) => {
                if (this._tags[key] && this._tags[key] !== type) {
                    throw new NormalizeTagMismatchError(`Key '${key}' is used to define elements of different tags ('${this._tags[key]}' and '${type}')`)
                }
                if (!(key in this._tags)) {
                    this._tags[key] = type
                }
            })
        }
    }

    //
    // _translate:  A cross-talk function between Schema types and Normal types, for the cases where they map
    //              one-to-one as they are added.  Does some preliminary translation of appearances based
    //              on what is now known about the mapping of keys to tags
    //
    _translate(appearance: BaseAppearance, node: SchemaAssetTag): NormalAsset
    _translate(appearance: BaseAppearance, node: SchemaStoryTag): NormalAsset
    _translate(appearance: BaseAppearance, node: SchemaImageTag): NormalImage
    _translate(appearance: BaseAppearance, node: SchemaVariableTag): NormalVariable
    _translate(appearance: BaseAppearance, node: SchemaComputedTag): NormalComputed
    _translate(appearance: BaseAppearance, node: SchemaActionTag): NormalAction
    _translate(appearance: BaseAppearance, node: SchemaConditionTag): NormalCondition
    _translate(appearance: BaseAppearance, node: SchemaImportTag): NormalImport
    _translate(appearance: BaseAppearance, node: SchemaRoomTag): NormalRoom
    _translate(appearance: BaseAppearance, node: SchemaFeatureTag): NormalFeature
    _translate(appearance: BaseAppearance, node: SchemaKnowledgeTag): NormalKnowledge
    _translate(appearance: BaseAppearance, node: SchemaBookmarkTag): NormalBookmark
    _translate(appearance: BaseAppearance, node: SchemaMessageTag): NormalMessage
    _translate(appearance: BaseAppearance, node: SchemaMomentTag): NormalMoment
    _translate(appearance: BaseAppearance, node: SchemaMapTag): NormalMap
    _translate(appearance: BaseAppearance, node: SchemaCharacterTag): NormalCharacter
    _translate(appearance: BaseAppearance, node: SchemaTagWithNormalEquivalent): NormalItem
    _translate(appearance: BaseAppearance, node: SchemaTagWithNormalEquivalent): NormalItem {
        //
        // Create a defaultKey item by taking the node.tag and appending successive integers to it
        // until there is no match of key or exportAs
        //
        const allKeys = Object.values(this._normalForm).map(({ key, exportAs }) => ([
            key,
            ...(exportAs ? [exportAs] : [])
        ])).flat(1)
        let defaultKeyIndex = 1
        while(allKeys.includes(`${node.tag}${defaultKeyIndex}`)) {
            defaultKeyIndex++
        }
        const defaultKey = `${node.tag}${defaultKeyIndex}`
        const { data } = appearance
        const defaultedAppearance = isSchemaWithKey(data) ? { ...appearance, data: { ...data, key: data.key || defaultKey } } : appearance
        switch(node.tag) {
            case 'Asset':
                return {
                    key: node.key,
                    tag: 'Asset',
                    instance: false,
                    Story: false,
                    fileName: node.fileName,
                    zone: node.zone,
                    appearances: [appearance]
                }
            case 'Story':
                return {
                    key: node.key,
                    tag: 'Asset',
                    instance: node.instance,
                    Story: true,
                    fileName: node.fileName,
                    zone: node.zone,
                    appearances: [appearance]
                }
            case 'Image':
                return {
                    key: node.key || defaultKey,
                    tag: 'Image',
                    appearances: [defaultedAppearance]
                }
            case 'Variable':
                return {
                    key: node.key || defaultKey,
                    tag: 'Variable',
                    default: node.default ?? '',
                    appearances: [defaultedAppearance]
                }
            case 'Computed':
                return {
                    key: node.key || defaultKey,
                    tag: 'Computed',
                    src: node.src,
                    dependencies: node.dependencies,
                    appearances: [defaultedAppearance]
                }
            case 'Action':
                return {
                    key: node.key || defaultKey,
                    tag: 'Action',
                    src: node.src,
                    appearances: [defaultedAppearance]
                }
            case 'If':
                return {
                    key: keyForIfValue(node.conditions),
                    tag: 'If',
                    conditions: node.conditions,
                    appearances: [appearance]
                }
            case 'Import':
                return {
                    key: keyForValue('Import', node.from),
                    tag: 'Import',
                    from: node.from,
                    mapping: node.mapping,
                    appearances: [appearance]
                }
            case 'Room':
            case 'Feature':
            case 'Knowledge':
                return {
                    key: node.key || defaultKey,
                    tag: node.tag,
                    appearances: [defaultedAppearance]
                }
            case 'Bookmark':
                return {
                    key: node.key || defaultKey,
                    tag: node.tag,
                    appearances: [defaultedAppearance]
                }
            case 'Message':
                return {
                    key: node.key || defaultKey,
                    tag: node.tag,
                    appearances: [{
                        ...defaultedAppearance as MessageAppearance,
                        rooms: node.rooms
                    }]
                }
            case 'Moment':
                return {
                    key: node.key || defaultKey,
                    tag: node.tag,
                    appearances: [{
                        ...defaultedAppearance,
                        //
                        // TODO: Create message selector if denormalization needed
                        //
                        messages: []
                    }]
                }
            case 'Map':
                return {
                    key: node.key || defaultKey,
                    tag: node.tag,
                    appearances: [{
                        ...defaultedAppearance,
                        rooms: node.rooms,
                        images: node.images,
                    }] as MapAppearance[]
                }
            case 'Exit':
                const exitRoomIndex = appearance.contextStack.reduceRight((previous, { tag }, index) => (((tag === 'Room') && (previous === -1)) ? index : previous), -1)
                if (exitRoomIndex === -1) {
                    throw new SchemaException('Exit tag cannot be created outside of room', { tag: 'Exit', to: '', from: '', contents: [], name: '', startTagToken: 0, endTagToken: 0 })
                }

                const exitRoomKey = appearance.contextStack[exitRoomIndex].key
                return {
                    key: node.key,
                    tag: node.tag,
                    to: node.to,
                    from: exitRoomKey,
                    name: node.name,
                    appearances: [appearance]
                }
            case 'Character':
                return {
                    key: node.key,
                    tag: node.tag,
                    Name: node.Name,
                    Pronouns: node.Pronouns,
                    FirstImpression: node.FirstImpression ?? '',
                    OneCoolThing: node.OneCoolThing ?? '',
                    Outfit: node.Outfit ?? '',
                    fileName: node.fileName,
                    //
                    // TODO: Create a selector for images
                    //
                    images: [],
                    //
                    // TODO: Create a selector for asset imports
                    //
                    assets: [],
                    appearances: [appearance]
                }
            // default:
            //     throw new NormalizeTagMismatchError(`Tag "${node.tag}" mistakenly processed in normalizer`)
        }
    }

    _loadSchemaHelper(schema: GenericTree<SchemaTag>, options?: { contextStack: (NormalReference | SchemaTag)[] }): GenericTree<NormalReference | SchemaTag> {
        const returnValue = schema.map((node) => {
            const { data, children, ...rest } = node
            //
            // SchemaExportTag encodes its changes throughout the normalForm, rather than creating any normal Item
            // of its own.
            //
            if (isSchemaExport(data)) {
                const exportPlaceholder = buildNormalPlaceholdersFromExport(data)
                this._normalForm = produce(this._normalForm, (draft) => {
                    exportPlaceholder.forEach((item) => {
                        if (item.key in draft) {
                            if (item.exportAs) {
                                draft[item.key].exportAs = item.exportAs
                            }
                        }
                        else {
                            draft[item.key] = item
                        }
                    })
                })
                return []
            }

            if (isSchemaTagWithNormalEquivalent(data) && (!(isSchemaCondition(data) && (options?.contextStack ?? []).find(({ tag }) => (['Name', 'Description'].includes(tag)))))) {
                const translatedData = this._translate(
                    { ...node, contextStack: (options?.contextStack ?? []).filter(isNormalReference) },
                    data
                )
                const { key } = translatedData
                if (!(key in this._normalForm)) {
                    this._normalForm[key] = {
                        ...translatedData,
                        appearances: []
                    }
                }
                this._normalForm[key].appearances = [
                    ...(this._normalForm?.[key]?.appearances ?? []),
                    translatedData.appearances?.[0] as any
                ]
                if (this._tags[key] && this._tags[key] !== translatedData.tag) {
                    throw new NormalizeTagMismatchError(`Key '${key}' is used to define elements of different tags ('${this._tags[key]}' and '${translatedData.tag}')`)
                }
                this._tags[key] = translatedData.tag
                const index = (this._normalForm[key].appearances ?? []).length - 1
                const appearance = this._normalForm[key].appearances?.[index]
                if (typeof appearance === 'undefined') {
                    throw new Error('Appearance mismatch in loadSchema')
                }
                const reference: GenericTreeNodeFiltered<NormalReference, SchemaTag> = {
                    data: {
                        tag: data.tag,
                        key,
                        index    
                    },
                    children: [],
                    ...rest
                }
                this._normalForm[key].appearances = [
                    ...(this._normalForm[key].appearances ?? []).slice(0, -1),
                    {
                        ...appearance,
                        children: this._loadSchemaHelper(children, { contextStack: [...options?.contextStack ?? [], reference.data] })
                    } as any
                ]
                return [reference]
            }
            else {
                return [{
                    data,
                    children: this._loadSchemaHelper(children, { contextStack: [...options?.contextStack ?? [], data] }),
                    ...rest
                }]
            }
        }).flat(1)
        return returnValue
    }

    loadSchema(schema: GenericTree<SchemaTag>): void {
        this._normalForm = {}
        this._tags = {}
        //
        // TEMPORARY PROVISION:  Until there's a proper architecture for having multiple
        // assets defined in the same WML file, throw an exception here if a multi-asset
        // file is encountered.
        //
        if (schema.length > 1) {
            throw new ParseException('Multi-Asset files are not yet implemented', 0, 0)
        }
        this._loadSchemaHelper(schema, { contextStack: [] })
    }

    loadWML(wml: string): void {
        const schema = schemaFromParse(parse(tokenizer(new SourceStream(wml))))
        this.loadSchema(schema)
    }

    loadNormal(normal: NormalForm): void {
        const deepCopy: <T extends any>(value: T) => T = <T>(value) => {
            if (Array.isArray(value)) {
                return [...value.map(deepCopy)]
            }
            else if (typeof value === 'object') {
                return objectMap(value as Record<string, any>, deepCopy) as T
            }
            else return value
        }
        this._normalForm = deepCopy(normal)
        this._tags = Object.values(normal).reduce((previous, { key, tag }) => ({ ...previous, [key]: tag }), {})
    }

    get normal() {
        return this._normalForm
    }

    _expandNormalRefTree(tree: GenericTree<NormalReference | SchemaTag>): GenericTree<SchemaTag> {
        return tree.map(({ data, children }) => {
            if (isNormalReference(data)) {
                const { data: refData, children: refChildren } = this._normalToSchema(data.key, data.index)
                return {
                    data: refData,
                    children: [...this._expandNormalRefTree(children), ...refChildren]
                }
            }
            return {
                data,
                children: this._expandNormalRefTree(children)
            }
        })
    }

    _normalToSchema(key: string, appearanceIndex: number): GenericTreeNode<SchemaTag> {
        const node = this._normalForm[key]
        if (!node || appearanceIndex >= (node.appearances ?? []).length) {
            throw new Error(`No lookup on _normalToSchema (${key} x ${appearanceIndex})`)
        }
        const baseAppearance = this._lookupAppearance({ key, index: appearanceIndex, tag: node.tag })
        if (!baseAppearance) {
           throw new Error(`No lookup on _normalToSchema (${key} x ${appearanceIndex})`)
        }
        let expandedTags: GenericTree<SchemaTag> = []
        if (node.tag === 'Asset') {
            const allAssetDescendantNormals = (Object.values(this._normalForm) as NormalItem[])
                .filter(({ tag }) => (isImportableTag(tag)))
                .filter(({ appearances = [] }) => (Boolean(appearances.find(({ contextStack }) => (contextStack.find(({ key }) => (key === node.key)))))))
                .filter(({ key, exportAs }) => (exportAs && exportAs !== key))
            if (allAssetDescendantNormals.length) {
                expandedTags = [...expandedTags, {
                    data: {
                        tag: 'Export',
                        mapping: Object.assign(
                            {},
                            ...allAssetDescendantNormals.map(({ key, tag, exportAs }) => ({ [exportAs || key]: { key, type: tag }}))
                        )
                    },
                    children: allAssetDescendantNormals.map(({ tag, key, exportAs }) => ({ data: { ...defaultSchemaTag(tag), key, as: exportAs }, children: [] }))
                }]
            }
        }
        const returnData = baseAppearance.data
        return {
            data: isImportable(returnData) ? { ...returnData, from: (returnData.from && returnData.from !== returnData.key) ? returnData.from : undefined } : returnData,
            children: [...this._expandNormalRefTree(baseAppearance.children), ...expandedTags]
        }
    }

    get schema(): GenericTree<SchemaTag> {
        const topLevelAppearances: { key: string; appearanceIndex: number }[] = Object.entries(this._normalForm)
            .reduce<{ key: string; appearanceIndex: number }[]>((previous, [key, { appearances }]) => {
                return (appearances as BaseAppearance[]).reduce<{ key: string; appearanceIndex: number }[]>((accumulator, { contextStack }, index) => (
                        contextStack.length === 0
                            ? [...accumulator, { key, appearanceIndex: index }]
                            : accumulator
                    ), previous)
            }, [])
        return topLevelAppearances.map(({ key, appearanceIndex }) => (this._normalToSchema(key, appearanceIndex)))
    }

    referenceToSchema(reference: NormalReference): GenericTreeNode<SchemaTag> | undefined {
        return this._normalToSchema(reference.key, reference.index)
    }

    select<Output>(args: { key: string; selector: (tree: GenericTree<SchemaTag>, options?: { tag: string, key: string }) => Output }): Output {
        const { key, selector } = args
        const normalItem = this._normalForm[key]
        if (!normalItem) {
            return selector([])
        }
        const appearanceTagTrees = (normalItem.appearances ?? [])
            .map(({ contextStack, data, children }) => {
                const contextNodes = contextStack.map(this._lookupAppearance.bind(this)).map((node) => (node ? [{ data: node.data }] : [])).flat(1)
                return new SchemaTagTree(this._expandNormalRefTree([{ data, children }]))._tagList.map((tagItem) => ([...contextNodes, ...tagItem]))
            }).flat(1)
        const aggregateTagTree = new SchemaTagTree([])
        aggregateTagTree._tagList = appearanceTagTrees
        return selector(aggregateTagTree.tree, { tag: normalItem.tag, key })
    }

    get rootNode(): NormalAsset | NormalCharacter | undefined {
        return Object.values(this._normalForm).filter((node): node is NormalAsset | NormalCharacter => (isNormalAsset(node) || isNormalCharacter(node))).find(({ appearances }) => (appearances.find(({ contextStack }) => (contextStack.length === 0))))
    }

    assignDependencies(extract: (src: string) => string[]) {
        const assignSchema = (tree: GenericTree<SchemaTag | NormalReference>): GenericTree<SchemaTag | NormalReference> => (
            map(tree, (node: GenericTreeNode<SchemaTag | NormalReference>): GenericTree<SchemaTag | NormalReference> => {
                if (isNormalReference(node.data)) {
                    return [node]
                }
                if (isSchemaCondition(node.data)) {
                    return [{
                        ...node,
                        data: {
                            ...node.data,
                            conditions: node.data.conditions.map((condition) => ({ ...condition, dependencies: extract(condition.if) }))
                        }
                    }]
                }
                if (isSchemaComputed(node.data)) {
                    return [{
                        ...node,
                        data: {
                            ...node.data,
                            dependencies: extract(node.data.src),
                        }
                    }]
                }
                return [node]
            })
        )
        const assignNormal = (item: NormalItem): NormalItem => {
            const appearances = (item.appearances ?? []).map(({ data, children, ...rest }) => {
                const { data: newData, children: newChildren } = assignSchema([{ data, children }])[0]
                return { data: newData, children: newChildren, ...rest }
            })
            if (isNormalCondition(item)) {
                const conditions = item.conditions.map((condition) => ({ ...condition, dependencies: extract(condition.if) }))
                return {
                    ...item,
                    conditions,
                    appearances: appearances as BaseAppearance[]
                }
            }
            if (isNormalComputed(item)) {
                const dependencies = extract(item.src)
                return {
                    ...item,
                    dependencies,
                    appearances: appearances as BaseAppearance[]
                }
            }
            return {
                ...item,
                appearances: appearances as any
            }
        }
        this._normalForm = objectMap(
            this._normalForm,
            assignNormal
        )
    }

    clone(): Normalizer {
        const outputNormalizer = new Normalizer()
        outputNormalizer.loadNormal(this.normal)
        return outputNormalizer
    }
    //
    // TODO: Create filter function, to be able to extract in place just the parts
    // of the normalForm that are either parents of or children of items that pass
    // the itemFilter. ALL descendant items of passing children are included.
    //

    //
    // ?TODO?: Refactor filter as a method of schema, not normalize
    //
    filter(args: { itemFilter?: (item: SchemaTag) => boolean }): void {
        const schema = this.schema
    }

    //
    // merge function takes a second normalizer, and merges the contents in place
    //

    //
    // TODO: Refactor merge as a method of schema, not normalize
    //
    merge(incomingNormalizer: Normalizer): void {
        const firstSchema = this.schema
        const secondSchema = incomingNormalizer.schema
        const outputSchema = mergeSchemaTrees(firstSchema, secondSchema)
        this.loadSchema(outputSchema)
    }

}

export default Normalizer
