//
// standardizeNormal creates a new NormalForm with the exact same semantic content as the input,
// but with everything organized in a standard structure (see README.standardize.md)
//

import Normalizer from ".";
import { NormalForm, isNormalAsset, isNormalRoom, NormalItem, ComponentRenderItem, isNormalCondition, NormalRoom, NormalFeature, NormalBookmark, ComponentAppearance, isNormalFeature, isNormalBookmark, NormalMap, isNormalMap, isNormalMessage, NormalMessage, isNormalMoment, NormalMoment, isNormalVariable, isNormalComputed, isNormalAction, isNormalImport, NormalImport, isNormalKnowledge, NormalKnowledge } from "./baseClasses"
import { SchemaTaggedMessageLegalContents, isSchemaRoom, isSchemaFeature, isSchemaBookmark, SchemaExitTag, SchemaBookmarkTag, isSchemaCondition, SchemaTaggedMessageIncomingContents, SchemaMapLegalContents, isSchemaMap, SchemaTag, isSchemaMapContents, isSchemaImage, SchemaMessageLegalContents, isSchemaMessage, isSchemaMessageContents, SchemaMessageTag, isSchemaMoment, SchemaComputedTag, isSchemaImport, SchemaImportMapping, isSchemaKnowledge, isSchemaTaggedMessageLegalContents, SchemaConditionTag, isImportableTag, isSchemaWithKey } from "../simpleSchema/baseClasses"
import { decodeLegacyContentStructure, extractConditionedItemFromContents, extractNameFromContents, legacyContentStructure } from "../simpleSchema/utils";
import { GenericTree, GenericTreeNode } from "../sequence/tree/baseClasses";
import dfsWalk from "../sequence/tree/dfsWalk"
import { selectRender } from "./selectors/render"
import { selectName } from "./selectors/name"
import { selectMapRooms } from "./selectors/mapRooms"
import { selectImages } from './selectors/images'

const normalAlphabeticKeySort = ({ key: keyA }: NormalItem, { key: keyB }: NormalItem) => (keyA.localeCompare(keyB))

// const extractConditionedRender = (contextNormalizer: Normalizer) => (item: NormalRoom | NormalFeature | NormalKnowledge | NormalBookmark | NormalMessage) => {
//     const { appearances } = item
//     const render = (appearances as ComponentAppearance[]).reduce<GenericTree<SchemaTag>>((previous, { contextStack }, index ) => {
//         const schemaVersion = contextNormalizer._normalToSchema(item.key, index)
//         if (!(schemaVersion && (isSchemaRoom(schemaVersion.data) || isSchemaFeature(schemaVersion.data) || isSchemaKnowledge(schemaVersion.data) || isSchemaBookmark(schemaVersion.data) || isSchemaMessage(schemaVersion.data)))) {
//             return previous
//         }
//         const render = isSchemaBookmark(schemaVersion.data) ? schemaVersion.data.contents : schemaVersion.data.render
//         if (!render.length) {
//             return previous
//         }
//         const newRender = contextStack
//             .filter(({ tag }) => (tag === 'If'))
//             .reduceRight<GenericTree<SchemaTag>>((previous, { key }) => {
//                 const ifReference = contextNormalizer.normal[key]
//                 if (!(ifReference && isNormalCondition(ifReference))) {
//                     return previous
//                 }
//                 const returnValue: GenericTreeNode<SchemaTag> = {
//                     data: {
//                         tag: 'If' as 'If',
//                         conditions: ifReference.conditions,
//                         contents: []
//                     },
//                     children: previous
//                 }
//                 return [returnValue]
//             }, decodeLegacyContentStructure(render.filter(isSchemaTaggedMessageLegalContents)))
//         return [
//             ...previous,
//             ...newRender
//         ]
//     }, [])

//     return render
// }

