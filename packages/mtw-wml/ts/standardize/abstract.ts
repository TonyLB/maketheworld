import { v4 as uuidv4 } from 'uuid'
import { deepEqual, objectMap } from "../lib/objects"
import { unique } from "../list"
import { selectKeysByTag } from "../schema/selectors/keysByTag"
import { SchemaAssetTag, SchemaCharacterTag, SchemaDescriptionTag, SchemaExportTag, SchemaFirstImpressionTag, SchemaImageTag, SchemaImportTag, SchemaNameTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaOutputTag, SchemaPronounsTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaWithKey, isSchemaAction, isSchemaTheme, isSchemaAsset, isSchemaBookmark, isSchemaCharacter, isSchemaComputed, isSchemaConditionStatement, isSchemaDescription, isSchemaExport, isSchemaFeature, isSchemaFirstImpression, isSchemaImage, isSchemaImport, isSchemaKnowledge, isSchemaMap, isSchemaMessage, isSchemaMoment, isSchemaName, isSchemaOneCoolThing, isSchemaOutfit, isSchemaOutputTag, isSchemaPronouns, isSchemaRoom, isSchemaShortName, isSchemaSummary, isSchemaTag, isSchemaVariable, isSchemaWithKey, isSchemaPrompt, isSchemaCondition, isSchemaConditionFallthrough, isSchemaExit, isImportable, isSchemaReplace, isSchemaEdit, SchemaRemoveTag, SchemaReplaceTag, SchemaReplaceMatchTag, SchemaReplacePayloadTag, isSchemaRemove, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaPronouns, isSchemaMeta } from "../schema/baseClasses"
import { markInherited } from "../schema/treeManipulation/inherited"
import { TagListItem, TagTreeMatchOperation } from "../tagTree"
import SchemaTagTree from "../tagTree/schema"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, treeNodeTypeguard } from "../tree/baseClasses"
import { treeTypeGuard } from "../tree/filter"
import { map } from "../tree/map"
import { SerializableStandardComponent, SerializableStandardForm, StandardComponent, isStandardTheme, isStandardBookmark, isStandardFeature, isStandardKnowledge, isStandardMap, isStandardMessage, isStandardMoment, isStandardRoom, StandardForm, StandardNodeKeys, StandardRoomUpdate, StandardRoom, StandardKnowledge, StandardFeature, StandardBookmark, StandardMessage, StandardMap, StandardTheme, EditInternalStandardNode, EditWrappedStandardNode, StandardComponentNonEdit, isStandardNonEdit, MergeConflictError, StandardizerError, isStandardRemove, isStandardReplace, unwrapStandardComponent } from "./baseClasses"
import { excludeUndefined } from '../lib/lists'
import { combineTagChildren } from './utils'
import applyEdits from '../schema/treeManipulation/applyEdits'
import { wrappedNodeTypeGuard } from '../schema/utils'

export const assertTypeguard = <T extends any, G extends T>(value: T, typeguard: (value) => value is G): G => {
    if (typeguard(value)) {
        return value
    }
    throw new Error('Type mismatch')
}

export const defaultSelected = <Extra extends {}>(tree: GenericTree<SchemaTag, Extra>): GenericTree<SchemaTag, Extra> => (
    tree.map((node) => {
        if (treeNodeTypeguard(isSchemaCondition)(node)) {
            const indexOfFirstSelected = node.children.findIndex(({ data }) => ((isSchemaConditionStatement(data) || isSchemaConditionFallthrough(data)) && (data.selected ?? false) ))
            if (indexOfFirstSelected !== -1) {
                return {
                    ...node,
                    children: defaultSelected(node.children.map((child, index) => (
                        treeNodeTypeguard(isSchemaConditionStatement)(child) || treeNodeTypeguard(isSchemaConditionFallthrough)(child)
                            ? { ...child, data: { ...child.data, selected: index === indexOfFirstSelected ? true : undefined } }
                            : child
                    )))
                }
            }
            else {
                const fallThroughIndex = node.children.findIndex(treeNodeTypeguard(isSchemaConditionFallthrough))
                return {
                    ...node,
                    children: defaultSelected(node.children.map((child, index) => (
                        treeNodeTypeguard(isSchemaConditionStatement)(child) || treeNodeTypeguard(isSchemaConditionFallthrough)(child)
                            ? { ...child, data: { ...child.data, selected: index === fallThroughIndex } }
                            : child
                    )))
                }
            }
        }
        return {
            ...node,
            children: defaultSelected(node.children)
        }
    })
)

const outputNodeUnedited = <T extends SchemaTag, ChildType extends SchemaTag>(
    node: GenericTreeNodeFiltered<T, SchemaTag> | undefined,
    typeGuard: (value: SchemaTag) => value is ChildType,
    defaultValue: T
): EditInternalStandardNode<T, ChildType> => {
    return node
        ? { ...node, children: treeTypeGuard({ tree: defaultSelected(node.children), typeGuard }) }
        : { data: defaultValue, children: [] }
}

const outputNodeToStandardItem = <T extends SchemaTag, ChildType extends SchemaTag>(
    node: GenericTreeNode<SchemaTag> | undefined,
    typeGuard: (value: SchemaTag) => value is T,
    childTypeGuard: (value: SchemaTag) => value is ChildType,
    defaultValue: T
): EditWrappedStandardNode<T, ChildType> => {
    if (node) {
        if (treeNodeTypeguard(isSchemaRemove)(node)) {
            return {
                ...node,
                children: node.children
                    .filter(treeNodeTypeguard(typeGuard))
                    .map((child) => (outputNodeUnedited<T, ChildType>(child, childTypeGuard, defaultValue)))
            }
        }
        if (treeNodeTypeguard(isSchemaReplace)(node)) {
            return {
                ...node,
                children: node.children
                    .filter((child): child is GenericTreeNodeFiltered<SchemaReplaceMatchTag | SchemaReplacePayloadTag, SchemaTag> => (treeNodeTypeguard(isSchemaReplaceMatch)(child) || treeNodeTypeguard(isSchemaReplacePayload)(child)))
                    .map((child) => ({
                        ...child,
                        children: child.children
                            .filter(treeNodeTypeguard(typeGuard))
                            .map((innerChild) => (outputNodeUnedited(innerChild, childTypeGuard, defaultValue)))
                    }))
            }
        }
        if (treeNodeTypeguard(typeGuard)(node)) {
            return outputNodeUnedited<T, ChildType>(node, childTypeGuard, defaultValue)
        }
    }
    return { data: defaultValue, children: [] }
}

