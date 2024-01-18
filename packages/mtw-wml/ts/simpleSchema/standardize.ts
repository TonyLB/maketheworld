//
// standardizeSchema creates a new schema with the exact same semantic content as the input,
// but with everything organized in a standard structure (see README.standardize.md)
//

import { isSchemaRoom, isSchemaBookmark, SchemaTag, isSchemaMessage, isSchemaMoment, SchemaComputedTag, isSchemaImport, SchemaImportMapping, isImportableTag, isSchemaWithKey, SchemaOutputTag } from "../simpleSchema/baseClasses"
import { GenericTree, GenericTreeNode } from "../sequence/tree/baseClasses";
import dfsWalk from "../sequence/tree/dfsWalk"
import { selectRender } from "../normalize/selectors/render"
import { selectName } from "../normalize/selectors/name"
import { selectMapRooms } from "../normalize/selectors/mapRooms"
import { selectImages } from '../normalize/selectors/images'
import { selectExits } from "../normalize/selectors/exits";
import { selectRooms } from "../normalize/selectors/rooms";
import Normalizer from "../normalize";
import { NormalBookmark, NormalImport, NormalItem, NormalMoment, isNormalAction, isNormalAsset, isNormalBookmark, isNormalComputed, isNormalFeature, isNormalImport, isNormalKnowledge, isNormalMap, isNormalMessage, isNormalMoment, isNormalRoom, isNormalVariable } from "../normalize/baseClasses";
import { selectKeysReferenced } from "../normalize/selectors/keysReferenced";

const normalAlphabeticKeySort = ({ key: keyA }: NormalItem, { key: keyB }: NormalItem) => (keyA.localeCompare(keyB))

const extractBookmarkReferences = (items: GenericTree<SchemaTag>) => {
    const returnContents = dfsWalk({
        default: { output: [], state: {} },
        callback: (previous: { output: string[], state: {} }, item: SchemaTag) => {
            if (isSchemaBookmark(item)) {
                return { output: [...previous.output, item.key], state: {} }
            }
            return previous
        }
    })(items)

    return [...(new Set(returnContents))]
}

const extractConditionedMomentChildren = (contextNormalizer: Normalizer) => (item: NormalMoment) => {
    const { appearances } = item
    const returnContents = appearances.reduce<GenericTree<SchemaTag>>((previous, _, index ) => {
        const schemaVersion = contextNormalizer._normalToSchema(item.key, index)
        if (!(schemaVersion && isSchemaMoment(schemaVersion.data))) {
            return previous
        }
        const children = stripComponentContents(schemaVersion.children)
            .map(({ data, children }) => (isSchemaMessage(data) ? { data, children: [] } : { data, children }))
        return [
            ...previous,
            ...children
        ]
    }, [])

    return returnContents
}

const extractImportMapping = (contextNormalizer: Normalizer) => (item: NormalImport) => {
    const { appearances } = item
    const returnContents = appearances.reduce<Record<string, SchemaImportMapping>>((previous, _, index ) => {
        const schemaVersion = contextNormalizer._normalToSchema(item.key, index)
        if (!(schemaVersion && isSchemaImport(schemaVersion.data))) {
            return previous
        }

        return {
            ...previous,
            ...schemaVersion.data.mapping
        }
    }, {})

    return returnContents
}

const stripComponentContents = (items: GenericTree<SchemaTag>): GenericTree<SchemaTag> => {
    return items.map((item) => {
        const { data, children } = item
        const strippedData = (
            isSchemaRoom(data)
                ? { ...data, contents: [] }
                : isSchemaMessage(data)
                    ? { ...data, contents: [], rooms: [] }
                    : isSchemaBookmark(data)
                        ? { ...data, contents: [] }
                        : data
        )
        return {
            data: strippedData,
            children: stripComponentContents(children)
        }
    })
}

