import { produce } from 'immer'
import { ParseException } from '../parser/baseClasses';
import {
    isSchemaWithKey,
    SchemaActionTag,
    SchemaAssetTag,
    SchemaCharacterTag,
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
    SchemaWithKey,
    SchemaBookmarkTag,
    SchemaMessageTag,
    SchemaException,
    SchemaMomentTag,
    SchemaKnowledgeTag,
    isImportableTag,
    isSchemaExport,
    isImportable,
    isSchemaCondition,
    isSchemaComputed
} from '../schema/baseClasses'
import {
    BaseAppearance,
    isNormalAsset,
    isNormalCharacter,
    isNormalComputed,
    isNormalCondition,
    isNormalReference,
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
    NormalizeTagMismatchError,
    NormalKnowledge,
    NormalMap,
    NormalMessage,
    NormalMoment,
    NormalReference,
    NormalRoom,
    NormalVariable
} from './baseClasses'
import { keyForIfValue, keyForValue } from './keyUtil';
import SourceStream from '../parser/tokenizer/sourceStream';
import { objectMap } from '../lib/objects';
import { schemaFromParse, defaultSchemaTag } from '../schema';
import parse from '../simpleParser';
import tokenizer from '../parser/tokenizer';
import { buildNormalPlaceholdersFromExport } from './importExportUtil';
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered } from '../tree/baseClasses';
import mergeSchemaTrees from '../schema/treeManipulation/merge';
import SchemaTagTree from '../tagTree/schema';
import { map } from '../tree/map';

export type SchemaTagWithNormalEquivalent = SchemaWithKey | SchemaImportTag | SchemaConditionTag

const isSchemaTagWithNormalEquivalent = (node: SchemaTag): node is SchemaTagWithNormalEquivalent => (
    isSchemaWithKey(node) || (['Import', 'If'].includes(node.tag))
)

type NormalizeTagTranslationMap = Record<string, "Asset" | "Image" | "Variable" | "Computed" | "Action" | "Import" | "If" | "Exit" | "Map" | "Room" | "Feature" | "Knowledge" | "Bookmark" | "Character" | "Message" | "Moment" | "After" | "Before" | "Replace">

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
                    appearances: [defaultedAppearance]
                }
            case 'Moment':
                return {
                    key: node.key || defaultKey,
                    tag: node.tag,
                    appearances: [defaultedAppearance]
                }
            case 'Map':
                return {
                    key: node.key || defaultKey,
                    tag: node.tag,
                    appearances: [defaultedAppearance]
                }
            case 'Exit':
                const { exitRoomIndex, exitRoomKey } = appearance.contextStack.reduceRight((previous, context, index) => (((context.tag === 'Room') && (previous.exitRoomIndex === -1)) ? { exitRoomIndex: index, exitRoomKey: context.key } : previous), { exitRoomIndex: -1, exitRoomKey: '' })
                if (exitRoomIndex === -1) {
                    throw new SchemaException('Exit tag cannot be created outside of room', { tag: 'Exit', to: '', from: '', contents: [], name: '', startTagToken: 0, endTagToken: 0 })
                }

                return {
                    key: node.key,
                    tag: node.tag,
                    to: node.to,
                    from: exitRoomKey,
                    appearances: [appearance]
                }
            case 'Character':
                return {
                    key: node.key,
                    tag: node.tag,
                    Pronouns: node.Pronouns,
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

            if (isSchemaTagWithNormalEquivalent(data) && (!(options?.contextStack ?? []).find(({ tag }) => (['Name', 'Description'].includes(tag))))) {
                const translatedData = this._translate(
                    { ...node, contextStack: options?.contextStack ?? [] },
                    data
                )
                const { key } = translatedData
                this._normalForm = produce(this._normalForm, (draft) => {
                    if (!(key in draft)) {
                        draft[key] = {
                            ...translatedData,
                            appearances: []
                        }
                    }
                    draft[key].appearances = [
                        ...(this._normalForm?.[key]?.appearances || []),
                        translatedData.appearances?.[0] as any
                    ]
                })
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
                const recursiveChildren = this._loadSchemaHelper(children, { contextStack: [...options?.contextStack ?? [], reference.data] })
                this._normalForm = produce(this._normalForm, (draft) => {
                    draft[key].appearances = [
                        ...(this._normalForm[key].appearances ?? []).slice(0, -1),
                        {
                            ...appearance,
                            children: recursiveChildren
                        } as any
                    ]
                })
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
                .filter(({ appearances = [] }) => (Boolean(appearances.find(({ contextStack }) => (contextStack.find((data) => (isNormalReference(data) && data.key === node.key)))))))
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
                const contextNodes = contextStack.map((data) => (isNormalReference(data) ? this._lookupAppearance(data) : { data })).map((node) => (node ? [{ data: node.data }] : [])).flat(1)
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