const transformStandardItem = <T extends SchemaTag, ChildType extends SchemaTag>(
    callback: (tree: GenericTree<SchemaTag>) => GenericTree<SchemaTag>,
    typeGuard: (value: SchemaTag) => value is T,
    childTypeGuard: (value: SchemaTag) => value is ChildType,
    defaultValue: T
) => (node: EditWrappedStandardNode<T, SchemaTag> | undefined): EditWrappedStandardNode<T, ChildType> => {
    const transformedTree = node ? callback([node]) : []
    if (transformedTree.length === 0) {
        return { data: defaultValue, children: [] }
    }
    const transformedNode = transformedTree[0]
    if (transformedTree.length > 1 || !treeNodeTypeguard(typeGuard)(transformedNode)) {
        throw new Error('Invalid return value in transformStandardItem')
    }
    return { ...transformedNode, children: treeTypeGuard({ tree: defaultSelected(transformedNode.children), typeGuard: childTypeGuard }) }
}

const transformStandardComponent = (callback: (tree: GenericTree<SchemaTag>) => GenericTree<SchemaTag>) => (component: StandardComponent): StandardComponent | undefined => {
    switch(component.tag) {
        case 'Room':
            return {
                tag: 'Room',
                key: component.key,
                update: component.update,
                shortName: transformStandardItem(callback, isSchemaShortName, isSchemaOutputTag, { tag: 'ShortName' })(component.shortName),
                name: transformStandardItem(callback, isSchemaName, isSchemaOutputTag, { tag: 'Name' })(component.name),
                summary: transformStandardItem(callback, isSchemaSummary, isSchemaOutputTag, { tag: 'Summary' })(component.summary),
                description: transformStandardItem(callback, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })(component.description),
                exits: defaultSelected(callback(component.exits)).filter(treeNodeTypeguard(isSchemaExit)),
                themes: defaultSelected(callback(component.themes)).filter(treeNodeTypeguard(isSchemaTheme))
            }
        case 'Feature':
            return {
                tag: component.tag,
                key: component.key,
                update: component.update,
                name: transformStandardItem(callback, isSchemaName, isSchemaOutputTag, { tag: 'Name' })(component.name),
                description: transformStandardItem(callback, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })(component.description)
            }
        case 'Knowledge':
            return {
                tag: component.tag,
                key: component.key,
                update: component.update,
                name: transformStandardItem(callback, isSchemaName, isSchemaOutputTag, { tag: 'Name' })(component.name),
                description: transformStandardItem(callback, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })(component.description)
            }
        case 'Bookmark':
            return {
                tag: component.tag,
                key: component.key,
                update: component.update,
                description: transformStandardItem(callback, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })(component.description)
            }
        case 'Message':
            return {
                tag: component.tag,
                key: component.key,
                update: component.update,
                description: transformStandardItem(callback, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })(component.description),
                rooms: defaultSelected(callback(component.rooms)).filter(treeNodeTypeguard(isSchemaRoom))
            }
        case 'Moment':
            return {
                tag: component.tag,
                key: component.key,
                update: component.update,
                messages: defaultSelected(callback(component.messages)).filter(treeNodeTypeguard(isSchemaMessage))
            }
        case 'Map':
            return {
                tag: component.tag,
                key: component.key,
                update: component.update,
                name: transformStandardItem(callback, isSchemaName, isSchemaOutputTag, { tag: 'Name' })(component.name),
                images: defaultSelected(callback(component.images)).filter(treeNodeTypeguard(isSchemaImage)),
                positions: defaultSelected(callback(component.positions)).filter(treeNodeTypeguard(isSchemaRoom)),
                themes: defaultSelected(callback(component.themes)).filter(treeNodeTypeguard(isSchemaTheme))
            }
        case 'Theme':
            return {
                tag: component.tag,
                key: component.key,
                update: component.update,
                name: transformStandardItem(callback, isSchemaName, isSchemaOutputTag, { tag: 'Name' })(component.name),
                prompts: defaultSelected(callback(component.prompts)).filter(treeNodeTypeguard(isSchemaPrompt)),
                rooms: defaultSelected(callback(component.rooms)).filter(treeNodeTypeguard(isSchemaRoom)),
                maps: defaultSelected(callback(component.maps)).filter(treeNodeTypeguard(isSchemaMap))
            }
        case 'Variable':
        case 'Computed':
        case 'Action':
            return component
        default:
            return undefined
    }
}