// const extractConditionedName = (contextNormalizer: Normalizer) => (item: NormalRoom | NormalFeature | NormalKnowledge) => {
//     const { appearances } = item
//     const name = appearances.reduce<SchemaTaggedMessageLegalContents[]>((previous, { contextStack }, index ) => {
//         const schemaVersion = contextNormalizer._normalToSchema(item.key, index)
//         if (!(schemaVersion && (isSchemaRoom(schemaVersion.data) || isSchemaFeature(schemaVersion.data) || isSchemaKnowledge(schemaVersion.data)))) {
//             return previous
//         }
//         const { name } = schemaVersion.data
//         if (!name.length) {
//             return previous
//         }
//         const newName = contextStack
//             .filter(({ tag }) => (tag === 'If'))
//             .reduceRight<SchemaTaggedMessageLegalContents[]>((previous, { key }) => {
//                 const ifReference = contextNormalizer.normal[key]
//                 if (!(ifReference && isNormalCondition(ifReference))) {
//                     return previous
//                 }
//                 const returnValue: SchemaConditionTag = {
//                     tag: 'If' as 'If',
//                     conditions: ifReference.conditions,
//                     contents: previous
//                 }
//                 return [returnValue]
//             }, name)
//         return [
//             ...previous,
//             ...newName
//         ]
//     }, [])

//     return name
// }

const extractConditionedExits = (contextNormalizer: Normalizer) => (item: NormalRoom) => {
    const { appearances } = item
    const returnContents = appearances.reduce<(SchemaExitTag | SchemaConditionTag)[]>((previous, { contextStack }, index ) => {
        const schemaVersion = contextNormalizer._normalToSchema(item.key, index)
        if (!(schemaVersion && isSchemaRoom(schemaVersion.data))) {
            return previous
        }
        const contents = schemaVersion.children.map(({ data }) => (data)).filter((tag: SchemaTag): tag is (SchemaExitTag | SchemaConditionTag) => (['If', 'Exit'].includes(tag.tag)))
        if (!contents.length) {
            return previous
        }
        const newContents = contextStack
            .filter(({ tag }) => (tag === 'If'))
            .reduceRight<(SchemaExitTag | SchemaConditionTag)[]>((previous, { key }) => {
                const ifReference = contextNormalizer.normal[key]
                if (!(ifReference && isNormalCondition(ifReference))) {
                    return previous
                }
                const returnValue: SchemaConditionTag = {
                    tag: 'If' as 'If',
                    conditions: ifReference.conditions,
                    contents: previous
                }
                return [returnValue]
            }, contents)
        return [
            ...previous,
            ...newContents
        ]
    }, [])

    return returnContents
}

const extractBookmarkReferences = (items: GenericTree<SchemaTag>) => {
    const returnContents = dfsWalk({
        default: { output: [] as string[], state: [] },
        callback: (previous, item: SchemaTag) => {
            if (isSchemaBookmark(item)) {
                return { output: [...previous.output, item.key], state: {} }
            }
            return previous
        }
    })(items)

    return [...(new Set(returnContents))]
}

const extractConditionedMapContents = (contextNormalizer: Normalizer) => (item: NormalMap) => {
    const { appearances } = item
    //
    // Separately aggregate appearances into a single appearance, wrapping conditions around
    // both contents and Name information
    //
    const returnContents = appearances.reduce<{ contents: SchemaMapLegalContents[]; name: SchemaTaggedMessageLegalContents[] }>((previous, { contextStack }, index ) => {
        const schemaVersion = contextNormalizer._normalToSchema(item.key, index)
        if (!(schemaVersion && isSchemaMap(schemaVersion.data))) {
            return previous
        }
        const contents = schemaVersion.children.map(({ data }) => (data))
        if (!contents.length) {
            return previous
        }
        const newContents = contextStack
            .filter(({ tag }) => (tag === 'If'))
            .reduceRight<SchemaMapLegalContents[]>((previous, { key }) => {
                const ifReference = contextNormalizer.normal[key]
                if (!(ifReference && isNormalCondition(ifReference))) {
                    return previous
                }
                const returnValue: SchemaConditionTag = {
                    tag: 'If' as 'If',
                    conditions: ifReference.conditions,
                    contents: previous
                }
                return [returnValue]
            }, contents.filter(isSchemaMapContents))
        return {
            contents: [
                ...previous.contents,
                ...newContents
            ],
            name: [
                ...previous.name,
                ...(schemaVersion.data.name ?? [])
            ]
        }
    }, { contents: [], name: [] })

    return returnContents
}

