import { produce } from 'immer'
import { isLegalParseConditionContextTag } from '../parser/baseClasses';
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
    SchemaImportMapping
} from '../schema/baseClasses'
import {
    BaseAppearance,
    ComponentAppearance,
    ComponentRenderItem,
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
    NormalReference,
    NormalRoom,
    NormalVariable
} from './baseClasses'
import { keyForIfValue, keyForValue } from './keyUtil';

export type SchemaTagWithNormalEquivalent = SchemaWithKey | SchemaImportTag | SchemaConditionTag

const isSchemaTagWithNormalEquivalent = (node: SchemaTag): node is SchemaTagWithNormalEquivalent => (
    isSchemaWithKey(node) || (['Import', 'If'].includes(node.tag))
)

type NormalizerContext = {
    contextStack: NormalReference[];
    location: number[];
}

type NormalizeAddReturnValue = {
    children: NormalReference[];
    siblings: NormalReference[];
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

const componentRenderToSchemaTaggedMessage = (renderItem: ComponentRenderItem): SchemaTaggedMessageLegalContents => {
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

export class Normalizer {
    _normalForm: NormalForm = {};
    _tags: NormalizeTagTranslationMap = {}

    constructor() {}
    _mergeAppearance(key: string, item: NormalItem): number {
        if (key in this._normalForm) {
            this._normalForm[key] = { ...produce(this._normalForm[key], (draft) => {
                if (draft.tag !== item.tag) {
                    throw new NormalizeTagMismatchError(`Item "${key}" is defined with conflict tags `)
                }
                (draft.appearances as any).push(item.appearances[0])
            }) }
            return this._normalForm[key].appearances.length - 1
        }
        else {
            this._normalForm[key] = item
            return 0
        }
    }

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
    }

    //
    // TODO: Add a way to normalize a SchemaCharacterTag, or do some equivalent translation as
    // the client demands
    //

    //
    // add accepts an incoming tag and a context, and returns two lists of NormalReference returns for things
    // that it has added to the NormalForm mapping:
    //      * children: Elements that have been added as children of the most granular level of the context
    //                  (i.e., if a feature is being added in a Room then that feature becomes a child of
    //                  that room)
    //      * siblings: Elements that should be added at the same level as the most granular item of the
    //                  context (i.e., if a 'from' exit is written into a Room, it should be wrapped in
    //                  a Room of that from key, and that Room in turn should be added as a sibling of the
    //                  room that is passed as part of the context)
    //
    // TODO: Refactor add to return both children (array of NormalReference for children created by the add)
    // and siblings (array of NormalReference for *siblings* created by the add), and to properly accumulate
    // those in the contents recursion
    //
    add(node: SchemaTag, context: NormalizerContext = { contextStack: [], location: [] }): NormalizeAddReturnValue {
        let returnValue: NormalizeAddReturnValue = {
            children: [],
            siblings: []
        }
        if (!isSchemaTagWithNormalEquivalent(node)) {
            return returnValue
        }
        this._validateTags(node)
        let appearanceIndex: number
        let returnKey: string = node.key
        switch(node.tag) {
            //
            // TODO:  Simplify WML syntax around Exits, so that they can only be created in the Rooms from which they lead, and subsequently
            // simplify all this code as well.
            //
            case 'Exit':
                const roomIndex = context.contextStack.reduceRight((previous, { tag }, index) => (((tag === 'Room') && (previous === -1)) ? index : previous), -1)
                if (roomIndex === -1) {
                    //
                    // The exit is being created globally, outside of any room wrapper.  For normalization, we add a room wrapper
                    // appearance for the FROM key, inside the normalize structure
                    //
                    returnKey = `${node.from}#${node.to}`
                    const wrapperRoomAppearance = this._mergeAppearance(node.from, {
                        tag: 'Room',
                        key: node.from,
                        appearances: [{
                            contextStack: context.contextStack,
                            location: [],
                            contents: []
                        }]
                    })
                    appearanceIndex = this._mergeAppearance(returnKey, {
                        tag: 'Exit',
                        key: returnKey,
                        to: node.to,
                        from: node.from,
                        name: node.name,
                        appearances: [{
                            contextStack: [
                                ...context.contextStack,
                                {
                                    tag: 'Room',
                                    key: node.from,
                                    index: wrapperRoomAppearance
                                }
                            ],
                            location: context.location,
                            contents: []
                        }]
                    })
                    this._updateAppearanceContents(node.from, wrapperRoomAppearance, [{
                        tag: 'Exit',
                        key: returnKey,
                        index: appearanceIndex
                    }])
                    returnValue = {
                        children: [{
                            key: node.from,
                            tag: 'Room',
                            index: wrapperRoomAppearance
                        }],
                        siblings: []
                    }
                }
                else {
                    const roomKey = context.contextStack[roomIndex].key
                    const { to, from } = node
                    if (from && from !== roomKey) {
                        //
                        // This exit is being defined within the context of the room *to which* it leads.
                        // For ease of reference, define a sibling-level room wrapper for the FROM room
                        // and nest the exit within it
                        //
                        const contextStackBeforeRoom = context.contextStack.slice(0, roomIndex)
                        const contextStackAfterRoom = context.contextStack.slice(roomIndex + 1)
                        returnKey = `${from}#${to}`
                        const wrapperRoomAppearance = this._mergeAppearance(from, {
                            tag: 'Room',
                            key: from,
                            appearances: [{
                                contextStack: context.contextStack.slice(0, -1),
                                location: [],
                                contents: []
                            }]
                        })
                        appearanceIndex = this._mergeAppearance(returnKey, {
                            tag: 'Exit',
                            key: returnKey,
                            to: node.to,
                            from: node.from,
                            name: node.name,
                            appearances: [{
                                contextStack: [
                                    ...contextStackBeforeRoom,
                                    {
                                        index: wrapperRoomAppearance,
                                        key: from,
                                        tag: 'Room'
                                    },
                                    ...contextStackAfterRoom
                                ],
                                location: context.location,
                                contents: []
                            }]
                        })
                        const childReturn: NormalReference = {
                            tag: 'Exit',
                            key: returnKey,
                            index: appearanceIndex
                        }
                        this._updateAppearanceContents(from, wrapperRoomAppearance, [childReturn])
                        returnValue = {
                            children: [],
                            siblings: [{
                                key: node.from,
                                tag: 'Room',
                                index: wrapperRoomAppearance
                            }]
                        }
                    }
                    else {
                        appearanceIndex = this._mergeAppearance(node.key, this._translate({ ...context, contents: [] }, node))
                        returnValue = {
                            children: [{
                                tag: 'Exit',
                                key: node.key,
                                index: appearanceIndex
                            }],
                            siblings: []
                        }
                    }
                }
                break
            case 'Import':
                //
                // TODO: Refactor Import to deprecate Use tags and have direct appearances with optional 'as' property
                //
                const translatedImport = this._translate({ ...context, contents: [] }, node)
                const importIndex = this._mergeAppearance(translatedImport.key, translatedImport)
                const importContents = Object.entries(node.mapping).map<NormalReference>(([key, { type, key: from }], index) => {
                    const updatedContext: NormalizerContext = {
                        contextStack: [
                            ...context.contextStack,
                            {
                                key: translatedImport.key,
                                tag: node.tag,
                                index: importIndex
                            }
                        ],
                        location: [
                            ...context.location,
                            index
                        ]
                    }    
                    switch(type) {
                        case 'Room':
                            return this.add(
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
                                ).children[0]
                        case 'Feature':
                            return this.add(
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
                                ).children[0]
                        case 'Variable':
                            return this.add(
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
                                ).children[0]
                        case 'Computed':
                            return this.add(
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
                                ).children[0]
                        case 'Action':
                            return this.add(
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
                                ).children[0]
                        //
                        // TODO: Add import for Bookmarks
                        //
                        default:
                            throw new NormalizeTagMismatchError(`"${type}" tag not allowed in import`)
                    }
                })
                this._updateAppearanceContents(translatedImport.key, importIndex, importContents)
                return {
                    children: [{
                        key: translatedImport.key,
                        tag: 'Import',
                        index: importIndex
                    }],
                    siblings: []
                }
            default:
                const translatedItem = this._translate({ ...context, contents: [] }, node)
                returnKey = translatedItem.key
                appearanceIndex = this._mergeAppearance(returnKey, translatedItem)
                returnValue = {
                    children: [{
                        key: returnKey,
                        tag: node.tag,
                        index: appearanceIndex
                    }],
                    siblings: []
                }
        }
        if (isSchemaWithContents(node) && !isSchemaExit(node)) {
            let children: NormalReference[] = returnValue.children
            const contentReferences = (node.contents as SchemaTag[]).reduce((previous, contentNode, index) => {
                const updateContext: NormalizerContext = {
                    contextStack: [
                        ...context.contextStack,
                        {
                            tag: node.tag,
                            key: returnKey,
                            index: appearanceIndex
                        }
                    ],
                    location: [
                        ...context.location,
                        index
                    ]
                }
                const { children: newChildren = [], siblings: newSiblings = [] } = this.add(contentNode, updateContext)
                children = [...children, ...newSiblings]
                return [
                    ...previous,
                    ...newChildren
                ]
            }, [] as NormalReference[])
            this._updateAppearanceContents(returnKey, appearanceIndex, contentReferences)
            return {
                children,
                siblings: returnValue.siblings
            }
        }
        else {
            return returnValue
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
                        rooms: node.rooms.map(({ index, ...room }) => ({
                            ...room,
                            location: [...appearance.location, index]
                        }))
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
                        rooms: node.rooms.map(({ index, ...room }) => ({
                            ...room,
                            location: [...appearance.location, index]
                        })),
                        images: node.images
                    }] as MapAppearance[]
                }
            case 'Exit':
                return {
                    key: node.key,
                    tag: node.tag,
                    to: node.to,
                    from: node.from,
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

    get normal() {
        return this._normalForm
    }

    _normalToSchema(key: string, appearanceIndex: number): SchemaTag | undefined {
        const node = this._normalForm[key]
        if (!node || appearanceIndex >= node.appearances.length) {
            return undefined
        }
        const baseAppearance: BaseAppearance = node.appearances[appearanceIndex]
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
                    rooms: messageAppearance.rooms.map(({ location, ...rest }) => ({ index: (location.slice(-1) || [0])[0], ...rest }))
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
                    rooms: mapAppearance.rooms.map(({ location, ...room }) => ({
                        ...room,
                        index: (location.slice(-1) || [0])[0]
                    })),
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

    //
    // TODO: Find all top-level Normal appearances and generate a list of SchemaTags
    // using _normalToSchema
    //
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
}

export default Normalizer