const mergeStandardComponents = (base: StandardComponent, incoming: StandardComponent): StandardComponent | undefined => {
    if (isStandardRemove(base)) {
        if (!isStandardNonEdit(incoming)) {
            throw new MergeConflictError()
        }
        else {
            return {
                tag: 'Replace',
                key: base.key,
                match: base.component,
                payload: incoming
            }
        }
    }
    if (isStandardReplace(base)) {
        const recursed = mergeStandardComponents(base.payload, incoming)
        if (recursed) {
            if (isStandardNonEdit(recursed)) {
                return {
                    ...base,
                    payload: recursed
                }    
            }
            else {
                throw new MergeConflictError()
            }    
        }
        else {
            return {
                key: base.key,
                tag: 'Remove',
                component: base.match
            }
        }
    }
    if (isStandardRemove(incoming)) {
        if (base) {
            if (!deepEqual(base, incoming.component)) {
                throw new MergeConflictError(`Merge Conflict: \n${JSON.stringify(base, null, 4)}\n... and ...\n${JSON.stringify(incoming.component, null, 4)}`)
            }
            return undefined
        }
        else {
            return incoming
        }
    }
    if (isStandardReplace(incoming)) {
        if (base) {
            if (!deepEqual(base, incoming.match)) {
                throw new MergeConflictError(`Merge Conflict: \n${JSON.stringify(base, null, 4)}\n... and ...\n${JSON.stringify(incoming.match, null, 4)}`)
            }
            return incoming.payload
        }
        else {
            return incoming
        }
    }
    switch(base.tag) {
        case 'Room':
            if (!isStandardRoom(incoming)) { throw new Error('Type mismatch') }
            return {
                tag: 'Room',
                key: base.key,
                update: base.update,
                shortName: combineTagChildren(base, incoming, 'shortName'),
                name: combineTagChildren(base as StandardRoom, incoming as StandardRoom, 'name'),
                summary: combineTagChildren(base as StandardRoom, incoming as StandardRoom, 'summary'),
                description: combineTagChildren(base as StandardRoom, incoming as StandardRoom, 'description'),
                exits: applyEdits([...base.exits, ...incoming.exits]),
                themes: [...base.themes, ...incoming.themes]
            }
        case 'Feature':
            if (!isStandardFeature(incoming)) { throw new Error('Type mismatch') }
            return {
                tag: base.tag,
                key: base.key,
                update: base.update,
                name: combineTagChildren(base as StandardFeature | StandardKnowledge, incoming as StandardFeature | StandardKnowledge, 'name'),
                description: combineTagChildren(base as StandardFeature | StandardKnowledge, incoming as StandardFeature | StandardKnowledge, 'description')
            }
        case 'Knowledge':
            if (!isStandardKnowledge(incoming)) { throw new Error('Type mismatch') }
            return {
                tag: base.tag,
                key: base.key,
                update: base.update,
                name: combineTagChildren(base as StandardFeature | StandardKnowledge, incoming as StandardFeature | StandardKnowledge, 'name'),
                description: combineTagChildren(base as StandardFeature | StandardKnowledge, incoming as StandardFeature | StandardKnowledge, 'description')
            }
        case 'Bookmark':
            if (!isStandardBookmark(incoming)) { throw new Error('Type mismatch') }
            return {
                tag: 'Bookmark',
                key: base.key,
                update: base.update,
                description: combineTagChildren(base as StandardBookmark, incoming as StandardBookmark, 'description')
            }
        case 'Message':
            if (!isStandardMessage(incoming)) { throw new Error('Type mismatch') }
            return {
                tag: 'Message',
                key: base.key,
                update: base.update,
                description: combineTagChildren(base as StandardMessage, incoming as StandardMessage, 'description'),
                rooms: applyEdits([...base.rooms, ...incoming.rooms])
            }
        case 'Moment':
            if (!isStandardMoment(incoming)) { throw new Error('Type mismatch') }
            return {
                tag: 'Moment',
                key: base.key,
                update: base.update,
                messages: applyEdits([...base.messages, ...incoming.messages])
            }
        case 'Map':
            if (!isStandardMap(incoming)) { throw new Error('Type mismatch') }
            return {
                tag: 'Map',
                key: base.key,
                update: base.update,
                name: combineTagChildren(base as StandardMap, incoming as StandardMap, 'name'),
                positions: applyEdits([...base.positions, ...incoming.positions]),
                images: applyEdits([...base.images, ...incoming.images]),
                themes: [...base.themes, ...incoming.themes]
            }
        case 'Theme':
            if (!isStandardTheme(incoming)) { throw new Error('Type mismatch') }
            return {
                tag: 'Theme',
                key: base.key,
                update: base.update,
                name: combineTagChildren(base as StandardTheme, incoming as StandardTheme, 'name'),
                prompts: [...base.prompts, ...incoming.prompts],
                rooms: applyEdits([...base.rooms, ...incoming.rooms]),
                maps: applyEdits([...base.maps, ...incoming.maps])
            }
        case 'Variable':
        case 'Computed':
        case 'Action':
        case 'Character':
            return incoming
        default:
            throw new Error(`Invalid incoming StandardComponent: ${JSON.stringify(base, null, 4)}`)
    }
}

