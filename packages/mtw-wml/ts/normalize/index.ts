import { produce } from 'immer'
import { isLegalParseConditionContextTag } from '../parser/baseClasses';
import { schemaFromParse } from '../schema';
import parser from '../parser'
import tokenizer from '../parser/tokenizer';
import {
    isSchemaExit,
    isSchemaWithContents,
    isSchemaWithKey,
    SchemaActionTag,
    SchemaAssetTag,
    SchemaCharacterTag,
    SchemaComputedTag,
    SchemaConditionTag,
    SchemaConditionTagDescriptionContext,
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
    isSchemaConditionTagDescriptionContext,
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
    SchemaConditionMixin
} from '../schema/baseClasses'
import {
    BaseAppearance,
    ComponentAppearance,
    ComponentRenderItem,
    isNormalCondition,
    isNormalMap,
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
import { objectFilterEntries } from '../lib/objects';

export type SchemaTagWithNormalEquivalent = SchemaWithKey | SchemaImportTag | SchemaConditionTag

const isSchemaTagWithNormalEquivalent = (node: SchemaTag): node is SchemaTagWithNormalEquivalent => (
    isSchemaWithKey(node) || (['Import', 'If'].includes(node.tag))
)

type NormalizerContext = {
    contextStack: NormalReference[];
    index?: number;
}

type NormalizeTagTranslationMap = Record<string, "Asset" | "Image" | "Variable" | "Computed" | "Action" | "Import" | "If" | "Exit" | "Map" | "Room" | "Feature" | "Bookmark" | "Character" | "Message" | "Moment">

const schemaDescriptionToComponentRender = (translationTags: NormalizeTagTranslationMap) => (renderItem: SchemaTaggedMessageIncomingContents | SchemaTaggedMessageLegalContents): ComponentRenderItem | undefined => {
    if (renderItem.tag === 'If' && isSchemaConditionTagDescriptionContext(renderItem)) {
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
        if (!['Action', 'Feature'].includes(targetTag)) {
            throw new NormalizeTagMismatchError(`Link specifies "to" property (${renderItem.to}) referring to an invalid tag (${targetTag})`)
        }
        return {
            tag: 'Link',
            to: renderItem.to,
            text: renderItem.text,
            targetTag: targetTag as 'Action' | 'Feature'
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
                contextTag: 'Description' as 'Description',
                contents: renderItem.contents
                    .map(componentRenderToSchemaTaggedMessage)
                    .filter((value) => (value))
                    .filter(isSchemaTaggedMessageLegalContents)
            } as SchemaConditionTagDescriptionContext
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
            const rootNode = Object.values(this._normalForm).find(({ appearances }) => (appearances.find(({ contextStack }) => (contextStack.length === 0))))
            const index = rootNode.appearances.findIndex(({ contextStack }) => (contextStack.length === 0))
            if (!rootNode || index === -1) {
                return undefined
            }
            return {
                key: rootNode.key,
                tag: rootNode.tag,
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

    //
    // TODO: When position is provided, compare against existing appearances (if any) in order
    // to find the right place to splice the new entry into the list, and then reindex all of
    // the later appearances
    //
    _mergeAppearance(key: string, item: NormalItem, position: NormalizerInsertPosition): number {
        if (key in this._normalForm) {
            const tag = this._normalForm[key].tag
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
            contents.forEach((contentReference) => { this._removeAppearance(contentReference) })
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

    _renameItem(fromKey: string, toKey: string): void {
        const appearances = this._normalForm[fromKey]?.appearances || []
        this._normalForm = { ...this._normalForm, [toKey]: { ...this._normalForm[fromKey], key: toKey } }
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
                this._renameItem(key, newKey)
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
        if (!isSchemaTagWithNormalEquivalent(node)) {
            return returnValue
        }
        if (position.replace) {
            this.delete(this._insertPositionToReference(position))
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
                //
                // TODO: Refactor Import to deprecate Use tags and have direct appearances with optional 'as' property
                //
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
                const importContents = Object.entries(node.mapping).map<NormalReference>(([key, { type, key: from }], index) => {
                    const updatedContext: NormalizerInsertPosition = {
                        ...position,
                        contextStack: [
                            ...translateContext.contextStack,
                            {
                                key: translatedImport.key,
                                tag: node.tag,
                                index: importIndex
                            }
                        ],
                    }    
                    switch(type) {
                        case 'Room':
                            return this.put(
                                    {
                                        key,
                                        tag: 'Room',
                                        name: [],
                                        global: false,
                                        contents: [],
                                        render: [],
                                        parse: {
                                            key,
                                            tag: 'Room',
                                            contents: [],
                                            global: false,
                                            startTagToken: 0,
                                            endTagToken: 0
                                        }
                                    },
                                    updatedContext
                                )
                        case 'Feature':
                            return this.put(
                                    {
                                        key,
                                        tag: 'Feature',
                                        name: [],
                                        global: false,
                                        contents: [],
                                        render: [],
                                        parse: {
                                            key,
                                            tag: 'Feature',
                                            contents: [],
                                            global: false,
                                            startTagToken: 0,
                                            endTagToken: 0
                                        }
                                    },
                                    updatedContext
                                )
                        case 'Variable':
                            return this.put(
                                    {
                                        key,
                                        tag: 'Variable',
                                        parse: {
                                            key,
                                            tag: 'Variable',
                                            startTagToken: 0,
                                            endTagToken: 0
                                        }
                                    },
                                    updatedContext
                                )
                        case 'Computed':
                            return this.put(
                                    {
                                        key,
                                        tag: 'Computed',
                                        src: '',
                                        dependencies: [],
                                        parse: {
                                            key,
                                            tag: 'Computed',
                                            startTagToken: 0,
                                            endTagToken: 0,
                                            src: '',
                                            dependencies: []
                                        }
                                    },
                                    updatedContext
                                )
                        case 'Action':
                            return this.put(
                                    {
                                        key,
                                        tag: 'Action',
                                        src: '',
                                        parse: {
                                            key,
                                            tag: 'Action',
                                            src: '',
                                            startTagToken: 0,
                                            endTagToken: 0
                                        }
                                    },
                                    updatedContext
                                )
                        //
                        // TODO: Add import for Bookmarks
                        //
                        default:
                            throw new NormalizeTagMismatchError(`"${type}" tag not allowed in import`)
                    }
                })
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
            this._removeAppearance(reference)
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
        //
        // TODO: Rationalize Import to include normal tags, rather than <Use> tags
        //
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
    _translate(appearance: BaseAppearance, node: SchemaBookmarkTag): NormalBookmark
    _translate(appearance: BaseAppearance, node: SchemaMessageTag): NormalMessage
    _translate(appearance: BaseAppearance, node: SchemaMomentTag): NormalMoment
    _translate(appearance: BaseAppearance, node: SchemaMapTag): NormalMap
    _translate(appearance: BaseAppearance, node: SchemaCharacterTag): NormalCharacter
    _translate(appearance: BaseAppearance, node: SchemaTagWithNormalEquivalent): NormalItem
    _translate(appearance: BaseAppearance, node: SchemaTagWithNormalEquivalent): NormalItem {
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
                    key: node.key,
                    tag: 'Image',
                    appearances: [appearance]
                }
            case 'Variable':
                return {
                    key: node.key,
                    tag: 'Variable',
                    default: node.default,
                    appearances: [appearance]
                }
            case 'Computed':
                return {
                    key: node.key,
                    tag: 'Computed',
                    src: node.src,
                    dependencies: node.dependencies,
                    appearances: [appearance]
                }
            case 'Action':
                return {
                    key: node.key,
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
                return {
                    key: node.key,
                    tag: node.tag,
                    global: node.global ?? false,
                    appearances: [{
                        ...appearance,
                        render: node.render.map(schemaDescriptionToComponentRender(this._tags)).filter((value) => (value)),
                        name: node.name.map(schemaDescriptionToComponentRender(this._tags)).filter((value) => (value)),
                        ...((node.tag === 'Room' && (node.x !== undefined || node.y !== undefined)) ? { x: node.x, y: node.y } : {})
                    }]
                }
            case 'Bookmark':
                return {
                    key: node.key,
                    tag: node.tag,
                    appearances: [{
                        ...appearance,
                        render: node.contents.map(schemaDescriptionToComponentRender(this._tags)).filter((value) => (value))
                    }]
                }
            case 'Message':
                return {
                    key: node.key,
                    tag: node.tag,
                    appearances: [{
                        ...appearance,
                        render: node.render.map(schemaDescriptionToComponentRender(this._tags)).filter((value) => (value)),
                        rooms: node.rooms
                    }]
                }
            case 'Moment':
                return {
                    key: node.key,
                    tag: node.tag,
                    appearances: [{
                        ...appearance,
                        messages: node.contents.map(({ key }) => (key))
                    }]
                }
            case 'Map':
                return {
                    key: node.key,
                    tag: node.tag,
                    appearances: [{
                        ...appearance,
                        rooms: node.rooms,
                        images: node.images
                    }] as MapAppearance[]
                }
            case 'Exit':
                const exitRoomIndex = appearance.contextStack.reduceRight((previous, { tag }, index) => (((tag === 'Room') && (previous === -1)) ? index : previous), -1)
                if (exitRoomIndex === -1) {
                    throw new SchemaException('Exit tag cannot be created outside of room', node.parse)
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
                    appearances: [appearance]
                }
            // default:
            //     throw new NormalizeTagMismatchError(`Tag "${node.tag}" mistakenly processed in normalizer`)
        }
    }

    loadWML(wml: string): void {
        this._normalForm = {}
        const schema = schemaFromParse(parser(tokenizer(new SourceStream(wml))))
        schema.forEach((item, index) => {
            this.put(item, { contextStack: [], index, replace: false })
        })
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
                if (node.Story) {
                    return {
                        key,
                        tag: 'Story',
                        Story: true,
                        instance: false,
                        fileName: node.fileName,
                        contents: baseAppearance.contents
                            .map(({ key, index }) => (this._normalToSchema(key, index)))
                            .filter((value) => (value))
                            .filter(isSchemaAssetContents)
                    }
                }
                else {
                    return {
                        key,
                        tag: 'Asset',
                        Story: undefined,
                        fileName: node.fileName,
                        contents: baseAppearance.contents
                            .map(({ key, index }) => (this._normalToSchema(key, index)))
                            .filter((value) => (value))
                            .filter(isSchemaAssetContents)
                    }
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
                    contextTag: conditionContextTag,
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
                    global: node.global ? true : undefined,
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
                    global: node.global ? true : undefined,
                    render: (featureAppearance.render || []).map(componentRenderToSchemaTaggedMessage),
                    name: (featureAppearance.name || []).map(componentRenderToSchemaTaggedMessage),
                    contents: featureAppearance.contents
                        .map(({ key, index }) => (this._normalToSchema(key, index)))
                        .filter((value) => (value))
                        .filter(isSchemaFeatureContents)
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
                    contents: node.images.map((key) => ({
                        tag: 'Image',
                        key
                    })),
                    fileName: node.fileName
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
}

export default Normalizer