const extractConditionedMessageContents = (contextNormalizer: Normalizer) => (item: NormalMessage) => {
    const { appearances } = item
    const returnContents = appearances.reduce<SchemaMessageLegalContents[]>((previous, _, index ) => {
        const schemaVersion = contextNormalizer._normalToSchema(item.key, index)
        if (!(schemaVersion && isSchemaMessage(schemaVersion.data))) {
            return previous
        }
        const contents = schemaVersion.children.map(({ data }) => (data)).filter(isSchemaMessageContents)
        if (!contents.length) {
            return previous
        }
        //
        // TODO: Extend this functionality when Messages are refactored to include conditionals
        //

        // const newContents = contextStack
        //     .filter(({ tag }) => (tag === 'If'))
        //     .reduceRight<SchemaMessageLegalContents[]>((previous, { key }) => {
        //         const ifReference = contextNormalizer.normal[key]
        //         if (!(ifReference && isNormalCondition(ifReference))) {
        //             return previous
        //         }
        //         const returnValue: SchemaConditionTagMapContext = {
        //             tag: 'If' as 'If',
        //             conditions: ifReference.conditions,
        //             contents: previous
        //         }
        //         return [returnValue]
        //     }, contents)
        return [
            ...previous,
            ...contents
        ]
    }, [])

    return returnContents
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
        //
        // TODO: Extend this functionality when Messages are refactored to include conditionals
        //

        // const newContents = contextStack
        //     .filter(({ tag }) => (tag === 'If'))
        //     .reduceRight<SchemaMessageLegalContents[]>((previous, { key }) => {
        //         const ifReference = contextNormalizer.normal[key]
        //         if (!(ifReference && isNormalCondition(ifReference))) {
        //             return previous
        //         }
        //         const returnValue: SchemaConditionTagMapContext = {
        //             tag: 'If' as 'If',
        //             conditions: ifReference.conditions,
        //             contents: previous
        //         }
        //         return [returnValue]
        //     }, contents)
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

export const standardizeNormal = (normal: NormalForm): NormalForm => {
    const argumentNormalizer = new Normalizer()
    argumentNormalizer.loadNormal(normal)

    //
    // Isolate the wrapping asset node and add it to the results
    //
    const rootNode = Object.values(normal).find(({ appearances }) => (appearances.find(({ contextStack }) => (contextStack.length === 0))))
    if (!isNormalAsset(rootNode)) {
        return {}
    }
    const resultNormalizer = new Normalizer()
    resultNormalizer._tags = { ...argumentNormalizer._tags }
    resultNormalizer.put({ data: { tag: 'Asset', key: rootNode.key, contents: [], Story: undefined }, children: [] }, { contextStack: [] })

    //
    // Add standardized view of all Bookmarks in graph-sorted order
    //
    const bookmarkValues: GenericTree<SchemaTag> = Object.values(normal)
        .filter(isNormalBookmark)
        .sort(normalAlphabeticKeySort)
        .map((bookmark): GenericTreeNode<SchemaTag> => {
            const render = argumentNormalizer.select({ key: bookmark.key, selector: selectRender })
            return {
                data: {
                    tag: 'Bookmark',
                    key: bookmark.key,
                    contents: []
                },
                children: render,
            }
        })
    //
    // TODO: Refactor the below by borrowing the graph utilities from mtw-utilities,
    // making a Graph of references, and then applying the topologicalSort
    // to order the bookmarks
    //
    const bookmarkReferences: Record<string, string[]> = bookmarkValues
        .reduce<Record<string, string[]>>((previous, { data, children }) => {
            if (isSchemaBookmark(data)) {
                return {
                    ...previous,
                    [data.key]: extractBookmarkReferences(children)
                }    
            }
            return previous
        }, {})
    let alreadyWrittenKeys: string[] = []
    while(alreadyWrittenKeys.length < bookmarkValues.length) {
        let contentWritten = false
        bookmarkValues
            .filter(({ data }) => (
                isSchemaWithKey(data) &&
                !alreadyWrittenKeys.includes(data.key) &&
                (!(bookmarkReferences[data.key] || []).find((ref) => (!alreadyWrittenKeys.includes(ref))))
            ))
            .forEach((item) => {
                resultNormalizer.put(item, { 
                    contextStack: [{
                        key: rootNode.key,
                        tag: 'Asset',
                        index: 0
                    }]
                })
                const { data } = item
                if (isSchemaWithKey(data)) {
                    alreadyWrittenKeys.push(data.key)
                }
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
            console.log(`normal to render: ${JSON.stringify(argumentNormalizer.normal, null, 4)}`)
            const render = argumentNormalizer.select({ key: room.key, selector: selectRender })
            console.log(`render: ${JSON.stringify(render, null, 4)}`)
            const name = argumentNormalizer.select({ key: room.key, selector: selectName })
            resultNormalizer.put({
                data: {
                    tag: 'Room',
                    key: room.key,
                    contents: [],
                },
                children: ([
                    ...(name.length ? [{
                        data: { tag: 'Name' as const, contents: [] },
                        children: name
                    }] : []),
                    ...(render.length ? [{
                        data: { tag: 'Description' as const, contents: [] },
                        children: render
                    }] : []),
                    ...decodeLegacyContentStructure(extractConditionedExits(argumentNormalizer)(room)),
                ])
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
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
            resultNormalizer.put({
                data: {
                    tag: 'Feature',
                    key: feature.key,
                    contents: [],
                },
                children: [
                    ...(name.length ? [{
                        data: { tag: 'Name' as const, contents: [] },
                        children: name
                    }] : []),
                    ...(render.length ? [{
                        data: { tag: 'Description' as const, contents: [] },
                        children: render
                    }] : []),
                ]
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
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
            resultNormalizer.put({
                data: {
                    tag: 'Knowledge',
                    key: knowledge.key,
                    contents: [],
                },
                children: [
                    ...(name.length ? [{
                        data: { tag: 'Name' as const, contents: [] },
                        children: name
                    }] : []),
                    ...(render.length ? [{
                        data: { tag: 'Description' as const, contents: [] },
                        children: render
                    }] : []),
                ]
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
            })

        })

    //
    // Add standardized view of all Maps to the results
    //
    Object.values(normal)
        .filter(isNormalMap)
        .sort(normalAlphabeticKeySort)
        .forEach((map) => {
            const { contents, name } = extractConditionedMapContents(argumentNormalizer)(map)
            const rooms = argumentNormalizer.select({ key: map.key, selector: selectMapRooms })
            const nameChildren = argumentNormalizer.select({ key: map.key, selector: selectName })
            const images = argumentNormalizer.select({ key: map.key, selector: selectImages })

            resultNormalizer.put({
                data: {
                    tag: 'Map',
                    key: map.key,
                    name,
                    contents: [],
                    rooms: extractConditionedItemFromContents({
                        contents: decodeLegacyContentStructure(contents),
                        typeGuard: isSchemaRoom,
                        transform: ({ key, x, y }) => ({ conditions: [], key, x, y })
                    }),
                    images: (contents as SchemaTag[]).filter(isSchemaImage).map(({ key }) => (key))
                },
                children: [
                    ...(nameChildren.length ? [{
                        data: { tag: 'Name' as const, contents: [] },
                        children: nameChildren
                    }] : []),
                    ...images,
                    ...rooms
                ]
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
            })

        })

    //
    // Add standardized view of all Messages to the results
    //
    Object.values(normal)
        .filter(isNormalMessage)
        .sort(normalAlphabeticKeySort)
        .forEach((message) => {
            const contents = extractConditionedMessageContents(argumentNormalizer)(message)
            const children = stripComponentContents(decodeLegacyContentStructure(contents))
            resultNormalizer.put({
                data: {
                    tag: 'Message',
                    key: message.key,
                    contents: [],
                    rooms: extractConditionedItemFromContents({
                        contents: children,
                        typeGuard: isSchemaRoom,
                        transform: ({ key }) => ({ conditions: [], key })
                    }),
                },
                children
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
            })

        })

    //
    // Add standardized view of all Messages to the results
    //
    Object.values(normal)
        .filter(isNormalMoment)
        .sort(normalAlphabeticKeySort)
        .forEach((moment) => {
            const children = extractConditionedMomentChildren(argumentNormalizer)(moment)
            resultNormalizer.put({
                data: {
                    tag: 'Moment',
                    key: moment.key,
                    contents: []
                },
                children
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
            })

        })

    //
    // Add standardized view of all Variables to the results
    //
    Object.values(normal)
        .filter(isNormalVariable)
        .sort(normalAlphabeticKeySort)
        .forEach((variable) => {
            resultNormalizer.put({
                data: {
                    tag: 'Variable',
                    key: variable.key,
                    default: variable.default
                },
                children: []
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
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
                [key]: dependencies.filter((depend) => (computedValues.map(({ key }) => (key)).includes(depend)))
            }
        }, {})
    let alreadyWrittenComputes: string[] = []
    while(alreadyWrittenComputes.length < computedValues.length) {
        let contentWritten = false
        computedValues
            .filter(({ key }) => (!alreadyWrittenComputes.includes(key)))
            .filter(({ key }) => (!(computedReferences[key] || []).find((ref) => (!alreadyWrittenComputes.includes(ref)))))
            .forEach((item) => {
                resultNormalizer.put({ data: item, children: [] }, { 
                    contextStack: [{
                        key: rootNode.key,
                        tag: 'Asset',
                        index: 0
                    }]
                })
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
            resultNormalizer.put({
                data: {
                    tag: 'Action',
                    key: action.key,
                    src: action.src
                },
                children: []
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
            })

        })

    //
    // Add standardized view of all Imports to the results
    //
    Object.values(normal)
        .filter(isNormalImport)
        .sort(normalAlphabeticKeySort)
        .forEach((importItem) => {
            resultNormalizer.put({
                data: {
                    tag: 'Import',
                    from: importItem.from,
                    mapping: extractImportMapping(argumentNormalizer)(importItem)
                },
                //
                // TODO: Children in Import
                //
                children: []
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
            })
        })

    //
    // Add standardized view of all Exports to the results
    //
    const exportItems = Object.values(normal)
        .filter(({ tag }) => (isImportableTag(tag)))
        .filter(({ key, exportAs }) => (exportAs && exportAs !== key))
        .sort(normalAlphabeticKeySort)
        .map(({ tag, key, exportAs }) => ({ [exportAs]: { key, type: tag }}))

    if (exportItems.length) {
        resultNormalizer.put({
            data: {
                tag: 'Export',
                mapping: Object.assign({}, ...exportItems)
            },
            //
            // TODO: Children in export
            //
            children: []
        }, { 
            contextStack: [{
                key: rootNode.key,
                tag: 'Asset',
                index: 0
            }]
        })
    }

    return resultNormalizer.normal
}

export default standardizeNormal