const schemaItemToStandardItem = ({ data, children }: GenericTreeNode<SchemaTag>, fullSchema: GenericTree<SchemaTag>, imported: boolean): StandardComponent | undefined => {
    if (isSchemaRemove(data)) {
        if (!(children.length === 1)) {
            throw new Error('Illegal number of children in remove tag')
        }
        const component = schemaItemToStandardItem(children[0], fullSchema, imported)
        if (!(component && isStandardNonEdit(component))) {
            throw new Error('Illegal non-content argument in remove tag')
        }
        return {
            key: component.key,
            tag: 'Remove',
            component
        }
    }
    if (isSchemaReplace(data)) {
        if (!(children.length === 2)) {
            throw new StandardizerError('Illegal number of children in replace tag')
        }
        if (!(treeNodeTypeguard(isSchemaReplaceMatch)(children[0]) && children[0].children.length === 1)) {
            throw new StandardizerError('Malformed replace tag')
        }
        const match = schemaItemToStandardItem(children[0].children[0], fullSchema, imported)
        if (!(match && isStandardNonEdit(match))) {
            throw new StandardizerError('Illegal non-content match argument in replace tag')
        }
        if (!(treeNodeTypeguard(isSchemaReplacePayload)(children[1]) && children[1].children.length === 1)) {
            throw new StandardizerError('Malformed replace tag')
        }
        const payload = schemaItemToStandardItem(children[1].children[0], fullSchema, imported)
        if (!(payload && isStandardNonEdit(payload))) {
            throw new StandardizerError('Illegal non-content payload argument in replace tag')
        }
        return {
            key: match.key,
            tag: 'Replace',
            match,
            payload
        }
    }
    if (isSchemaRoom(data)) {
        const tagTree = new SchemaTagTree(children)
        const shortNameItem = tagTree.filter({ match: 'ShortName' }).tree.find(wrappedNodeTypeGuard(isSchemaShortName))
        const nameItem = tagTree.filter({ match: 'Name' }).tree.find(wrappedNodeTypeGuard(isSchemaName))
        const summaryItem = tagTree.filter({ match: 'Summary' }).tree.find(wrappedNodeTypeGuard(isSchemaSummary))
        const descriptionItem = tagTree.filter({ match: 'Description' }).tree.find(wrappedNodeTypeGuard(isSchemaDescription))
        const exitTagTree = new SchemaTagTree(children)
            .filter({ match: 'Exit' })
            .reorderedSiblings([['Room', 'Exit'], ['If']])
        const themeTagTree = new SchemaTagTree(fullSchema).filter({ and: [{ match: 'Theme' }, { match: ({ data: check }) => (isSchemaRoom(check) && check.key === data.key)}] }).prune({ not: { or: [{ match: 'Room' }, { match: 'Theme' }] } })
        return {
            tag: 'Room',
            key: imported ? data.as ?? data.key : data.key,
            shortName: outputNodeToStandardItem<SchemaShortNameTag, SchemaOutputTag>(shortNameItem, isSchemaShortName, isSchemaOutputTag, { tag: 'ShortName' }),
            name: outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaName, isSchemaOutputTag, { tag: 'Name' }),
            summary: outputNodeToStandardItem<SchemaSummaryTag, SchemaOutputTag>(summaryItem, isSchemaSummary, isSchemaOutputTag, { tag: 'Summary' }),
            description: outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>(descriptionItem, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' }),
            exits: defaultSelected(exitTagTree.tree),
            themes: themeTagTree.tree.filter(treeNodeTypeguard(isSchemaTheme))
        }
    }
    if (isSchemaFeature(data) || isSchemaKnowledge(data)) {
        const tagTree = new SchemaTagTree(children)
        const nameItem = tagTree.filter({ match: 'Name' }).tree.find(wrappedNodeTypeGuard(isSchemaName))
        const descriptionItem = tagTree.filter({ match: 'Description' }).tree.find(wrappedNodeTypeGuard(isSchemaDescription))
        return {
            tag: data.tag,
            key: imported ? data.as ?? data.key : data.key,
            name: outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaName, isSchemaOutputTag, { tag: 'Name' }),
            description: outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>(descriptionItem, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' }),
        }
    }
    if (isSchemaBookmark(data)) {
        return {
            tag: data.tag,
            key: imported ? data.as ?? data.key : data.key,
            description: outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>({ data: { tag: 'Description' }, children }, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })
        }
    }
    if (isSchemaMessage(data)) {
        const roomsTagTree = new SchemaTagTree(children).filter({ match: 'Room' })
        return {
            tag: data.tag,
            key: imported ? data.as ?? data.key : data.key,
            description: outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>({ data: { tag: 'Description' }, children }, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' }),
            rooms: roomsTagTree.tree
        }
    }
    if (isSchemaMoment(data)) {
        const messagesTagTree = new SchemaTagTree(children).filter({ match: 'Message' })
        return {
            tag: data.tag,
            key: imported ? data.as ?? data.key : data.key,
            messages: messagesTagTree.tree
        }
    }
    if (isSchemaMap(data)) {
        const positionsTagTree = new SchemaTagTree(children)
            .reordered([{ connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }] }] }, { match: 'Room' }, { or: [{ match: 'Position' }, { match: 'Exit' }] }])
            .prune({ not: { or: [
                { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }] }] }, { match: 'Room' }, { match: 'Position' }, { match: 'Exit' }
            ]}})
            .reorderedSiblings([['Room', 'Exit', 'Position'], ['If']])
        
        const imagesTagTree = new SchemaTagTree(children).filter({ match: 'Image' })
        const nameItem = children.find(treeNodeTypeguard(isSchemaName))
        const themeTagTree = new SchemaTagTree(fullSchema).filter({ and: [{ match: 'Theme' }, { match: ({ data: check }) => (isSchemaMap(check) && check.key === data.key)}] }).prune({ not: { or: [{ match: 'Map' }, { match: 'Theme' }] } })
        return {
            tag: 'Map',
            key: imported ? data.as ?? data.key : data.key,
            name: outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaName, isSchemaOutputTag, { tag: 'Name' }),
            images: defaultSelected(imagesTagTree.tree),
            positions: defaultSelected(positionsTagTree.tree),
            themes: themeTagTree.tree.filter(treeNodeTypeguard(isSchemaTheme))
        }
    }
    if (isSchemaTheme(data)) {
        const nameItem = children.find(treeNodeTypeguard(isSchemaName))
        const promptTagTree = new SchemaTagTree(children).filter({ match: 'Prompt' }).prune({ not: { match: 'Prompt' } })
        const roomTagTree = new SchemaTagTree(children).filter({ match: 'Room' }).prune({ not: { match: 'Room' } })
        const mapsTagTree = new SchemaTagTree(children).filter({ match: 'Map' }).prune({ not: { match: 'Map' }})
        return {
            tag: 'Theme',
            key: imported ? data.as ?? data.key : data.key,
            name: outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaName, isSchemaOutputTag, { tag: 'Name' }),
            prompts: promptTagTree.tree.filter(treeNodeTypeguard(isSchemaPrompt)),
            rooms: roomTagTree.tree,
            maps: mapsTagTree.tree
        }
    }
    if (isSchemaVariable(data)) {
        return {
            tag: 'Variable',
            key: imported ? data.as ?? data.key : data.key,
            default: data.default ?? ''
        }
    }
    if (isSchemaComputed(data) || isSchemaAction(data)) {
        return {
            tag: data.tag,
            key: imported ? data.as ?? data.key : data.key,
            src: data.src ?? ''
        }
    }
    if (isSchemaImage(data)) {
        return {
            tag: data.tag,
            key: imported ? data.as ?? data.key : data.key
        }
    }
    return undefined
}

const standardFieldToOutputNode = (field: GenericTreeNode<SchemaTag>): GenericTree<SchemaTag> => (
    field ? [field] : []
)

const standardItemToSchemaItem = (item: StandardComponentNonEdit): GenericTreeNode<SchemaTag> => {
    switch(item.tag) {
        case 'Character':
            const pronounsItem = item.pronouns
            //
            // TODO: Use unwrapItem and wrap typeguards to make this check for default pronouns something that
            // can handle WML edit tags
            //
            const pronounsFinalItem: Omit<SchemaPronounsTag, 'tag'> | undefined = pronounsItem
                ? treeNodeTypeguard(isSchemaPronouns)(pronounsItem)
                    ? (
                        (pronounsItem.data.subject === 'they') &&
                        (pronounsItem.data.object === 'them') &&
                        (pronounsItem.data.possessive === 'theirs') &&
                        (pronounsItem.data.adjective === 'their') &&
                        (pronounsItem.data.reflexive === 'themself')
                    )
                        ? undefined
                        : pronounsItem.data
                    : undefined
                : undefined
            return {
                data: { tag: 'Character', key: item.key, Pronouns: pronounsFinalItem ?? { subject: 'they', object: 'them', possessive: 'theirs', adjective: 'their', reflexive: 'themself' } },
                children: [
                    ...[item.name, ...(pronounsFinalItem ? [item.pronouns] : []), item.firstImpression, item.oneCoolThing, item.outfit, item.image].filter(excludeUndefined).map(standardFieldToOutputNode).flat(1),
                ]
            }
        case 'Room':
            return {
                data: { tag: 'Room', key: item.key },
                children: [
                    ...[item.shortName, item.name, item.summary, item.description].filter(excludeUndefined).filter(({ children }) => (children.length)).map(standardFieldToOutputNode).flat(1),
                    ...item.exits
                ]
            }
        case 'Feature':
        case 'Knowledge':
            return {
                data: { tag: item.tag, key: item.key },
                children: [item.name, item.description].filter(excludeUndefined).filter(({ children }) => (children.length)).map(standardFieldToOutputNode).flat(1)
            }
        case 'Bookmark':
            return {
                data: { tag: 'Bookmark', key: item.key },
                children: item.description ? standardFieldToOutputNode(item.description).filter(({ children }) => (children.length)).map(({ children }) => (children)).flat(1) : []
            }
        case 'Message':
            return {
                data: { tag: 'Message', key: item.key },
                children: [
                    ...item.rooms,
                    ...(item.description ? standardFieldToOutputNode(item.description).filter(({ children }) => (children.length)).map(({ children }) => (children)).flat(1) : [])
                ]
            }
        case 'Moment':
            return {
                data: { tag: 'Moment', key: item.key },
                children: item.messages
            }
        case 'Map':
            return {
                data: { tag: 'Map', key: item.key },
                children: [
                    ...((item.name && item.name.children.length) ? standardFieldToOutputNode(item.name) : []),
                    ...item.images,
                    ...item.positions
                ]
            }
        case 'Theme':
            return {
                data: { tag: 'Theme', key: item.key },
                children: [
                    ...(item.name ? standardFieldToOutputNode(item.name) : []),
                    ...item.prompts,
                    ...item.rooms,
                    ...item.maps
                ]
            }
        case 'Variable':
            return {
                data: { tag: 'Variable', key: item.key, default: item.default },
                children: []
            }
        case 'Computed':
            return {
                data: { tag: item.tag, key: item.key, src: item.src, dependencies: item.dependencies },
                children: []
            }
        case 'Action':
            return {
                data: { tag: item.tag, key: item.key, src: item.src },
                children: []
            }
        case 'Image':
            return {
                data: { tag: item.tag, key: item.key },
                children: []
            }
    }
}

