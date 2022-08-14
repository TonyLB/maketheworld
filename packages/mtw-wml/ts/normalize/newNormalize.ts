import { produce } from 'immer'
import { objectMap } from '../lib/objects';
import {
    isSchemaCharacter,
    isSchemaWithContents,
    isSchemaWithKey,
    SchemaActionTag,
    SchemaAssetTag,
    SchemaComputedTag,
    SchemaConditionTag,
    SchemaFeatureTag,
    SchemaImageTag,
    SchemaImportTag,
    SchemaMapTag,
    SchemaRoomTag,
    SchemaStoryTag,
    SchemaTag,
    SchemaVariableTag,
    SchemaWithKey
} from '../schema/baseClasses'
import {
    BaseAppearance,
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

export type SchemaTagWithNormalEquivalent = SchemaWithKey | SchemaImportTag | SchemaConditionTag

const isSchemaTagWithNormalEquivalent = (node: SchemaTag): node is SchemaTagWithNormalEquivalent => (
    isSchemaWithKey(node) || (['Import', 'Condition'].includes(node.tag))
)

type NormalizerContext = {
    contextStack: NormalReference[];
    location: number[];
}

export class Normalizer extends Object {
    _normalForm: NormalForm = {};
    _tags: Record<string, "Asset" | "Image" | "Variable" | "Computed" | "Action" | "Import" | "Condition" | "Exit" | "Map" | "Room" | "Feature"> = {}
    constructor() {
        super()
    }

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
    add(node: SchemaTag, context: NormalizerContext = { contextStack: [], location: [] }): NormalReference {
        if (!isSchemaTagWithNormalEquivalent(node)) {
            return undefined
        }
        if (isSchemaCharacter(node)) {
            return undefined
        }
        this._validateTags(node)
        let returnValue: NormalReference
        switch(node.tag) {
            case 'Exit':
                const roomIndex = context.contextStack.reduceRight((previous, { tag }, index) => (((tag === 'Room') && (previous === -1)) ? index : previous), -1)
                if (roomIndex === -1) {
                    //
                    // The exit is being created globally, outside of any room wrapper.  For normalization, we add a room wrapper
                    // appearance for the FROM key, inside the normalize structure
                    //
                    const exitKey = `${node.from}#${node.to}`
                    const wrapperRoomAppearance = this._mergeAppearance(node.from, {
                        tag: 'Room',
                        key: node.from,
                        appearances: [{
                            contextStack: context.contextStack,
                            location: [context.location[0]],
                            contents: []
                        }]
                    })
                    const exitAppearance = this._mergeAppearance(exitKey, {
                        tag: 'Exit',
                        key: exitKey,
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
                        key: exitKey,
                        index: exitAppearance
                    }])
                    returnValue = {
                        key: exitKey,
                        tag: 'Exit',
                        index: exitAppearance
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
                        const exitKey = `${from}#${to}`
                        const wrapperRoomAppearance = this._mergeAppearance(from, {
                            tag: 'Room',
                            key: from,
                            appearances: [{
                                contextStack: context.contextStack,
                                location: context.location,
                                contents: []
                            }]
                        })
                        const exitAppearance = this._mergeAppearance(exitKey, {
                            tag: 'Exit',
                            key: exitKey,
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
                        returnValue = {
                            tag: 'Exit',
                            key: exitKey,
                            index: exitAppearance
                        }
                        this._updateAppearanceContents(from, wrapperRoomAppearance, [returnValue])
                    }
                    else {
                        returnValue = {
                            tag: 'Exit',
                            key: node.key,
                            index: this._mergeAppearance(node.key, node)
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
                                )
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
                                )
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
                                )
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
                                )
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
                                )
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
                const translatedItem = this._translate({ ...context, contents: [] }, node)
                returnValue = {
                    key: node.key,
                    tag: node.tag,
                    index: this._mergeAppearance(node.key, translatedItem)
                }
        }
        if (isSchemaWithContents(node)) {
            const contentReferences = node.contents.map<NormalReference>((contentNode, index) => {
                const updateContext: NormalizerContext = {
                    contextStack: [
                        ...context.contextStack,
                        returnValue
                    ],
                    location: [
                        ...context.location,
                        index
                    ]
                }
                return this.add(contentNode, updateContext)
            })
            this._updateAppearanceContents(node.key, returnValue.index, contentReferences)
        }
        return returnValue
    }

    _validateTags(node: SchemaTag): void {
        if (!isSchemaTagWithNormalEquivalent(node)) {
            return
        }
        if (node.tag === 'Character') {
            return 
        }
        const tagToCompare = node.tag === 'Story' ? 'Asset' : node.tag
        if (this._tags[node.key] && this._tags[node.key] !== tagToCompare) {
            throw new NormalizeTagMismatchError(`Item (${node.key}) defined with conflicting keys: "${this._tags[node.key]}" and "${tagToCompare}"`)
        }
        if (!(node.key in this._tags)) {
            this._tags[node.key] = tagToCompare
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
                    throw new NormalizeTagMismatchError(`Item (${key}) defined with conflicting keys: "${this._tags[node.key]}" and "${type}"`)
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
                console.log(`Import node: ${JSON.stringify(node, null, 4)}`)
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
                    appearances: [{
                        ...appearance,
                        render: node.render.map((renderItem) => {
                            if (renderItem.tag === 'Link') {
                                if (!(renderItem.to in this._tags)) {
                                    throw new NormalizeTagMismatchError(`Link specifies "to" property (${renderItem.to}) with no matching key`)
                                }
                                const targetTag = this._tags[renderItem.to]
                                if (!['Action', 'Feature'].includes(targetTag)) {
                                    throw new NormalizeTagMismatchError(`Link specifies "to" property (${renderItem.to}) referring to an invalid tag (${targetTag})`)
                                }
                                return {
                                    ...renderItem,
                                    targetTag: targetTag as 'Action' | 'Feature'
                                }
                            }
                        })
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
            default:
                throw new NormalizeTagMismatchError(`Tag "${node.tag}" mistakenly processed in normalizer`)
        }
    }

    get normal() {
        return this._normalForm
    }
}

export default Normalizer
