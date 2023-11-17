import { produce } from 'immer'
import { isLegalParseConditionContextTag, ParseException } from '../parser/baseClasses';
import {
    isSchemaExit,
    isSchemaWithContents,
    isSchemaWithKey,
    SchemaActionTag,
    SchemaAssetTag,
    SchemaCharacterTag,
    SchemaComputedTag,
    SchemaConditionTag,
    SchemaTaggedMessageLegalContents,
    SchemaFeatureTag,
    isSchemaFeatureContents,
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
    SchemaTaggedMessageIncomingContents,
    isSchemaAssetContents,
    isSchemaRoomContents,
    isSchemaTaggedMessageLegalContents,
    isSchemaMessageContents,
    isSchemaMessage,
    isSchemaMapContents,
    isSchemaString,
    isSchemaImportMappingType,
    SchemaImportMapping,
    SchemaException,
    SchemaMomentTag,
    isSchemaImport,
    SchemaConditionMixin,
    SchemaAfterTag,
    SchemaBeforeTag,
    SchemaReplaceTag,
    SchemaKnowledgeTag,
    isSchemaKnowledgeContents,
    SchemaExportTag,
    isImportableTag,
    isSchemaExport
} from '../simpleSchema/baseClasses'
import {
    BaseAppearance,
    ComponentAppearance,
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
    isNormalRoom,
    MapAppearance,
    MessageAppearance,
    MomentAppearance,
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
import standardizeNormal from './standardize';
import { schemaFromParse } from '../simpleSchema';
import parse from '../simpleParser';
import tokenizer from '../parser/tokenizer';
import { buildNormalPlaceholdersFromExport, rebuildContentsFromImport } from './importExportUtil';
import { mergeOrderedConditionalTrees } from '../lib/sequenceTools/orderedConditionalTree';

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

const schemaDescriptionToComponentRender = (translationTags: NormalizeTagTranslationMap) => (renderItem: SchemaTaggedMessageIncomingContents | SchemaTaggedMessageLegalContents): ComponentRenderItem | undefined => {
    if (renderItem.tag === 'If') {
        return {
            tag: 'Condition',
            conditions: renderItem.conditions,
            contents: renderItem.contents.map(schemaDescriptionToComponentRender(translationTags))
        }
    }
    if (renderItem.tag === 'Link') {
        if (!(renderItem.to in translationTags)) {
            throw new NormalizeTagMismatchError(`Link specifies "to" property (${renderItem.to}) with no matching key`)
        }
        const targetTag = translationTags[renderItem.to]
        if (!['Action', 'Feature', 'Knowledge'].includes(targetTag)) {
            throw new NormalizeTagMismatchError(`Link specifies "to" property (${renderItem.to}) referring to an invalid tag (${targetTag})`)
        }
        return {
            tag: 'Link',
            to: renderItem.to,
            text: renderItem.text,
            targetTag: targetTag as 'Action' | 'Feature' | 'Knowledge'
        }
    }
    else if (((item: SchemaTaggedMessageIncomingContents | SchemaTaggedMessageLegalContents): item is SchemaAfterTag | SchemaBeforeTag | SchemaReplaceTag => (['After', 'Before', 'Replace'].includes(renderItem.tag)))(renderItem)) {
        return {
            tag: renderItem.tag,
            contents: renderItem.contents.map(schemaDescriptionToComponentRender(translationTags))
        }
    }
    else if (renderItem.tag === 'Bookmark') {
        return {
            tag: 'Bookmark',
            to: renderItem.key
        }
    }
    else if (renderItem.tag === 'br') {
        return {
            tag: 'LineBreak' as 'LineBreak'
        }
    }
    else if (renderItem.tag === 'Space') {
        return {
            tag: 'Space' as 'Space'
        }
    }
    else if (renderItem.tag === 'String') {
        return {
            tag: 'String' as 'String',
            value: renderItem.value
        }
    }
    else if (renderItem.tag === 'Whitespace') {
        return {
            tag: 'String' as 'String',
            value: ' '
        }
    }
}

export const componentRenderToSchemaTaggedMessage = (renderItem: ComponentRenderItem): SchemaTaggedMessageLegalContents => {
    switch(renderItem.tag) {
        case 'Condition':
            return {
                tag: 'If',
                conditions: renderItem.conditions,
                contents: renderItem.contents
                    .map(componentRenderToSchemaTaggedMessage)
                    .filter((value) => (value))
                    .filter(isSchemaTaggedMessageLegalContents)
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
                contents: []
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
                contents: renderItem.contents
                    .map(componentRenderToSchemaTaggedMessage)
                    .filter((value) => (value))
                    .filter(isSchemaTaggedMessageLegalContents)
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
                update(draft[reference.key].appearances[reference.index])
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
            const index = this._normalForm[parent.key].appearances[parent.index].contents.findIndex(({ key, index }) => (key === reference.key && index === reference.index))
            if (index === -1) {
                throw new Error('Parent lookup error in Normalizer')
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
            const index = this.rootNode.appearances.findIndex(({ contextStack }) => (contextStack.length === 0))
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
        return parentAppearance.contents[position.index]
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
            const insertBefore = this._normalForm[key].appearances.findIndex((_, index) => (
                this._insertPositionSortOrder(position, { key, index, tag }) <= 0
            ))
            //
            // If the insert is happening in the middle of the appearances, first shift all indexes occur after the
            // insertion point upwards by one, and reindex them.  Place an undefined entry as a placeholder, to be
            // replaced later
            //
            if (insertBefore !== -1) {
                this._normalForm = produce(this._normalForm, (draft) => {
                    draft[key].appearances.splice(insertBefore, 0, undefined)
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
                const appearances = draft[key].appearances as any
                if (draft[key].tag !== item.tag) {
                    throw new NormalizeTagMismatchError(`Item "${key}" is defined with conflict tags `)
                }
                const newAppearance = item.appearances[0]
                if (insertBefore === -1) {
                    appearances.push(newAppearance)
                }
                else {
                    appearances.splice(insertBefore, 1, newAppearance)
                }
            })
            return insertBefore > -1 ? insertBefore : this._normalForm[key].appearances.length - 1
        }
        else {
            this._normalForm = produce(this._normalForm, (draft) => {
                draft[key] = {
                    ...item,
                    appearances: [item.appearances[0]]
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
        if (appearance >= this._normalForm[key].appearances.length) {
            throw new NormalizeKeyMismatchError(`Illegal appearance referenced on key "${key}"`)
        }
        //
        // A normalizer-centric version of the utility function from schema/utils, which does the same thing
        // but looks up structures in a normalForm, rather than being provided with them in the schema
        // object
        //
        const extractConditionedItemFromContents = <T extends NormalItem, O extends SchemaConditionMixin>(props: {
            contents: NormalReference[];
            typeGuard: (value: NormalItem) => value is T;
            transform: (value: T, appearanceIndex: number, index: number) => O;
        }): O[] => {
            const { contents, typeGuard, transform } = props
            return contents.reduce<O[]>((previous, reference, index) => {
                const item = this._normalForm[reference.key]
                if (item && typeGuard(item)) {
                    return [
                        ...previous,
                        transform(item, reference.index, index)
                    ]
                }
                if (item && isNormalCondition(item)) {
                    const nestedItems = extractConditionedItemFromContents({ contents: item.appearances[reference.index].contents, typeGuard, transform })
                        .map(({ conditions, ...rest }) => ({
                            conditions: [
                                ...item.conditions,
                                ...conditions
                            ],
                            ...rest
                        })) as O[]
                    return [
                        ...previous,
                        ...nestedItems
                    ]
                }
                return previous
            }, [])
        }
        switch(this._normalForm[key].tag) {
            case 'Map':
                this._normalForm = produce(this._normalForm, (draft) => {
                    const mapItem = draft[key]
                    if (isNormalMap(mapItem)) {
                        const appearanceData = mapItem.appearances[appearance]
                        appearanceData.rooms = extractConditionedItemFromContents({
                            contents: appearanceData.contents,
                            typeGuard: isNormalRoom,
                            transform: ({ key, appearances }, appearanceIndex) => {
                                return {
                                    conditions: [],
                                    key,
                                    x: appearances[appearanceIndex].x,
                                    y: appearances[appearanceIndex].y
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
                        characterItem.images = [...(new Set(characterItem.appearances.reduce<string[]>((previous, { contents }) => ([
                            ...previous,
                            ...contents.filter(({ tag }) => (tag === 'Image'))
                                .map(({ key }) => (key))
                        ]), [])))]
                        characterItem.assets = [...(new Set(characterItem.appearances.reduce<string[]>((previous, { contents }) => ([
                            ...previous,
                            ...contents.filter(({ tag }) => (tag === 'Import'))
                                .map(({ key }) => {
                                    const importItem = this._normalForm[key]
                                    if (isNormalImport(importItem)) {
                                        return importItem.from
                                    }
                                    else {
                                        return undefined
                                    }
                                })
                                .filter((value) => (value))
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
    _updateAppearanceContents(key: string, appearance: number, contents: NormalReference[]): void {
        if (!(key in this._normalForm)) {
            throw new NormalizeKeyMismatchError(`Key "${key}" does not match any tag in asset`)
        }
        if (appearance >= this._normalForm[key].appearances.length) {
            throw new NormalizeKeyMismatchError(`Illegal appearance referenced on key "${key}"`)
        }
        this._normalForm = { ...produce(this._normalForm, (draft) => {
            draft[key].appearances[appearance].contents = contents
        }) }
        const referencesNeedingRecalculation = [ { key, tag: this._normalForm[key].tag, index: appearance }, ...[ ...this._normalForm[key].appearances[appearance].contextStack ].reverse()]
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
        const { contextStack, fromIndex } = options
        const appearance = this._lookupAppearance(reference)
        const parent = this._getParentReference(contextStack || appearance.contextStack)
        if (appearance) {
            if (contextStack) {
                this._updateAppearance(reference, (draft) => {
                    draft.contextStack = contextStack
                })
            }
            if (typeof fromIndex === 'number' && parent) {
                this._updateAppearance(parent, (draft) => {
                    const appearanceIndex = draft.contents.findIndex(({ key, index }) => (key === reference.key && index === fromIndex))
                    draft.contents[appearanceIndex].index = reference.index
                })
            }
            const { contents } = appearance
            const newContextStack = [ ...(contextStack || appearance.contextStack), reference ]
            contents.forEach((contentReference) => {
                this._reindexReference(contentReference, { contextStack: newContextStack })
            })
        }
    }

    //
    // _removeReference accepts a NormalReference and removes it, along with all references
    // in its content tree
    //
    _removeAppearance(reference: NormalReference): void {
        const appearance = this._lookupAppearance(reference)
        if (appearance) {
            const { contents } = appearance
            //
            // Remove contents in reverse order in case of duplicate appearances of the same key (since
            // you *definitely* want to remove appearances in reverse order, or else the reindexing will
            // destroy the validity of your references)
            //
            const reversedContents = [...contents].reverse()
            reversedContents.forEach((contentReference) => { this._removeAppearance(contentReference) })
            this._normalForm = produce(this._normalForm, (draft) => {
                draft[reference.key].appearances.splice(reference.index, 1)
                if (!draft[reference.key].appearances.length) {
                    delete draft[reference.key]
                }
            })
            const revisedAppearanceList = this._normalForm[reference.key]?.appearances || []
            revisedAppearanceList.forEach((_, index) => {
                if (index >= reference.index) {
                    this._reindexReference({ key: reference.key, index, tag: reference.tag }, { fromIndex: index + 1 })
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
            ...(updateExports ? { exportAs: this._normalForm[fromKey]?.exportAs ?? fromKey } : {})
        } }
        const tag = this._normalForm[toKey].tag
        appearances.forEach(({ contextStack }, index) => {
            //
            // Change references for all parents that have this key in their contents
            //
            if (contextStack.length > 0) {
                const parent = contextStack.slice(-1)[0]
                this._updateAppearance(parent, (draft) => {
                    draft.contents.forEach((contentItem) => {
                        if (contentItem.key === fromKey) {
                            contentItem.key = toKey
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
                    from: newFrom
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
                        if (condition.dependencies.includes(fromKey)) {
                            condition.dependencies = condition.dependencies.filter((dependency) => (dependency !== fromKey))
                        }
                    })
                }
                if (isNormalComputed(item)) {
                    if (item.dependencies.includes(fromKey)) {
                        item.dependencies = item.dependencies.filter((dependency) => (dependency !== fromKey))
                    }
                }
                if (isNormalRoom(item) || isNormalFeature(item) || isNormalKnowledge(item) || isNormalBookmark(item)) {
                    item.appearances.forEach((appearance) => {
                        if ((appearance.render || []).find((item) => (
                            (item.tag === 'Link' || item.tag === 'Bookmark') && item.to === fromKey
                        ))) {
                            appearance.render = appearance.render.map((item) => (
                                ((item.tag === 'Link' || item.tag === 'Bookmark') && item.to === fromKey)
                                    ? { ...item, to: toKey }
                                    : item
                            ))
                        }
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

    //
    // put accepts an incoming tag and a context, and returns a list of NormalReference returns for things
    // that it has added to the NormalForm mapping as children of the most granular level of the context
    // (i.e., if a feature is being added in a Room then that feature becomes a child of that room)
    //
    put(node: SchemaTag, position: NormalizerInsertPosition): NormalReference | undefined {
        let returnValue: NormalReference = undefined
        //
        // SchemaExportTag encodes its changes throughout the normalForm, rather than creating any normal Item
        // of its own.
        //
        if (isSchemaExport(node)) {
            const exportPlaceholder = buildNormalPlaceholdersFromExport(node)
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
            return returnValue
        }
        if (!isSchemaTagWithNormalEquivalent(node)) {
            return returnValue
        }
        if (position.replace) {
            const deleteReference = this._insertPositionToReference(position)
            this.delete(deleteReference)
        }
        const translateContext: NormalizerContext = {
            contextStack: position.contextStack
        }
        this._validateTags(node)
        let appearanceIndex: number
        let returnKey: string = node.key
        switch(node.tag) {
            case 'Exit':
                appearanceIndex = this._mergeAppearance(node.key, this._translate({ ...translateContext, contents: [] }, node), position)
                returnValue = {
                    tag: 'Exit',
                    key: node.key,
                    index: appearanceIndex
                }
                break
            case 'Import':
                const translatedImport = this._translate({ ...translateContext, contents: [] }, node)
                const importIndex = this._mergeAppearance(translatedImport.key, translatedImport, position)
                const importParentReference = this._getParentReference(translateContext.contextStack)
                if (importParentReference) {
                    const { contents = [] } = this._lookupAppearance(importParentReference)
                    this._updateAppearanceContents(
                        importParentReference.key,
                        importParentReference.index,
                        [
                            ...contents,
                            {
                                key: translatedImport.key,
                                tag: 'Import',
                                index: importIndex
                            }
                        ]
                    )
                }
                const importSchemaTags = rebuildContentsFromImport(node)
                const updatedContext: NormalizerInsertPosition = {
                    ...position,
                    replace: false,
                    contextStack: [
                        ...translateContext.contextStack,
                        {
                            key: translatedImport.key,
                            tag: node.tag,
                            index: importIndex
                        }
                    ],
                }
                const importContents = importSchemaTags.map((tag) => (this.put(tag, updatedContext)))
                this._updateAppearanceContents(translatedImport.key, importIndex, importContents)
                return {
                    key: translatedImport.key,
                    tag: 'Import',
                    index: importIndex
                }
            default:
                const translatedItem = this._translate({ ...translateContext, contents: [] }, node)
                returnKey = translatedItem.key
                appearanceIndex = this._mergeAppearance(returnKey, translatedItem, position)
                returnValue = {
                    key: returnKey,
                    tag: node.tag,
                    index: appearanceIndex
                }
        }
        const parentReference = this._getParentReference(translateContext.contextStack)
        if (parentReference && !isSchemaImport(node)) {
            const { contents = [] } = this._lookupAppearance(parentReference)
            if (typeof position.index === 'number') {
                this._updateAppearanceContents(parentReference.key, parentReference.index, [...contents.slice(0, position.index), returnValue, ...contents.slice(position.index)])
            }
            else {
                this._updateAppearanceContents(parentReference.key, parentReference.index, [...contents, returnValue])
            }
        }
        if (isSchemaWithContents(node) && !isSchemaExit(node)) {
            const updateContext: NormalizerInsertPosition = {
                contextStack: [
                    ...translateContext.contextStack,
                    returnValue
                ]
            }
            node.contents.forEach((child) => {
                this.put(child, updateContext)
            })
        }
        return returnValue
    }

    delete(reference: NormalReference): void {
        const appearance = this._lookupAppearance(reference)
        if (appearance) {
            const parentReference = this._getParentReference(appearance.contextStack)
            if (parentReference) {
                const { contents = [] } = this._lookupAppearance(parentReference)
                const index = contents.findIndex(({ key, index }) => (key === reference.key && index === reference.index))
                if (index !== -1) {
                    this._updateAppearanceContents(parentReference.key, parentReference.index, [...contents.slice(0, index), ...contents.slice(index + 1)])
                }
            }
            this._removeAppearance(reference)
            const newParentReference = this._getParentReference(appearance.contextStack)
            if (newParentReference && newParentReference.tag === 'If') {
                const { contents = [] } = this._lookupAppearance(newParentReference)
                if (!contents.length) {
                    this.delete(newParentReference)
                }
            }
            this._renameAllConditions()
        }
    }

    _validateTags(node: SchemaTag): void {
        if (!isSchemaTagWithNormalEquivalent(node)) {
            return
        }
        let tagToCompare = node.tag
        let keyToCompare = node.key
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
        if (isSchemaWithContents(node)) {
            node.contents.forEach(this._validateTags.bind(this))
        }

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
                    appearances: [appearance]
                }
            case 'Variable':
                return {
                    key: node.key || defaultKey,
                    tag: 'Variable',
                    default: node.default,
                    appearances: [appearance]
                }
            case 'Computed':
                return {
                    key: node.key || defaultKey,
                    tag: 'Computed',
                    src: node.src,
                    dependencies: node.dependencies,
                    appearances: [appearance]
                }
            case 'Action':
                return {
                    key: node.key || defaultKey,
                    tag: 'Action',
                    src: node.src,
                    appearances: [appearance]
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
                    appearances: [{
                        ...appearance,
                        render: node.render.map(schemaDescriptionToComponentRender(this._tags)).filter((value) => (value)),
                        name: node.name.map(schemaDescriptionToComponentRender(this._tags)).filter((value) => (value)),
                        ...((node.tag === 'Room' && (node.x !== undefined || node.y !== undefined)) ? { x: node.x, y: node.y } : {})
                    }]
                }
            case 'Bookmark':
                return {
                    key: node.key || defaultKey,
                    tag: node.tag,
                    appearances: [{
                        ...appearance,
                        render: node.contents.map(schemaDescriptionToComponentRender(this._tags)).filter((value) => (value))
                    }]
                }
            case 'Message':
                return {
                    key: node.key || defaultKey,
                    tag: node.tag,
                    appearances: [{
                        ...appearance,
                        render: node.render.map(schemaDescriptionToComponentRender(this._tags)).filter((value) => (value)),
                        rooms: node.rooms
                    }]
                }
            case 'Moment':
                return {
                    key: node.key || defaultKey,
                    tag: node.tag,
                    appearances: [{
                        ...appearance,
                        messages: node.contents.filter(isSchemaMessage).map(({ key }) => (key))
                    }]
                }
            case 'Map':
                return {
                    key: node.key || defaultKey,
                    tag: node.tag,
                    appearances: [{
                        ...appearance,
                        rooms: node.rooms,
                        images: node.images,
                        name: node.name
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
                    FirstImpression: node.FirstImpression,
                    OneCoolThing: node.OneCoolThing,
                    Outfit: node.Outfit,
                    fileName: node.fileName,
                    images: node.contents.filter(isSchemaImage).map(({ key }) => (key)),
                    assets: node.contents.filter(isSchemaImport).map(({ from }) => (from)),
                    appearances: [appearance]
                }
            // default:
            //     throw new NormalizeTagMismatchError(`Tag "${node.tag}" mistakenly processed in normalizer`)
        }
    }

    loadSchema(schema: SchemaTag[]): void {
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
        schema.forEach((item, index) => {
            this.put(item, { contextStack: [], index, replace: false })
        })
    }

    loadWML(wml: string): void {
        // const schema = schemaFromWML(wml)
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

    _normalToSchema(key: string, appearanceIndex: number): SchemaTag | undefined {
        const node = this._normalForm[key]
        if (!node || appearanceIndex >= node.appearances.length) {
            return undefined
        }
        const baseAppearance = this._lookupAppearance({ key, index: appearanceIndex, tag: node.tag })
        if (!baseAppearance) {
            return undefined
        }
        switch(node.tag) {
            case 'Asset':
                //
                // TODO: Create a SchemaExportTag manually out of `exportAs` data on every item in the
                // entire normalForm that has this node somewhere in the context of one of its appearances,
                // and which has an exportAs specified different from its key, to be the last element of the
                // Asset contents.
                //
                const allAssetDescendantNormals = (Object.values(this._normalForm) as NormalItem[])
                    .filter(({ tag }) => (isImportableTag(tag)))
                    .filter(({ appearances }) => (Boolean(appearances.find(({ contextStack }) => (contextStack.find(({ key }) => (key === node.key)))))))
                    .filter(({ key, exportAs }) => (exportAs && exportAs !== key))
                const exportSchemaTag: SchemaExportTag[] = allAssetDescendantNormals.length
                    ? [{
                        tag: 'Export',
                        mapping: Object.assign(
                            {},
                            ...allAssetDescendantNormals.map(({ key, tag, exportAs }) => ({ [exportAs || key]: { key, type: tag }}))
                        )
                    }]
                    : []
                return {
                    ...(node.Story
                        ? { tag: 'Story', Story: true, instance: false }
                        : { tag: 'Asset', Story: undefined }
                    ),
                    key,
                    contents: [
                        ...baseAppearance.contents
                            .map(({ key, index }) => (this._normalToSchema(key, index)))
                            .filter((value) => (value))
                            .filter(isSchemaAssetContents),
                        ...exportSchemaTag
                    ]
                }
            case 'Image':
                return {
                    key,
                    tag: 'Image'
                }
            case 'Variable':
                return {
                    key,
                    tag: 'Variable',
                    default: node.default
                }
            case 'Computed':
                return {
                    key,
                    tag: 'Computed',
                    src: node.src,
                    dependencies: node.dependencies
                }
            case 'Action':
                return {
                    key,
                    tag: 'Action',
                    src: node.src
                }
            case 'If':
                const conditionContextTagList = baseAppearance.contextStack.map(({ tag }) => (tag)).filter(isLegalParseConditionContextTag)
                const conditionContextTag = conditionContextTagList.length ? conditionContextTagList.slice(-1)[0] : 'Asset'
                return {
                    tag: 'If',
                    conditions: node.conditions,
                    contents: baseAppearance.contents
                        .map(({ key, index }) => (this._normalToSchema(key, index)))
                        .filter((value) => (value))
            } as SchemaConditionTag
            //
            // TODO: Recreate contents for Import SchemaTag
            //
            case 'Import':
                return {
                    tag: 'Import',
                    from: node.from,
                    mapping: Object.entries(node.mapping)
                        .filter(([_, { type }]) => (isSchemaImportMappingType(type)))
                        .reduce<Record<string, SchemaImportMapping>>((previous, [key, { key: from, type }]) => ({
                            ...previous,
                            [key]: {
                                key: from,
                                type: type as SchemaImportMapping["type"]
                            }
                        }), {})
                }
            case 'Room':
                const roomAppearance = baseAppearance as ComponentAppearance
                return {
                    key,
                    tag: 'Room',
                    ...(typeof roomAppearance.x !== 'undefined' ? { x: roomAppearance.x } : {}),
                    ...(typeof roomAppearance.y !== 'undefined' ? { y: roomAppearance.y } : {}),
                    render: (roomAppearance.render || []).map(componentRenderToSchemaTaggedMessage),
                    name: (roomAppearance.name || []).map(componentRenderToSchemaTaggedMessage),
                    contents: roomAppearance.contents
                        .map(({ key, index }) => (this._normalToSchema(key, index)))
                        .filter((value) => (value))
                        .filter(isSchemaRoomContents)
                }
            case 'Feature':
                const featureAppearance = baseAppearance as ComponentAppearance
                return {
                    key,
                    tag: 'Feature',
                    render: (featureAppearance.render || []).map(componentRenderToSchemaTaggedMessage),
                    name: (featureAppearance.name || []).map(componentRenderToSchemaTaggedMessage),
                    contents: featureAppearance.contents
                        .map(({ key, index }) => (this._normalToSchema(key, index)))
                        .filter((value) => (value))
                        .filter(isSchemaFeatureContents)
                }
            case 'Knowledge':
                const knowledgeAppearance = baseAppearance as ComponentAppearance
                return {
                    key,
                    tag: 'Knowledge',
                    render: (knowledgeAppearance.render || []).map(componentRenderToSchemaTaggedMessage),
                    name: (knowledgeAppearance.name || []).map(componentRenderToSchemaTaggedMessage),
                    contents: knowledgeAppearance.contents
                        .map(({ key, index }) => (this._normalToSchema(key, index)))
                        .filter((value) => (value))
                        .filter(isSchemaKnowledgeContents)
                }
            case 'Bookmark':
                const bookmarkAppearance = baseAppearance as ComponentAppearance
                return {
                    key,
                    tag: 'Bookmark',
                    contents: (bookmarkAppearance.render || []).map(componentRenderToSchemaTaggedMessage)
                }
            case 'Message':
                const messageAppearance = baseAppearance as MessageAppearance
                return {
                    key,
                    tag: 'Message',
                    render: (messageAppearance.render || []).map(componentRenderToSchemaTaggedMessage),
                    contents: messageAppearance.contents
                        .map(({ key, index }) => (this._normalToSchema(key, index)))
                        .filter((value) => (value))
                        .filter(isSchemaMessageContents),
                    rooms: messageAppearance.rooms
                }
            case 'Moment':
                const momentAppearance = baseAppearance as MomentAppearance
                return {
                    key,
                    tag: 'Moment',
                    contents: momentAppearance.contents
                        .map(({ key, index }) => (this._normalToSchema(key, index)))
                        .filter((value) => (value))
                        .filter(isSchemaMessage)
                }
            case 'Map':
                const mapAppearance = baseAppearance as MapAppearance
                return {
                    key,
                    tag: 'Map',
                    images: mapAppearance.images,
                    name: (mapAppearance.name || []).map(componentRenderToSchemaTaggedMessage),
                    rooms: mapAppearance.rooms,
                    contents: mapAppearance.contents
                        .map(({ key, index }) => (this._normalToSchema(key, index)))
                        .filter((value) => (value))
                        .filter(isSchemaMapContents)
                }
            case 'Exit':
                return {
                    key,
                    tag: 'Exit',
                    to: node.to,
                    from: node.from,
                    name: node.name,
                    contents: baseAppearance.contents
                        .map(({ key, index }) => (this._normalToSchema(key, index)))
                        .filter((value) => (value))
                        .filter(isSchemaString)
                }
            case 'Character':
                return {
                    key,
                    tag: 'Character',
                    Name: node.Name,
                    Pronouns: node.Pronouns,
                    FirstImpression: node.FirstImpression,
                    OneCoolThing: node.OneCoolThing,
                    Outfit: node.Outfit,
                    contents: [
                        ...node.images.map((key): SchemaImageTag => ({
                            tag: 'Image',
                            key
                        })),
                        ...node.assets.map((key): SchemaImportTag => ({
                            tag: 'Import',
                            from: key,
                            mapping: {}
                        }))
                    ],
                    fileName: node.fileName,
                }
        }
    }

    get schema(): SchemaTag[] {
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

    referenceToSchema(reference: NormalReference): SchemaTag {
        return this._normalToSchema(reference.key, reference.index)
    }

    get rootNode(): NormalAsset | NormalCharacter | undefined {
        return Object.values(this._normalForm).filter((node): node is NormalAsset | NormalCharacter => (isNormalAsset(node) || isNormalCharacter(node))).find(({ appearances }) => (appearances.find(({ contextStack }) => (contextStack.length === 0))))
    }

    standardize(): void {
        if (this.rootNode && isNormalAsset(this.rootNode)) {
            const standardized = standardizeNormal(this._normalForm)
            this.loadNormal(standardized)
        }
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
    filter(args: { itemFilter?: (item: SchemaTag) => boolean }): void {
        const schema = this.schema
    }

    //
    // merge function takes a second normalizer, and merges the contents in place
    //
    merge(incomingNormalizer: Normalizer): void {
        const firstSchema = this.schema
        const secondSchema = incomingNormalizer.schema
        const outputSchema = mergeOrderedConditionalTrees(firstSchema, secondSchema)
        console.log(`outputSchema: ${JSON.stringify(outputSchema, null, 4)}`)
        this.loadSchema(outputSchema)
    }

}

export default Normalizer