export const serializedStandardItemToSchemaItem = (item: SerializableStandardComponent): GenericTreeNode<SchemaTag> => {
    switch(item.tag) {
        case 'Character':
            const { tag, ...pronouns } = item.pronouns.data
            return {
                data: { tag: 'Character', key: item.key, Pronouns: 'subject' in pronouns ? pronouns : { subject: 'they', object: 'them', possessive: 'theirs', adjective: 'their', reflexive: 'themself' } },
                children: [
                    ...[item.name, item.pronouns, item.firstImpression, item.oneCoolThing, item.outfit],
                ]
            }
        case 'Room':
            return {
                data: { tag: 'Room', key: item.key },
                children: defaultSelected([
                    ...[item.shortName, item.name, item.summary, item.description],
                    ...item.exits
                ])
            }
        case 'Feature':
        case 'Knowledge':
            return {
                data: { tag: item.tag, key: item.key },
                children: defaultSelected([item.name, item.description])
            }
        case 'Bookmark':
            return {
                data: { tag: 'Bookmark', key: item.key },
                children: defaultSelected(item.description.children)
            }
        case 'Message':
            return {
                data: { tag: 'Message', key: item.key },
                children: [
                    ...item.rooms,
                    ...item.description.children
                ]
            }
        case 'Moment':
            return {
                data: { tag: 'Moment', key: item.key },
                children: item.messages
            }
        case 'Map':
            return {
                data: { tag: 'Map', key: item.key },
                children: defaultSelected([
                    item.name,
                    ...item.images,
                    ...item.positions
                ])
            }
        case 'Theme':
            return {
                data: { tag: 'Theme', key: item.key },
                children: [
                    item.name,
                    ...item.rooms,
                    ...item.maps
                ]
            }
        case 'Variable':
            return {
                data: { tag: 'Variable', key: item.key, default: item.default },
                children: []
            }
        case 'Computed':
            return {
                data: { tag: item.tag, key: item.key, src: item.src, dependencies: item.dependencies },
                children: []
            }
        case 'Action':
            return {
                data: { tag: item.tag, key: item.key, src: item.src },
                children: []
            }
        case 'Image':
            return {
                data: { tag: item.tag, key: item.key },
                children: []
            }
    }
}

