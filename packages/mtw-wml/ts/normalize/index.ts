import { produce } from 'immer'
import { objectMap } from '../lib/objects'
import {
    isSchemaCharacter,
    isSchemaExit,
    isSchemaWithContents,
    isSchemaWithKey,
    SchemaActionTag,
    SchemaAssetLegalContents,
    SchemaAssetTag,
    SchemaComputedTag,
    SchemaConditionTag,
    SchemaFeatureLegalContents,
    SchemaFeatureTag,
    SchemaImageTag,
    SchemaImportTag,
    SchemaMapLegalContents,
    SchemaMapTag,
    SchemaRoomLegalContents,
    SchemaRoomTag,
    SchemaStoryTag,
    SchemaTag,
    SchemaVariableTag,
    SchemaWithKey
} from '../schema/baseClasses'
import {
    BaseAppearance,
    ComponentRenderItem,
    NormalAction,
    NormalAsset,
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
    NormalReference,
    NormalRoom,
    NormalVariable
} from './baseClasses'
import { keyForValue } from './keyUtil';

export {
    BaseAppearance,
    ComponentAppearance,
    ComponentRenderItem,
    NormalAsset,
    NormalCharacter,
    NormalCharacterPronouns,
    NormalComponent,
    NormalCondition,
    NormalDescription,
    NormalDescriptionPayload,
    NormalExit,
    NormalFeature,
    NormalForm,
    NormalImport,
    NormalItem,
    NormalMap,
    NormalRoom,
    NormalizeKeyMismatchError,
    NormalizeTagMismatchError,
    isNormalAction,
    isNormalAsset,
    isNormalCharacter,
    isNormalComponent,
    isNormalComputed,
    isNormalCondition,
    isNormalExit,
    isNormalImage,
    isNormalImport,
    isNormalMap,
    isNormalVariable
} from './baseClasses'

export type SchemaTagWithNormalEquivalent = SchemaWithKey | SchemaImportTag | SchemaConditionTag

const isSchemaTagWithNormalEquivalent = (node: SchemaTag): node is SchemaTagWithNormalEquivalent => (
    isSchemaWithKey(node) || (['Import', 'Condition'].includes(node.tag))
)

type NormalizerContext = {
    contextStack: NormalReference[];
    location: number[];
}

type NormalizeAddReturnValue = {
    children: NormalReference[];
    siblings: NormalReference[];
}

export class Normalizer {
    _normalForm: NormalForm = {};
    _tags: Record<string, "Asset" | "Image" | "Variable" | "Computed" | "Action" | "Import" | "Condition" | "Exit" | "Map" | "Room" | "Feature"> = {}

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
        if (isSchemaCharacter(node)) {
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
                                        name: '',
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
                                        name: '',
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
        if (node.tag === 'Character') {
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
            case 'Condition':
                keyToCompare = keyForValue('Condition', node.if)
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
    _translate(appearance: BaseAppearance, node: SchemaMapTag): NormalMap
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
                    fileURL: node.fileURL,
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
            case 'Condition':
                return {
                    key: keyForValue('Condition', node.if),
                    tag: 'Condition',
                    if: node.if,
                    dependencies: node.dependencies,
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
                        render: node.render.map<ComponentRenderItem>((renderItem) => {
                            if (renderItem.tag === 'Link') {
                                if (!(renderItem.to in this._tags)) {
                                    throw new NormalizeTagMismatchError(`Link specifies "to" property (${renderItem.to}) with no matching key`)
                                }
                                const targetTag = this._tags[renderItem.to]
                                if (!['Action', 'Feature'].includes(targetTag)) {
                                    throw new NormalizeTagMismatchError(`Link specifies "to" property (${renderItem.to}) referring to an invalid tag (${targetTag})`)
                                }
                                return {
                                    tag: 'Link',
                                    to: renderItem.to,
                                    text: renderItem.text,
                                    spaceBefore: renderItem.spaceBefore,
                                    spaceAfter: renderItem.spaceAfter,
                                    targetTag: targetTag as 'Action' | 'Feature'
                                }
                            }
                            else if (renderItem.tag === 'br') {
                                return {
                                    tag: 'LineBreak' as 'LineBreak'
                                }
                            }
                            else if (renderItem.tag === 'String') {
                                return {
                                    tag: 'String' as 'String',
                                    value: renderItem.value
                                }
                            }
                        }).filter((value) => (value)),
                        name: node.name,
                        spaceAfter: false,
                        spaceBefore: false,
                        ...((node.tag === 'Room' && (node.x !== undefined || node.y !== undefined)) ? { x: node.x, y: node.y } : {})
                    }]
                }
            case 'Map':
                return {
                    key: node.key,
                    tag: node.tag,
                    appearances: [{
                        ...appearance,
                        rooms: objectMap(node.rooms, (({ index, ...room }) => ({
                            ...room,
                            location: [...appearance.location, index]
                        }))),
                        images: node.images
                    }]
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
            default:
                throw new NormalizeTagMismatchError(`Tag "${node.tag}" mistakenly processed in normalizer`)
        }
    }

    get normal() {
        return this._normalForm
    }
}

export default Normalizer