export const standardizeSchema = (schema: GenericTree<SchemaTag>): GenericTree<SchemaTag> => {
    const argumentNormalizer = new Normalizer()
    argumentNormalizer.loadSchema(schema)
    const normal = argumentNormalizer.normal

    //
    // Isolate the wrapping asset node and add it to the results
    //
    const rootNode = Object.values(normal).find(({ appearances = [] }) => (appearances.find(({ contextStack }) => (contextStack.length === 0))))
    if (!(rootNode && isNormalAsset(rootNode))) {
        return []
    }
    let topLevelItems: GenericTree<SchemaTag> = []
    const resultNormalizer = new Normalizer()
    resultNormalizer._tags = { ...argumentNormalizer._tags }
    resultNormalizer.put({ data: { tag: 'Asset', key: rootNode.key, Story: undefined }, children: [] }, { contextStack: [] })

    //
    // Add standardized view of all Bookmarks in graph-sorted order
    //
    const bookmarkValues: { key: string, render: GenericTree<SchemaOutputTag> }[] = Object.values(normal)
        .filter(isNormalBookmark)
        .sort(normalAlphabeticKeySort)
        .map(({ key }) => ({
            key,
            render: argumentNormalizer.select({ key, selector: selectRender }),
        }))
    const bookmarkReferences = bookmarkValues
        .map((bookmark): Record<string, string[]> => {
            const references = argumentNormalizer
                .select({ key: bookmark.key, selector: selectKeysReferenced })
                .filter((key) => (key in normal && isNormalBookmark(normal[key])))
            return { [bookmark.key]: references }
        })
    //
    // TODO: Refactor the below by borrowing the graph utilities from mtw-utilities,
    // making a Graph of references, and then applying the topologicalSort
    // to order the bookmarks
    //
    let alreadyWrittenKeys: string[] = []
    while(alreadyWrittenKeys.length < bookmarkValues.length) {
        let contentWritten = false
        bookmarkValues
            .filter(({ key }) => (
                !alreadyWrittenKeys.includes(key) &&
                (!(bookmarkReferences[key] || []).find((ref) => (!alreadyWrittenKeys.includes(ref))))
            ))
            .forEach((item) => {
                topLevelItems.push({
                    data: {
                        key: item.key,
                        tag: 'Bookmark',
                    },
                    children: item.render
                })
                alreadyWrittenKeys.push(item.key)
                contentWritten = true
            })
        if (!contentWritten) {
            break
        }
    }

    //
    // Add standardized view of all Rooms to the results
    //
    Object.values(normal)
        .filter(isNormalRoom)
        .sort(normalAlphabeticKeySort)
        .forEach((room) => {
            const render = argumentNormalizer.select({ key: room.key, selector: selectRender })
            const name = argumentNormalizer.select({ key: room.key, selector: selectName })
            const exits = argumentNormalizer.select({ key: room.key, selector: selectExits })
            topLevelItems.push({
                data: {
                    tag: 'Room',
                    key: room.key
                },
                children: ([
                    ...(name.length ? [{
                        data: { tag: 'Name' as const },
                        children: name
                    }] : []),
                    ...(render.length ? [{
                        data: { tag: 'Description' as const },
                        children: render
                    }] : []),
                    ...exits,
                ])
            })
        })

    //
    // Add standardized view of all Features to the results
    //
    Object.values(normal)
        .filter(isNormalFeature)
        .sort(normalAlphabeticKeySort)
        .forEach((feature) => {
            const render = argumentNormalizer.select({ key: feature.key, selector: selectRender })
            const name = argumentNormalizer.select({ key: feature.key, selector: selectName })
            topLevelItems.push({
                data: {
                    tag: 'Feature',
                    key: feature.key
                },
                children: [
                    ...(name.length ? [{
                        data: { tag: 'Name' as const },
                        children: name
                    }] : []),
                    ...(render.length ? [{
                        data: { tag: 'Description' as const },
                        children: render
                    }] : []),
                ]
            })

        })

    //
    // Add standardized view of all Knowledges to the results
    //
    Object.values(normal)
        .filter(isNormalKnowledge)
        .sort(normalAlphabeticKeySort)
        .forEach((knowledge) => {
            const render = argumentNormalizer.select({ key: knowledge.key, selector: selectRender })
            const name = argumentNormalizer.select({ key: knowledge.key, selector: selectName })
            topLevelItems.push({
                data: {
                    tag: 'Knowledge',
                    key: knowledge.key
                },
                children: [
                    ...(name.length ? [{
                        data: { tag: 'Name' as const },
                        children: name
                    }] : []),
                    ...(render.length ? [{
                        data: { tag: 'Description' as const },
                        children: render
                    }] : []),
                ]
            })

        })

    //
    // Add standardized view of all Maps to the results
    //
    Object.values(normal)
        .filter(isNormalMap)
        .sort(normalAlphabeticKeySort)
        .forEach((map) => {
            const rooms = argumentNormalizer.select({ key: map.key, selector: selectMapRooms })
            const nameChildren = argumentNormalizer.select({ key: map.key, selector: selectName })
            const images = argumentNormalizer.select({ key: map.key, selector: selectImages })

            topLevelItems.push({
                data: {
                    tag: 'Map',
                    key: map.key,
                    name: [{ tag: 'String', value: ' '}],
                    rooms: [],
                    images: []
                },
                children: [
                    ...(nameChildren.length ? [{
                        data: { tag: 'Name' as const },
                        children: nameChildren
                    }] : []),
                    ...images,
                    ...rooms
                ]
            })

        })

    //
    // Add standardized view of all Messages to the results
    //
    Object.values(normal)
        .filter(isNormalMessage)
        .sort(normalAlphabeticKeySort)
        .forEach((message) => {
            const render = argumentNormalizer.select({ key: message.key, selector: selectRender })
            const rooms = argumentNormalizer.select({ key: message.key, selector: selectRooms })
            topLevelItems.push({
                data: {
                    tag: 'Message',
                    key: message.key,
                    //
                    // TODO: Create specialized rooms selector that recreates the legacy structure
                    //
                    rooms: [],
                },
                children: [
                    ...render,
                    ...rooms
                ]
            })

        })

    //
    // Add standardized view of all Moments to the results
    //
    Object.values(normal)
        .filter(isNormalMoment)
        .sort(normalAlphabeticKeySort)
        .forEach((moment) => {
            const children = extractConditionedMomentChildren(argumentNormalizer)(moment)
            topLevelItems.push({
                data: {
                    tag: 'Moment',
                    key: moment.key
                },
                children
            })

        })

    //
    // Add standardized view of all Variables to the results
    //
    Object.values(normal)
        .filter(isNormalVariable)
        .sort(normalAlphabeticKeySort)
        .forEach((variable) => {
            topLevelItems.push({
                data: {
                    tag: 'Variable',
                    key: variable.key,
                    default: variable.default
                },
                children: []
            })

        })

    //
    // Add standardized view of all ComputedValues in graph-sorted order
    //
    const computedValues: SchemaComputedTag[] = Object.values(normal)
        .filter(isNormalComputed)
        .sort(normalAlphabeticKeySort)
        .map((computed) => ({
            tag: 'Computed',
            key: computed.key,
            src: computed.src,
            dependencies: computed.dependencies
        }))
    const computedReferences: Record<string, string[]> = computedValues
        .reduce<Record<string, string[]>>((previous, { key, dependencies }) => {
            return {
                ...previous,
                [key]: (dependencies ?? []).filter((depend) => (computedValues.map(({ key }) => (key)).includes(depend)))
            }
        }, {})
    let alreadyWrittenComputes: string[] = []
    while(alreadyWrittenComputes.length < computedValues.length) {
        let contentWritten = false
        computedValues
            .filter(({ key }) => (!alreadyWrittenComputes.includes(key)))
            .filter(({ key }) => (!(computedReferences[key] || []).find((ref) => (!alreadyWrittenComputes.includes(ref)))))
            .forEach((item) => {
                topLevelItems.push({ data: item, children: [] })
                alreadyWrittenComputes.push(item.key)
                contentWritten = true
            })
        if (!contentWritten) {
            break
        }
    }

    //
    // Add standardized view of all Actions to the results
    //
    Object.values(normal)
        .filter(isNormalAction)
        .sort(normalAlphabeticKeySort)
        .forEach((action) => {
            topLevelItems.push({
                data: {
                    tag: 'Action',
                    key: action.key,
                    src: action.src
                },
                children: []
            })

        })

    //
    // Add standardized view of all Imports to the results
    //
    Object.values(normal)
        .filter(isNormalImport)
        .sort(normalAlphabeticKeySort)
        .forEach((importItem) => {
            topLevelItems.push({
                data: {
                    tag: 'Import',
                    from: importItem.from,
                    mapping: extractImportMapping(argumentNormalizer)(importItem)
                },
                //
                // TODO: Children in Import
                //
                children: []
            })
        })

    //
    // Add standardized view of all Exports to the results
    //
    const exportItems = Object.values(normal)
        .filter(({ tag }) => (isImportableTag(tag)))
        .filter(({ key, exportAs }) => (exportAs && exportAs !== key))
        .sort(normalAlphabeticKeySort)
        .map(({ tag, key, exportAs }) => (exportAs ? { [exportAs]: { key, type: tag }} : {}))

    if (exportItems.length) {
        topLevelItems.push({
            data: {
                tag: 'Export',
                mapping: Object.assign({}, ...exportItems)
            },
            //
            // TODO: Children in export
            //
            children: []
        })
    }

    return [{
        data: {
            tag: 'Asset',
            key: rootNode.key,
            Story: undefined
        },
        children: topLevelItems
    }]
}

export default standardizeSchema