export class StandardizerAbstract {
    _assetKey: string;
    _assetTag: (SchemaAssetTag | SchemaCharacterTag)["tag"];
    _update: boolean = false
    _byId: StandardForm["byId"];
    metaData: StandardForm["metaData"];
    constructor(...schemata: GenericTree<SchemaTag, Partial<{ inherited: boolean }>>[]) {
        const keysByComponentTypeFactory = (tagTree: SchemaTagTree) => (tag: SchemaWithKey["tag"]) => {
            const keysExtract = (imported: boolean) => (
                tagTree
                    .filter({ and: [{ match: tag }, imported ? { match: 'Import' } : { not: { match: 'Import' } }] })
                    .prune({ after: { match: tag } })
                    .prune({ before: { match: tag } })
                    .tree
                    .map(({ data }) => {
                        if (data.tag !== tag) {
                            throw new Error('standardizeSchema tag mismatch')
                        }
                        if (imported && isImportable(data)) {
                            return data.as ?? data.key
                        }
                        return data.key
                    })
            )
            return unique(keysExtract(true), keysExtract(false)).sort()
        }
        const standardizeComponentTagType = (componentKeys: SchemaWithKey["tag"][], tagTree: SchemaTagTree): void => {
            //
            // Loop through each tag in standard order
            //
            const anyKeyedComponent: TagTreeMatchOperation<SchemaTag> = { or: componentKeys.map((key) => ({ match: key })) }
            componentKeys.forEach((tag) => {
                //
                // Loop through each key present for that tag
                //
                const keys = keysByComponentTypeFactory(tagTree)(tag)
                keys.forEach((key) => {
                    //
                    // Aggregate and reorder all top-level information
                    //
                    const nodeMatch: TagTreeMatchOperation<SchemaTag> = { match: ({ data }, stack) => (data.tag === tag && (data.key === key)) }
                    const nodeMatchImport: TagTreeMatchOperation<SchemaTag> = { match: ({ data }, stack) => (data.tag === tag && (((Boolean(stack.find(isSchemaImport)) && isImportable(data)) ? data.as ?? data.key : data.key) === key)) }
                    const editTag: TagTreeMatchOperation<SchemaTag> = { or: [{ match: 'Replace' }, { match: 'Remove' }] }
                    const adjustTagTree = (tagTree: SchemaTagTree, nodeMatch: TagTreeMatchOperation<SchemaTag>): SchemaTagTree => {
                        const prunedTagTree = tagTree
                            .prune({ after: { sequence: [nodeMatch, anyKeyedComponent] } })
                            .reorderFunctional(
                                [{ match: tag }, { match: 'Replace'}, { match: 'ReplaceMatch' }, { match: 'ReplacePayload' }, { match: 'Remove' }, { match: 'Name' }, { match: 'ShortName' }, { match: 'Description' }, { match: 'Summary' }, { match: 'If' }, { match: 'Statement' }, { match: 'Fallthrough' }, { match: 'Inherited' }],
                                (tagItem) => {
                                    const isEditTag = (value: TagListItem<SchemaTag, {}>): boolean => (['Replace', 'ReplaceMatch', 'ReplacePayload', 'Remove'].includes(value.data.tag))
                                    const isConditionalTag = (value: TagListItem<SchemaTag, {}>): boolean => (['If', 'Statement', 'Fallthrough'].includes(value.data.tag))
                                    const { componentTags, valueTags, conditionalTags } = tagItem.reduce<{ componentTags: TagListItem<SchemaTag>[]; valueTags: TagListItem<SchemaTag>[]; conditionalTags: TagListItem<SchemaTag>[]; matchedAlready: boolean }>((previous, subItem) => {
                                        if (subItem.data.tag === tag) {
                                            return {
                                                ...previous,
                                                componentTags: [...previous.componentTags, subItem],
                                                matchedAlready: true
                                            }
                                        }
                                        if (isEditTag(subItem)) {
                                            if (previous.matchedAlready) {
                                                return {
                                                    ...previous,
                                                    valueTags: [...previous.valueTags, subItem]
                                                }
                                            }
                                            else {
                                                return {
                                                    ...previous,
                                                    componentTags: [...previous.componentTags, subItem]
                                                }
                                            }
                                        }
                                        if (isConditionalTag(subItem)) {
                                            return {
                                                ...previous,
                                                conditionalTags: [...previous.conditionalTags, subItem]
                                            }
                                        }
                                        else {
                                            return {
                                                ...previous,
                                                valueTags: [...previous.valueTags, subItem]
                                            }
                                        }
                                    }, { componentTags: [], valueTags: [], conditionalTags: [], matchedAlready: false })
                                    const relativeOrder: Partial<Record<SchemaTag["tag"], number>> = {
                                        Remove: 1,
                                        Replace: 1,
                                        ReplaceMatch: 2,
                                        ReplacePayload: 2,
                                        [tag]: 3,
                                        Name: 4,
                                        ShortName: 4,
                                        Description: 4,
                                        Summary: 4
                                    }
                                    const sortInPlace = (tags: TagListItem<SchemaTag>[]): TagListItem<SchemaTag>[] => (
                                        [...tags].sort((a, b) => ((relativeOrder[a.data.tag] ?? Infinity) - (relativeOrder[b.data.tag] ?? Infinity)))
                                    )
                                    return [...sortInPlace(componentTags), ...sortInPlace(valueTags), ...conditionalTags]
                                }
                            )
                            .prune({ and: [{ before: nodeMatch }, { not: { or: [editTag, { after: editTag }] }}] })
                            .prune({ or: [{ match: 'Import' }, { match: 'Export' }] })
                        switch(tag) {
                            case 'Room':
                                return prunedTagTree.prune({ or: [{ match: 'Map' }, { match: 'Position' }]})
                            case 'Map':
                                return tagTree
                                    .prune({ or: [{ and: [{ after: { sequence: [nodeMatch, anyKeyedComponent] } }, { not: { match: 'Position'} }] }, { match: 'Import' }, { match: 'Export' }] })
                                    .reordered([{ match: tag }, { or: [{ match: 'Name' }, { match: 'Description' }] }, { or: [{ match: 'Room' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] } ]}, { match: 'Inherited' }])
                                    .filter({ or: [{ and: [{ match: 'Room' }, { or: [{ match: 'Position' }, { match: 'Exit' }]}]}, { not: { match: 'Room' }}]})
                                    .prune({ before: nodeMatch })
                        }
                        return prunedTagTree
                    }
                    const filteredTagTree = adjustTagTree(tagTree.filter({ and: [nodeMatch, { not: { match: 'Import' } }] }), nodeMatch)
                    const importedTagTree = adjustTagTree(tagTree.filter({ and: [nodeMatchImport, { match: 'Import' }] }), nodeMatchImport)

                    applyEdits(filteredTagTree.tree).forEach((item) => {
                        const standardItem = schemaItemToStandardItem(item, tagTree.tree, false)
                        if (standardItem) {
                            if (this._byId[key]) {
                                const merged = mergeStandardComponents(this._byId[key], standardItem)
                                if (merged) {
                                    this._byId[key] = merged
                                }
                                else {
                                    delete this._byId[key]
                                }
                            }
                            else {
                                this._byId[key] = standardItem
                            }
                        }
                    })
                    applyEdits(markInherited(importedTagTree.tree)).forEach((item) => {
                        const standardItem = schemaItemToStandardItem(item, tagTree.tree, true)
                        if (standardItem && isStandardNonEdit(standardItem)) {
                            if (this._byId[key]) {
                                const merged = mergeStandardComponents(this._byId[key], standardItem)
                                if (merged) {
                                    this._byId[key] = merged
                                }
                                else {
                                    delete this._byId[key]
                                }
                            }
                            else {
                                this._byId[key] = standardItem
                            }
                        }
                    })
                })
            })
        }
        this._byId = {}
        this.metaData = []
        if (!schemata.length) {
            this._assetKey = 'Test'
            this._assetTag = 'Asset'
            return
        }
        const allAssetKeys = unique(...schemata.map((tree) => (selectKeysByTag('Asset')(tree))))
        const allCharacterKeys = unique(...schemata.map((tree) => (selectKeysByTag('Character')(tree))))
        const allStandardCharacters = allCharacterKeys.map((characterKey) => {
            this._assetTag = 'Character'
            const tagTree = new SchemaTagTree(schemata.map((tree) => {
                const characterNode = tree.find(({ data }) => (isSchemaCharacter(data) && data.key === characterKey))
                return characterNode ? [characterNode] : []
            }).flat(1))
            tagTree._merge = ({ data: dataA }, { data: dataB }) => ({ data: { ...dataA, ...dataB } })
            const characterTree = tagTree.tree
            if (characterTree.length !== 1) {
                throw new Error('Too many characters in Standarizer')
            }
            const character = characterTree[0]
            const pronouns: GenericTreeNodeFiltered<SchemaPronounsTag, SchemaTag> = (character.children.find(treeNodeTypeguard(isSchemaPronouns)) ?? { children: [], data: { tag: 'Pronouns', subject: 'they', object: 'them', possessive: 'theirs', adjective: 'their', reflexive: 'themself' } })
            const confirmOutputChildren = <InputNode extends SchemaTag>(node: GenericTreeNodeFiltered<InputNode, SchemaTag> |  undefined): GenericTreeNodeFiltered<InputNode, SchemaOutputTag> | undefined => (node ? { data: node.data, children: treeTypeGuard({ tree: node.children, typeGuard: isSchemaOutputTag })} : undefined)
            const name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag> | undefined = confirmOutputChildren(character.children.find(treeNodeTypeguard(isSchemaName)))
            const firstImpression: GenericTreeNodeFiltered<SchemaFirstImpressionTag, SchemaTag> | undefined = character.children.find(treeNodeTypeguard(isSchemaFirstImpression))
            const oneCoolThing: GenericTreeNodeFiltered<SchemaOneCoolThingTag, SchemaTag> | undefined = character.children.find(treeNodeTypeguard(isSchemaOneCoolThing))
            const outfit: GenericTreeNodeFiltered<SchemaOutfitTag, SchemaTag> | undefined = character.children.find(treeNodeTypeguard(isSchemaOutfit))
            const image: GenericTreeNodeFiltered<SchemaImageTag, SchemaTag> | undefined = character.children.find(treeNodeTypeguard(isSchemaImage))
            this._byId[characterKey] = {
                tag: 'Character',
                key: characterKey,
                pronouns,
                name,
                firstImpression,
                oneCoolThing,
                outfit,
                image
            }
            this.metaData = [
                ...treeTypeGuard({ tree: character.children, typeGuard: isSchemaMeta }),
                ...character.children.filter(wrappedNodeTypeGuard(isSchemaImport))
            ]
            standardizeComponentTagType(['Image'], tagTree)
            return character
        })
        const allStandardAssets = allAssetKeys.map((assetKey) => {
            const tagTree = new SchemaTagTree(schemata.map((tree) => {
                const assetNode = tree.find(({ data }) => (isSchemaAsset(data) && data.key === assetKey))
                return assetNode ? [assetNode] : []
            }).flat(1))
            tagTree._merge = ({ data: dataA }, { data: dataB }) => ({ data: { ...dataA, ...dataB } })

            //
            // Add standardized view of all Imports to the results
            //
            const importTagTree = tagTree
                .filter({ match: 'Import' })
                .prune({ or: [
                    { and: [
                        { before: { match: 'Import' } },
                        { not: { or: [{ match: 'Replace' }, { match: 'ReplaceMatch' }, { match: 'ReplacePayload' }, { match: 'Remove' }]}}
                    ] },
                    { after: { or: [
                        { match: 'Room' },
                        { match: 'Feature' },
                        { match: 'Knowledge' },
                        { match: 'Bookmark' },
                        { match: 'Map' },
                        { match: 'Message' },
                        { match: 'Moment' },
                        { match: 'Variable' },
                        { match: 'Computed' },
                        { match: 'Action' }
                    ]}}
                ]})
            const importItems = importTagTree.tree.filter(({ children }) => (children.length))
        
            this.metaData = [
                ...this.metaData,
                ...tagTree.filter({ match: 'Meta' }).prune({ not: { match: 'Meta' }}).tree,
                ...importItems.filter(wrappedNodeTypeGuard(isSchemaImport)) as GenericTree<SchemaTag>
            ]

            const componentKeys: SchemaWithKey["tag"][] = ['Image', 'Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Theme', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
            const anyKeyedComponent: TagTreeMatchOperation<SchemaTag> = { or: componentKeys.map((key) => ({ match: key })) }
    
            standardizeComponentTagType(['Image', 'Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Theme', 'Message', 'Moment', 'Variable', 'Computed', 'Action'], tagTree)

            //
            // Add standardized view of all Exports to the results
            //
            const exportTagTree = tagTree
                .filter({ match: 'Export' })
                .prune({ or: [
                    { before: { match: 'Export' } },
                    { after: anyKeyedComponent }
                ]})
            const exports = exportTagTree.tree
                .filter((node): node is GenericTreeNodeFiltered<SchemaExportTag, SchemaTag> => (isSchemaExport(node.data)))
                .filter(({ children }) => (children.length))
            this.metaData = [...this.metaData, ...exports]

            return {
                data: { tag: 'Asset' as const, key: assetKey, Story: undefined },
                children: []
            }
        })
        if (allStandardAssets.length + allStandardCharacters.length !== 1) {
            throw new Error('Too many assets in Standarizer')
        }
        if (allStandardCharacters.length) {
            const { data: characterData } = allStandardCharacters[0]
            if (!(isSchemaTag(characterData) && isSchemaCharacter(characterData))) {
                throw new Error('Type mismatch in Standardizer')
            }
            this._assetKey = characterData.key
            this._assetTag = characterData.tag
            this._update = characterData.update ?? false
        }
        else {
            const { data: assetData } = allStandardAssets[0]
            if (!(isSchemaTag(assetData) && isSchemaAsset(assetData))) {
                throw new Error('Type mismatch in Standardizer')
            }
            this._assetKey = assetData.key
            this._assetTag = assetData.tag
            this._update = assetData.update ?? false
        }
    }

    get schema(): GenericTree<SchemaTag> {
        if (this._assetTag === 'Asset') {
            //
            // Extract keys from imports, and check when listing components whether it is an empty
            // item which is already represented in import (and exclude if so)
            //
            const imports = this.metaData.filter(treeNodeTypeguard(isSchemaImport))
            const importKeys = unique(imports.map(({ children }) => (children.map(({ data }) => (data)).filter(isImportable).map(({ key, as }) => (as ?? key)))).flat(1))
            const componentKeys: SchemaWithKey["tag"][] = ['Image', 'Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Theme', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
            const children = [
                ...this.metaData.filter(treeNodeTypeguard(isSchemaMeta)),
                ...imports,
                ...componentKeys
                    .map((tagToList) => (
                        Object.values(this._byId)
                            .filter(excludeUndefined)
                            .filter((component) => (unwrapStandardComponent(component).tag === tagToList))
                            .map<GenericTreeNode<SchemaTag>>((component) => {
                                if (isStandardNonEdit(component)) {
                                    return standardItemToSchemaItem(component)
                                }
                                else if (isStandardRemove(component)) {
                                    return {
                                        data: { tag: 'Remove' },
                                        children: [standardItemToSchemaItem(component.component)]
                                    }
                                }
                                else if (isStandardReplace(component)) {
                                    return {
                                        data: { tag: 'Replace' },
                                        children: [
                                            { data: { tag: 'ReplaceMatch' }, children: [standardItemToSchemaItem(component.match)] },
                                            { data: { tag: 'ReplacePayload' }, children: [standardItemToSchemaItem(component.payload)] }
                                        ]
                                    }
                                }
                                throw new StandardizerError()
                            })
                            .filter(({ data, children }) => (children.length || !(isImportable(data) && importKeys.includes(data.key))))
                    ))
                    .flat(1),
                ...this.metaData.filter(treeNodeTypeguard(isSchemaExport))
            ]
            return [{
                data: { tag: this._assetTag, key: this._assetKey, Story: undefined },
                children: defaultSelected(children)
            }]
        }
        if (this._assetTag === 'Character') {
            const character = standardItemToSchemaItem(this._byId[this._assetKey] as StandardComponentNonEdit)
            return [{
                ...character,
                children: defaultSelected([
                    ...character.children,
                    ...this.metaData.filter(treeNodeTypeguard(isSchemaMeta)),
                    ...this.metaData.filter(wrappedNodeTypeGuard(isSchemaImport))
                ])
            }]
        }
        throw new Error('Invalid internal tags on Standardizer schema')
    }

    loadStandardForm(standard: StandardForm): void {
        this._assetKey = standard.key
        this._assetTag = standard.tag
        this._update = standard.update ?? false
        this._byId = standard.byId
        this.metaData = standard.metaData
    }

    get standardForm(): StandardForm {
        return {
            key: this._assetKey,
            tag: this._assetTag,
            byId: this._byId,
            update: this._update ? true : undefined,
            metaData: this.metaData
        }
    }

    assignDependencies(extract: (src: string) => string[]) {
        const assignedSchema = 
            map(this.schema, (node: GenericTreeNode<SchemaTag>): GenericTree<SchemaTag> => {
                if (isSchemaConditionStatement(node.data)) {
                    return [{
                        ...node,
                        data: {
                            ...node.data,
                            dependencies: extract(node.data.if)
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
        const assignedStandardizer = new StandardizerAbstract(assignedSchema)
        this.loadStandardForm({ ...assignedStandardizer.standardForm, update: assignedStandardizer._update })
    }

    deserialize(standard: SerializableStandardForm): void {
        const byId: StandardForm["byId"] = objectMap(standard.byId, (value): StandardComponent => {
            const deserializeValue = <T extends SerializableStandardComponent, K extends keyof T, FilterType extends SchemaTag, InnerType extends SchemaTag>(item: T, key: K): T[K] extends EditWrappedStandardNode<FilterType, InnerType, {}> ? EditWrappedStandardNode<FilterType, InnerType> : never => {
                const subItem = item[key] as EditWrappedStandardNode<FilterType, InnerType, {}>
                return { ...subItem, id: subItem.children.length ? uuidv4() : '', children: subItem.children as unknown as EditWrappedStandardNode<FilterType, InnerType> } as unknown as T[K] extends EditWrappedStandardNode<FilterType, InnerType, {}> ? EditWrappedStandardNode<FilterType, InnerType> : never
            }
            if (value.tag === 'Bookmark') {
                return {
                    ...value,
                    description: deserializeValue(value, 'description')
                }
            }
            if (value.tag === 'Feature' || value.tag === 'Knowledge') {
                return {
                    ...value,
                    name: deserializeValue(value, 'name'),
                    description: deserializeValue(value, 'description')
                }
            }
            if (value.tag === 'Map') {
                return {
                    ...value,
                    name: deserializeValue(value, 'name'),
                    themes: (value.themes ?? []).filter(treeNodeTypeguard(isSchemaTheme))
                }
            }
            if (value.tag === 'Theme') {
                return {
                    ...value,
                    name: deserializeValue(value, 'name'),
                    prompts: value.prompts.filter(treeNodeTypeguard(isSchemaPrompt)),
                }
            }
            if (value.tag === 'Room') {
                return {
                    ...value,
                    shortName: deserializeValue(value, 'shortName'),
                    name: deserializeValue(value, 'name'),
                    summary: deserializeValue(value, 'summary'),
                    description: deserializeValue(value, 'description'),
                    themes: (value.themes ?? []).filter(treeNodeTypeguard(isSchemaTheme))
                }
            }
            if (value.tag === 'Message') {
                return {
                    ...value,
                    description: deserializeValue(value, 'description'),
                }
            }
            if (value.tag === 'Moment') {
                return value
            }
            if (value.tag === 'Character') {
                return {
                    ...value,
                    name: deserializeValue(value, 'name')
                }
            }
            return value
        })
        this._assetKey = standard.key
        this._assetTag = standard.tag
        this._byId = byId
        this.metaData = standard.metaData
    }

    transform(callback: (schema: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardizerAbstract {
        const mappedByIdEntries = Object.entries(this._byId)
            .map(([key, value]) => ([{ [key]: transformStandardComponent(callback)(value) }]))
            .flat(1)
        const returnStandardizer = new StandardizerAbstract()
        returnStandardizer.loadStandardForm({
            byId: Object.assign({}, ...mappedByIdEntries),
            key: this._assetKey,
            tag: this._assetTag,
            metaData: this.metaData
        })
        return returnStandardizer
    }

    filter(args: Parameters<SchemaTagTree["filter"]>[0]): StandardizerAbstract {
        const callback = (schema: GenericTree<SchemaTag>): GenericTree<SchemaTag> => {
            const tagTree = new SchemaTagTree(schema)
            return tagTree.filter(args).tree
        }
        return this.transform(callback)
    }

    prune(args: Parameters<SchemaTagTree["prune"]>[0]): StandardizerAbstract {
        const callback = (schema: GenericTree<SchemaTag>): GenericTree<SchemaTag> => {
            const tagTree = new SchemaTagTree(schema)
            return tagTree.prune(args).tree
        }
        return this.transform(callback)
    }

    merge(incoming: StandardizerAbstract): StandardizerAbstract {
        const allKeys = unique(Object.keys(this._byId), Object.keys(incoming._byId))
        const combinedById = Object.assign({}, ...(allKeys.map((key) => {
            const rootComponent = this._byId[key]
            const incomingComponent = incoming._byId[key]
            if (rootComponent) {
                if (incomingComponent) {
                    return { [key]: mergeStandardComponents(rootComponent, incomingComponent) }
                }
                else {
                    return { [key]: rootComponent }
                }
            }
            else {
                return { [key]: incomingComponent }
            }
        })))
        const combinedMetaData = new SchemaTagTree([...this.metaData, ...incoming.metaData])

        const returnStandardizer = new StandardizerAbstract()
        returnStandardizer.loadStandardForm({
            byId: combinedById,
            key: this._assetKey,
            tag: this._assetTag,
            metaData: applyEdits(combinedMetaData.tree)
        })
        return returnStandardizer
    }
}