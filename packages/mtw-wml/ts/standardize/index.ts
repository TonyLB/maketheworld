import { SchemaTag, isSchemaConditionStatement, isSchemaCondition, isSchemaConditionFallthrough, isImportable, SchemaWithKey, isSchemaImport, isSchemaCharacter, isSchemaRoom, isSchemaFeature, isSchemaKnowledge, isSchemaBookmark, isSchemaMap, isSchemaMessage, isSchemaMoment, isSchemaTheme, isSchemaVariable, isSchemaComputed, isSchemaAction, isSchemaImage, isSchemaAsset, SchemaCharacterTag, isSchemaMeta, SchemaAssetTag, SchemaExportTag, isSchemaExport, isSchemaRemove, SchemaImportableBase, SchemaExitTag, SchemaImportTag, isSchemaWithKey, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "../schema/baseClasses"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, treeNodeTypeguard } from "../tree/baseClasses"
import { isStandardAction, isStandardBookmark, isStandardCharacter, isStandardComputed, isStandardFeature, isStandardImage, isStandardKnowledge, isStandardMap, isStandardMessage, isStandardMoment, isStandardNDJSON, isStandardRemove, isStandardReplace, isStandardRoom, isStandardTheme, isStandardVariable, MergeConflictError, SerializeNDJSONMixin, StandardNDJSON } from "./baseClasses"
import { StandardizerAbstract } from './abstract'
import { excludeUndefined } from "../lib/lists"
import { isStandardComponent, isStandardForm, StandardComponentData, StandardComponentNonEditData, StandardFormData, StandardRemoveData, StandardReplaceData } from "./components/dataTypes"
import { unique } from "../list"
import SchemaTagTree from "../tagTree/schema"
import { TagListItem, TagTreeMatchOperation } from "../tagTree"
import applyEdits from "../schema/treeManipulation/applyEdits"
import StandardRoom from "./components/room"
import StandardFeature from "./components/feature"
import StandardKnowledge from "./components/knowledge"
import StandardBookmark from "./components/bookmark"
import StandardMap from "./components/map"
import StandardMessage from "./components/message"
import StandardMoment from "./components/moment"
import StandardTheme from "./components/theme"
import StandardVariable from "./components/variable"
import StandardComputed from "./components/computed"
import StandardAction from "./components/action"
import StandardImage from "./components/image"
import StandardCharacter from "./components/character"
import { isSchemaTreeNode } from "./components/utils"
import { unwrapSubject, wrappedNodeTypeGuard } from "../schema/utils"
import { HasDescription, HasName, HasShortName } from "./components/abstract"
import { isLegalKey, nodeFromWML } from "./utils"
import { StandardBaseData } from "./components/dataTypes/abstract"
import { mergeStandardComponentExport, mergeStandardComponentImport, StandardComponentExport, StandardComponentImport, StandardComponentImportRemove } from "./components/dataTypes/metaData"
import { StandardComponent } from "./components/component"
import { KeyPayload } from "./components/key"
import { deepEqual, objectFilterEntries } from "../lib/objects"
import { ExportItemContent, ExportItemRemove, ExportItemReplace, ImportItemContent, ImportItemRemove, ImportItemReplace, StandardExportItem, StandardImportItem } from "./components/metaData"

export const assertTypeguard = <T extends any, G extends T>(value: T, typeguard: (value) => value is G): G => {
    if (typeguard(value)) {
        return value
    }
    throw new Error('Type mismatch')
}

export const assertInstance = <C extends { new (...args: any[]) : any }>(value: any, classType: C): InstanceType<C> => {
    if (value instanceof classType) {
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

export const standardItemToSchemaItem = (item: StandardComponentData): GenericTreeNode<SchemaTag> => {
    switch(item.tag) {
        case 'Character':
            const { tag, ...pronouns } = item.pronouns?.data ?? { tag: 'Pronouns', subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' }
            return {
                data: { tag: 'Character', key: item.key, Pronouns: 'subject' in pronouns ? pronouns : { subject: 'they', object: 'them', possessive: 'theirs', adjective: 'their', reflexive: 'themself' } },
                children: [
                    ...[item.name, item.pronouns, item.firstImpression, item.oneCoolThing, item.outfit].filter(excludeUndefined),
                ]
            }
        case 'Room':
            return {
                data: { tag: 'Room', key: item.key },
                children: defaultSelected([
                    ...[item.shortName, item.name, item.summary, item.description].filter(excludeUndefined),
                    ...item.exits
                ])
            }
        case 'Feature':
        case 'Knowledge':
            return {
                data: { tag: item.tag, key: item.key },
                children: defaultSelected([item.name, item.description].filter(excludeUndefined))
            }
        case 'Bookmark':
            return {
                data: { tag: 'Bookmark', key: item.key },
                children: defaultSelected(item.description?.children ?? [])
            }
        case 'Message':
            return {
                data: { tag: 'Message', key: item.key },
                children: [
                    ...item.rooms,
                    ...item.description?.children ?? []
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
                ].filter(excludeUndefined))
            }
        case 'Theme':
            return {
                data: { tag: 'Theme', key: item.key },
                children: [
                    item.name,
                    ...item.rooms,
                    ...item.maps
                ].filter(excludeUndefined)
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
        case 'Remove':
            return {
                data: { tag: item.tag },
                children: [standardItemToSchemaItem(item.component)]
            }
        case 'Replace':
            return {
                data: { tag: item.tag },
                children: [
                    { data: { tag: 'ReplaceMatch' }, children: [standardItemToSchemaItem(item.match)] },
                    { data: { tag: 'ReplacePayload' }, children: [standardItemToSchemaItem(item.payload)] }
                ]
            }
    }
}

export class Standardizer extends StandardizerAbstract {}

// export type StandardComponent = StandardCharacter |
//     StandardRoom |
//     StandardFeature |
//     StandardKnowledge |
//     StandardBookmark |
//     StandardMap |
//     StandardMessage |
//     StandardMoment |
//     StandardTheme |
//     StandardVariable |
//     StandardComputed |
//     StandardAction |
//     StandardImage

export const hasName = (component: StandardComponent): component is StandardComponent & HasName => {
    return (component instanceof StandardRoom || component instanceof StandardFeature || component instanceof StandardKnowledge || component instanceof StandardMap)
}

export const hasDescription = (component: StandardComponent): component is StandardComponent & HasDescription => {
    return (component instanceof StandardRoom || component instanceof StandardFeature || component instanceof StandardKnowledge)
}

export const hasShortName = (component: StandardComponent): component is StandardComponent & HasShortName => {
    return (component instanceof StandardRoom)
}

export const standardComponentSortOrder = (componentA: StandardComponent, componentB: StandardComponent): number => {
    const componentKeys: SchemaWithKey["tag"][] = ['Character', 'Image', 'Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Theme', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
    const tagA = ((componentA instanceof StandardRemove || componentA instanceof StandardReplace)
        ? componentA._match.tag
        : componentA.tag) as SchemaWithKey["tag"]
    const tagB = ((componentB instanceof StandardRemove || componentB instanceof StandardReplace)
        ? componentB._match.tag
        : componentB.tag) as SchemaWithKey["tag"]
    const indexA = componentKeys.indexOf(tagA)
    const indexB = componentKeys.indexOf(tagB)
    if (indexA !== indexB) {
        return indexA - indexB
    }
    else {
        return componentA.key.localeCompare(componentB.key)
    }
}

//
// standardNonEditComponentFactory takes an incoming argument that can apply to one of the non-edit StandardComponent classes,
// finds the correct constructor, and creates the sub-typed class
//
export const standardNonEditComponentFactory = (arg: StandardComponentData | GenericTreeNode<SchemaTag>): StandardComponent | undefined => {

    // const subjectTypeguard = (arg: StandardComponentData | GenericTreeNode<SchemaTag>, typeGuard: (data: SchemaTag) => boolean): arg is GenericTreeNode<SchemaTag> => {
    //     if (isSchemaTreeNode(arg)) {
    //         const subject = unwrapSubject(arg)
    //         if (subject && typeGuard(subject.data)) {
    //             return true
    //         }
    //     }
    //     return false
    // }

    // const unwrapStandardTypeguard = <T extends StandardComponentData>(typeguard: (component: StandardComponentData) => component is T) => (arg: StandardComponentData): arg is StandardRemoveData | StandardReplaceData | T => {
    //     if (isStandardReplace(arg)) {
    //         return unwrapStandardTypeguard(typeguard)(arg.payload)
    //     }
    //     else if (isStandardRemove(arg)) {
    //         return unwrapStandardTypeguard(typeguard)(arg.component)
    //     }
    //     else {
    //         return typeguard(arg)
    //     }
    // }

    if ((!isSchemaTreeNode(arg) && isStandardCharacter(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaCharacter)(arg))) {
        return new StandardCharacter(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardRoom(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaRoom)(arg))) {
        return new StandardRoom(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardFeature(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaFeature)(arg))) {
        return new StandardFeature(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardKnowledge(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaKnowledge)(arg))) {
        return new StandardKnowledge(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardBookmark(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaBookmark)(arg))) {
        return new StandardBookmark(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardMap(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaMap)(arg))) {
        return new StandardMap(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardMessage(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaMessage)(arg))) {
        return new StandardMessage(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardMoment(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaMoment)(arg))) {
        return new StandardMoment(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardTheme(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaTheme)(arg))) {
        return new StandardTheme(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardVariable(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaVariable)(arg))) {
        return new StandardVariable(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardComputed(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaComputed)(arg))) {
        return new StandardComputed(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardAction(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaAction)(arg))) {
        return new StandardAction(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardImage(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaImage)(arg))) {
        return new StandardImage(arg)
    }
    return undefined
}

const removeNDJSONOnlyProperties = (props: StandardComponentData & SerializeNDJSONMixin): Omit<StandardComponentData & SerializeNDJSONMixin, 'universalKey' | 'from' | 'exportAs'> => {
    return Object.assign({}, 
        ...Object.entries(props)
            .filter(([key]) => (!['universalKey', 'from', 'exportAs'].includes(key)))
            .map(([key, value]) => ({ [key]: value }))
    )
}

//
// StandardRemove class provides a class that contains a matching StandardComponent to be removed. Note that merge
// methods at this level do NOT contain the functionality to handle component-level edits ... that is included
// at the StandardForm level, rather than on the individual component classes.
//
export class StandardRemove implements StandardComponent {
    _key: KeyPayload;
    _match: StandardComponent;
    tag: SchemaWithKey["tag"] | 'Remove' | 'Replace' = 'Remove' as const;
    constructor(props: string | StandardRemoveData | GenericTreeNode<SchemaTag>) {
        if (isSchemaTreeNode(props) || typeof props === 'string') {
            const node = typeof props === 'string'
                ? nodeFromWML(props)
                : props
            if (!treeNodeTypeguard(isSchemaRemove)(node)) {
                throw new Error(`Schema mismatch in StandardRemove constructor call.`)
            }
            const child = node.children[0]
            if (!treeNodeTypeguard(isSchemaWithKey)(child)) {
                throw new Error(`No key found in StandardRemove constructor call.`)
            }
            this._key = new KeyPayload(child.data.key)
            const match = standardNonEditComponentFactory(child)
            if (!match) {
                throw new Error('No payload found in StandardRemove constructor call.')
            }
            this._match = match
            this._key._universalKey = match.universalKey
            return
        }
        const match = standardNonEditComponentFactory(props.component)
        if (!match) {
            throw new Error('No payload found in StandardRemove constructor call.')
        }
        this._match = match
        this._key = new KeyPayload({ key: match.key, universalKey: match.universalKey })
    }

    get key() { return this._key.key }
    get universalKey() { return this._key.universalKey }
    get fileName() { return this._key.fileName }
    get import() { return this._match.import }
    get export() { return this._match.export }

    toJSON(): StandardRemoveData {
        return {
            key: this.key,
            tag: 'Remove',
            component: this._match.toJSON() as StandardComponentNonEditData & SerializeNDJSONMixin
        }
    }

    toNDJSON(): StandardComponentData & SerializeNDJSONMixin {
        return this.toJSON()
    }

    get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Remove' },
            children: [this._match.schema]
        }
    }

    merge(incoming: StandardComponent): StandardComponent | undefined {
        throw new Error('StandardRemove types cannot be directly merged')
    }

    withUniversalKey(key: string | undefined): StandardComponent {
        const returnValue = new StandardRemove(this.schema)
        returnValue._match = this._match.withUniversalKey(key)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = returnValue._match.fileName
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }

    withFileName(key: string | undefined): StandardComponent {
        const returnValue = new StandardRemove(this.schema)
        returnValue._match = this._match.withFileName(key)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = key
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }

    withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        const returnValue = new StandardRemove(this.schema)
        returnValue._match = this._match.withImport(importData)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = returnValue._match.fileName
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }

    withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        const returnValue = new StandardRemove(this.schema)
        returnValue._match = this._match.withExport(exportData)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = returnValue._match.fileName
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }
}

//
// StandardReplace class provides a class that contains a matching StandardComponent to be removed. Note that merge
// methods at this level do NOT contain the functionality to handle component-level edits ... that is included
// at the StandardForm level, rather than on the individual component classes.
//
export class StandardReplace implements StandardComponent {
    _key: KeyPayload;
    _match: StandardComponent;
    _payload: StandardComponent
    tag: SchemaWithKey["tag"] | 'Remove' | 'Replace' = 'Replace' as const;
    constructor(props: string | StandardReplaceData | GenericTreeNode<SchemaTag>) {
        if (isSchemaTreeNode(props) || typeof props === 'string') {
            const node = typeof props === 'string'
                ? nodeFromWML(props)
                : props
            if (!treeNodeTypeguard(isSchemaReplace)(node)) {
                throw new Error(`Schema mismatch in StandardReplace constructor call.`)
            }
            const matchNode = node.children.find(treeNodeTypeguard(isSchemaReplaceMatch))?.children?.[0]
            const match = matchNode ? standardNonEditComponentFactory(matchNode) : undefined
            const payloadNode = node.children.find(treeNodeTypeguard(isSchemaReplacePayload))?.children?.[0]
            const payload = payloadNode ? standardNonEditComponentFactory(payloadNode) : undefined
            if (!match) {
                throw new Error('No match found in StandardReplace constructor call.')
            }
            if (!payload) {
                throw new Error('No payload found in StandardReplace constructor call.')
            }
            if (!(match.key === payload.key && match.tag === payload.tag)) {
                throw new Error('Match and payload mistmatch in StandardReplace constructor call.')
            }
            this._match = match
            this._payload = payload
            this._key = new KeyPayload({ key: match.key, universalKey: match.universalKey })
            return
        }
        const match = standardNonEditComponentFactory(props.match)
        if (!match) {
            throw new Error('No payload found in StandardRemove constructor call.')
        }
        const payload = standardNonEditComponentFactory(props.payload)
        if (!payload) {
            throw new Error('No payload found in StandardRemove constructor call.')
        }
        if (!(match.key === payload.key && match.tag === payload.tag)) {
            throw new Error('Match and payload mistmatch in StandardReplace constructor call.')
        }
        this._match = match
        this._payload = payload
        this._key = new KeyPayload({ key: match.key, universalKey: match.universalKey })
    }

    get key() { return this._key.key }
    get universalKey() { return this._key.universalKey }
    get fileName() { return this._key.fileName }
    get import() { return this._match.import }
    get export() { return this._match.export }

    toJSON(): StandardReplaceData {
        return {
            key: this.key,
            tag: 'Replace',
            match: this._match.toJSON() as StandardComponentNonEditData & SerializeNDJSONMixin,
            payload: this._payload.toJSON() as StandardComponentNonEditData & SerializeNDJSONMixin
        }
    }

    toNDJSON(): StandardComponentData & SerializeNDJSONMixin {
        return this.toJSON()
    }

    get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Replace' },
            children: [
                { data: { tag: 'ReplaceMatch' }, children: [this._match.schema] },
                { data: { tag: 'ReplacePayload' }, children: [this._payload.schema] }
            ]
        }
    }

    merge(incoming: StandardComponent): StandardComponent | undefined {
        if (!(incoming instanceof StandardReplace)) {
            throw new Error('Type mismatch in StandardReplace merge')
        }
        if (!(deepEqual(removeNDJSONOnlyProperties(this._payload.toJSON()), removeNDJSONOnlyProperties(incoming._match.toJSON())))) {
            throw new MergeConflictError()
        }
        return new StandardReplace({
            key: this.key,
            tag: 'Replace',
            match: this._match.toJSON() as StandardComponentNonEditData,
            payload: incoming._payload.toJSON() as StandardComponentNonEditData
        }).withUniversalKey(this.universalKey)
    }

    withUniversalKey(key: string | undefined): StandardComponent {
        const returnValue = new StandardReplace(this.schema)
        returnValue._match = this._match.withUniversalKey(key)
        returnValue._payload = this._match.withUniversalKey(key)
        returnValue._key._universalKey = key
        returnValue._key._fileName = this.fileName
        return returnValue
    }

    withFileName(key: string | undefined): StandardComponent {
        const returnValue = new StandardReplace(this.schema)
        returnValue._match = this._match.withFileName(key)
        returnValue._payload = this._payload.withFileName(key)
        returnValue._key._fileName = key
        returnValue._key._universalKey = this._key._universalKey
        return returnValue
    }

    withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        const returnValue = new StandardReplace(this.schema)
        returnValue._match = this._match.withImport(importData)
        returnValue._payload = this._payload.withImport(importData)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = returnValue._match.fileName
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }

    withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        const returnValue = new StandardReplace(this.schema)
        returnValue._match = this._match.withExport(exportData)
        returnValue._payload = this._payload.withExport(exportData)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = returnValue._match.fileName
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }

}

//
// standardComponentFactory takes an incoming argument that can apply to any of the StandardComponent classes (including Remove and Replace),
// finds the correct constructor, and creates the sub-typed class
//
export const standardComponentFactory = (arg: StandardComponentData | GenericTreeNode<SchemaTag>): StandardComponent | undefined => {
    if ((!isSchemaTreeNode(arg) && isStandardRemove(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaRemove)(arg))) {
        return new StandardRemove(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardReplace(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaReplace)(arg))) {
        return new StandardReplace(arg)
    }
    return standardNonEditComponentFactory(arg)
}

//
// Utility function to create exportItemById and importItemById objects, then use them to inform the
// creation of this._byId
//
const importExportFromTree = (tree: GenericTree<SchemaTag>): { importItemById: Record<string, StandardComponentImport>; exportItemById: Record<string, StandardComponentExport> } => {
    const mergeExportIntoEntries = (previous: Record<string, StandardComponentExport>, incoming: Record<string, StandardComponentExport>): Record<string, StandardComponentExport> => {
        const [[key, incomingData]] = Object.entries(incoming)
        const baseData = previous[key]
        const mergedData = baseData ? mergeStandardComponentExport(baseData, incomingData) : incomingData
        if (mergedData) {
            return {
                ...previous,
                [key]: mergedData
            }
        }
        else {
            return objectFilterEntries(previous, ([checkKey]) => (checkKey !== key))
        }
    }
    const exportItemById = tree.filter(wrappedNodeTypeGuard(isSchemaExport))
        .reduce<Record<string, StandardComponentExport>>((previous, node) => {
            if (treeNodeTypeguard(isSchemaRemove)(node)) {
                const child = node.children[0]
                if (child && treeNodeTypeguard(isSchemaExport)(child)) {
                    return child.children
                        .map(unwrapSubject)
                        .filter(excludeUndefined)
                        .map(({ data }) => (data))
                        .filter(isImportable)
                        .map(({ key, as }) => ({ [key]: { action: 'Remove' as const, match: as ?? key } }))
                        .reduce<Record<string, StandardComponentExport>>(mergeExportIntoEntries, previous)
                }
            }
            if (treeNodeTypeguard(isSchemaReplace)(node)) {
                throw new Error('Top-level replace of Export tags not yet implemented')
            }
            if (treeNodeTypeguard(isSchemaExport)(node)) {
                const removeActions = node.children
                    .filter(treeNodeTypeguard(isSchemaRemove))
                    .map(unwrapSubject)
                    .filter(excludeUndefined)
                    .map(({ data }) => (data))
                    .filter(isImportable)
                    .map(({ key, as }) => ({ [key]: { action: 'Remove' as const, match: as ?? key } }))
                const replaceActions = node.children
                    .filter(treeNodeTypeguard(isSchemaReplace))
                    .map(({ children }) => ({
                        match: children.find(treeNodeTypeguard(isSchemaReplaceMatch))?.children?.[0],
                        payload: children.find(treeNodeTypeguard(isSchemaReplacePayload))?.children?.[0]
                    }))
                    .map(({ match, payload }) => (
                        (match && treeNodeTypeguard(isImportable)(match) && payload && treeNodeTypeguard(isImportable)(payload))
                            ? [{ [match.data.key]: { action: 'Replace' as const, match: match.data.as ?? match.data.key, payload: payload.data.as ?? payload.data.key } }]
                            : []
                    ))
                    .flat(1)
                const contentActions = node.children
                    .filter(treeNodeTypeguard(isImportable))
                    .map(({ data }) => (data))
                    .map(({ key, as }) => ({ [key]: { action: 'Content' as const, payload: as ?? key } }))
                return contentActions.reduce(
                    mergeExportIntoEntries,
                    replaceActions.reduce(
                        mergeExportIntoEntries,
                        removeActions.reduce(
                            mergeExportIntoEntries,
                            previous
                        )
                    )
                )
            }
            return previous
        }, {})
    const mergeImportIntoEntries = (previous: Record<string, StandardComponentImport>, incoming: Record<string, StandardComponentImport>): Record<string, StandardComponentImport> => {
        const [[key, incomingData]] = Object.entries(incoming)
        const baseData = previous[key]
        const mergedData = baseData ? mergeStandardComponentImport(baseData, incomingData) : incomingData
        if (mergedData) {
            return {
                ...previous,
                [key]: mergedData
            }
        }
        else {
            return objectFilterEntries(previous, ([checkKey]) => (checkKey !== key))
        }
    }
    const importItemById = tree.filter(wrappedNodeTypeGuard(isSchemaImport))
        .reduce<Record<string, StandardComponentImport>>((previous, node) => {
            if (treeNodeTypeguard(isSchemaRemove)(node)) {
                const child = node.children[0]
                if (child && treeNodeTypeguard(isSchemaImport)(child)) {
                    return child.children
                        .map(unwrapSubject)
                        .filter(excludeUndefined)
                        .map(({ data }) => (data))
                        .filter(isImportable)
                        .map(({ key, from }) => ({ [key]: { action: 'Remove' as const, match: { assetId: child.data.from, fromKey: from ?? key } } }))
                        .reduce<Record<string, StandardComponentImport>>(mergeImportIntoEntries, previous)
                }
            }
            if (treeNodeTypeguard(isSchemaReplace)(node)) {
                throw new Error('Top-level replace of Export tags not yet implemented')
            }
            if (treeNodeTypeguard(isSchemaImport)(node)) {
                const removeActions: Record<string, StandardComponentImportRemove>[] = node.children
                    .filter(treeNodeTypeguard(isSchemaRemove))
                    .map(unwrapSubject)
                    .filter(excludeUndefined)
                    .map(({ data }) => (data))
                    .filter(isImportable)
                    .map(({ key, from }) => ({ [key]: { action: 'Remove' as const, match: { assetId: node.data.from, fromKey: from ?? key } } }))
                const replaceActions = node.children
                    .filter(treeNodeTypeguard(isSchemaReplace))
                    .map(({ children }) => ({
                        match: children.find(treeNodeTypeguard(isSchemaReplaceMatch))?.children?.[0],
                        payload: children.find(treeNodeTypeguard(isSchemaReplacePayload))?.children?.[0]
                    }))
                    .map(({ match, payload }) => (
                        (match && treeNodeTypeguard(isImportable)(match) && payload && treeNodeTypeguard(isImportable)(payload))
                            ? [{ [match.data.key]: {
                                action: 'Replace' as const,
                                match: { assetId: node.data.from, fromKey: match.data.from ?? match.data.key },
                                payload: { assetId: node.data.from, fromKey: payload.data.from ?? payload.data.key }
                            } }]
                            : []
                    ))
                    .flat(1)
                const contentActions = node.children
                    .filter(treeNodeTypeguard(isImportable))
                    .map(({ data }) => (data))
                    .map(({ key, from }) => ({ [key]: { action: 'Content' as const, payload: { assetId: node.data.from, fromKey: from ?? key } } }))
                return contentActions.reduce(
                    mergeImportIntoEntries,
                    replaceActions.reduce(
                        mergeImportIntoEntries,
                        removeActions.reduce(
                            mergeImportIntoEntries,
                            previous
                        )
                    )
                )
            }
            return previous
        }, {})
    return { importItemById, exportItemById }
}

export class StandardForm {
    _key: string;
    _byId: Record<string, StandardComponent>;
    _metaData: GenericTree<SchemaTag>;

    constructor(args: StandardFormData | GenericTreeNode<SchemaTag> | StandardNDJSON | string) {
        if (typeof args === 'string' && isLegalKey(args)) {
            this._key = args
            this._byId = {}
            this._metaData = []
            return
        }
        if (isStandardForm(args)) {
            this._key = args.key

            const { importItemById, exportItemById } = importExportFromTree(args.metaData)
            this._metaData = args.metaData.filter((node) => (!wrappedNodeTypeGuard(isSchemaImport)(node)))
            this._byId = Object.values(args.byId).reduce<Record<string, StandardComponent>>((previous, standardData) => {
                const standardItem = standardComponentFactory(standardData)
                if (standardItem) {
                    return {
                        ...previous,
                        [standardItem.key]: standardItem
                            .withImport(importItemById[standardItem.key])
                            .withExport(exportItemById[standardItem.key])
                    }
                }
                else {
                    return previous
                }
            }, {})
            return
        }
        if (isStandardNDJSON(args)) {
            const assetLine = args.find((line: StandardNDJSON[number]): line is { tag: 'Asset' } & StandardBaseData => ('tag' in line && line.tag === 'Asset'))
            if (!assetLine) {
                throw new Error('No asset header found in StandardForm NDJSON input')
            }
            this._key = assetLine.key
            this._byId = args.filter(isStandardComponent).reduce<Record<string, StandardComponent>>((previous, standardData: StandardComponentData & SerializeNDJSONMixin) => {
                const standardItem = standardComponentFactory(standardData)
                if (standardItem) {
                    return {
                        ...previous,
                        [standardItem.key]: standardItem.withImport(standardData.from).withExport(standardData.exportAs)
                    }
                }
                else {
                    return previous
                }
            }, {})
            this._metaData = []

            return
        }
        if (isSchemaTreeNode(args) || typeof args === 'string') {
            const node = typeof args === 'string'
                ? nodeFromWML(args)
                : args

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
            const { importItemById, exportItemById } = importExportFromTree(node.children)
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
                        const nodeMatch: TagTreeMatchOperation<SchemaTag> = { match: ({ data }, stack) => (data.tag === tag && ('as' in data ? data.as === key : data.key === key)) }
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
                                .filter({ not: { sequence: [{ or: [ { match: 'Remove' }, { match: 'Replace' }] }, { or: [{ match: 'Import' }, { match: 'Export' }] }] }})
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

                        const adjustedTree = [
                            ...(applyEdits(adjustTagTree(importedTagTree, nodeMatch).tree)
                                .map((item) => (
                                    (treeNodeTypeguard(isImportable)(item) && item.data.as)
                                        ? { ...item, data: { ...item.data, key: item.data.as } }
                                        : item
                                ))),
                            ...applyEdits(adjustTagTree(filteredTagTree, nodeMatch).tree)
                        ]
                        adjustedTree.forEach((item) => {
                            const standardItem = standardComponentFactory(item)
                            if (standardItem) {
                                const base = this._byId[standardItem.key]
                                if (base) {
                                    const merged = base.merge(standardItem as any)
                                    if (merged) {
                                        const mergedImport = base.import && standardItem.import ? base.import.merge(standardItem.import) : base.import ?? standardItem.import
                                        const mergedExport = base.export && standardItem.export ? base.export.merge(standardItem.export) : base.export ?? standardItem.export
                                        this._byId[standardItem.key] = merged.withImport(mergedImport).withExport(mergedExport)
                                    }
                                    else {
                                        delete this._byId[standardItem.key]
                                    }
                                }
                                else {
                                    this._byId[standardItem.key] = standardItem.withImport(importItemById[standardItem.key]).withExport(exportItemById[standardItem.key])
                                }
                            }
                        })
                    })
                })
            }
            this._byId = {}
            this._metaData = []

            if (treeNodeTypeguard(isSchemaAsset)(node)) {
                const tagTree = new SchemaTagTree([node])
                tagTree._merge = ({ data: dataA }, { data: dataB }) => ({ data: { ...dataA, ...dataB } })
                const assetTree = tagTree.tree
                if (assetTree.length !== 1) {
                    throw new Error('Too many assets in Standarizer')
                }
                const asset = assetTree[0] as GenericTreeNodeFiltered<SchemaAssetTag, SchemaTag>
                this._key = asset.data.key

                this._metaData = [
                    ...tagTree.filter({ match: 'Meta' }).prune({ not: { match: 'Meta' }}).tree
                ]

                const componentKeys: SchemaWithKey["tag"][] = ['Character', 'Image', 'Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Theme', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
        
                standardizeComponentTagType(componentKeys, tagTree)
                return
            }
        }
        throw new Error('Invalid arguments in StandardForm constructor')
    }

    get metaData(): GenericTree<SchemaTag> {
        const exportContents: GenericTree<SchemaTag> = Object.values(this._byId)
            .filter((component) => (Boolean(component.export)))
            .sort(standardComponentSortOrder)
            .map((component): GenericTreeNode<SchemaTag> => {
                const schema = component.schema
                if (component.export instanceof ExportItemRemove) {
                    return {
                        data: { tag: 'Remove' as const },
                        children: [{ data: { ...schema.data, as: component.export.exportAs } as SchemaTag, children: [] }]
                    }
                }
                if (component.export instanceof ExportItemReplace) {
                    return {
                        data: { tag: 'Replace' as const },
                        children: [
                            { data: { tag: 'ReplaceMatch' as const }, children: [{ data: { ...schema.data, as: component.export.exportAs } as SchemaTag, children: [] }] },
                            { data: { tag: 'ReplacePayload' as const }, children: [{ data: { ...schema.data, as: component.export.exportAs } as SchemaTag, children: [] }] }
                        ]
                    }
                }
                if (!(component.export instanceof ExportItemContent)) {
                    throw new Error('Type mismatch in StandardForm metaData')
                }
                return {
                    data: { ...schema.data, as: component.export.exportAs } as SchemaTag,
                    children: []
                }
            })
        const exportItem: GenericTree<SchemaTag> = exportContents.length === 0
            ? []
            : exportContents.every(treeNodeTypeguard(isSchemaRemove))
                ? [{
                    data: { tag: 'Remove' as const },
                    children: [{
                        data: { tag: 'Export' as const, mapping: {} },
                        children: exportContents.map(({ children }) => (children[0]))
                    }]
                }]
                : [{
                    data: { tag: 'Export' as const, mapping: {} },
                    children: exportContents
                }]

        const importsByAssetId: Record<string, GenericTree<SchemaTag>> = Object.values(this._byId)
            .filter((component) => (Boolean(component.import)))
            .sort(standardComponentSortOrder)
            .reduce((previous, component): Record<string, GenericTree<SchemaTag>> => {
                const maybeAddFromKey = (data: SchemaTag, from: string): SchemaTag => {
                    return {
                        ...data,
                        from: from !== (data as SchemaWithKey).key ? from : undefined
                    } as SchemaTag
                }
                const schema = component.schema
                if (component.import instanceof ImportItemRemove) {
                    return {
                        ...previous,
                        [component.import.assetId]: [
                            ...(previous[component.import.assetId] ?? []),
                            {
                                data: { tag: 'Remove' as const },
                                children: [{ data: maybeAddFromKey(schema.data, component.import.fromKey), children: [] }]
                            }
                        ]
                    }
                }
                if (component.import instanceof ImportItemReplace) {
                    return {
                        ...previous,
                        [component.import.assetId]: [
                            ...(previous[component.import.assetId] ?? []),
                            {
                                data: { tag: 'Replace' as const },
                                children: [
                                    { data: { tag: 'ReplaceMatch' as const }, children: [{ data: maybeAddFromKey(schema.data, component.import.fromKey), children: [] }] },
                                    { data: { tag: 'ReplacePayload' as const }, children: [{ data: maybeAddFromKey(schema.data, component.import._payload.fromKey), children: [] }] }
                                ]
                            }
                        ]
                    }
                }
                if (!component.import) {
                    return previous
                }
                if (!(component.import instanceof ImportItemContent)) {
                    throw new Error('Type mismatch in StandardForm metadata')
                }
                return {
                    ...previous,
                    [component.import.assetId]: [
                        ...(previous[component.import.assetId] ?? []),
                        {
                            data: maybeAddFromKey(schema.data, component.import.fromKey),
                            children: []
                        }
                    ]
                }
            }, {})

        const importItems: GenericTree<SchemaTag> = Object.entries(importsByAssetId)
            .map(([key, importData]) => {
                if (importData.length === 0) {
                    return []
                }
                if (importData.every(treeNodeTypeguard(isSchemaRemove))) {
                    return [{
                        data: { tag: 'Remove' as const },
                        children: [{
                            data: { tag: 'Import' as const, mapping: {}, from: key },
                            children: importData.map(({ children }) => (children[0]))
                        }]
                    }]
                }
                return [{
                    data: { tag: 'Import' as const, mapping: {}, from: key },
                    children: importData
                }]
            })
            .flat(1)
    
        return [
            ...this._metaData,
            ...importItems,
            ...exportItem
        ]
    }
    get header(): { tag: 'Asset' } & StandardBaseData {
        return {
            tag: 'Asset',
            key: this._key
        }
    }

    get byId(): Record<string, StandardComponent> { return this._byId }
    get key(): string { return this._key }

    toJSON(): StandardFormData {
        return {
            key: this._key,
            metaData: this.metaData,
            byId: Object.values(this._byId).reduce<Record<string, StandardComponentData>>((previous, component) => {
                return {
                    ...previous,
                    [component.key]: component.toJSON() as StandardComponentData
                }
            }, {})
        }
    }

    toNDJSON(): StandardNDJSON {
        const components: (StandardComponentData & SerializeNDJSONMixin)[] = Object.values(this._byId)
            .sort(standardComponentSortOrder)
            .map((component) => (component.toNDJSON({
                // from: importById[component.key], exportAs: exportById[component.key]
            })))
        return [
            this.header,
            ...components
        ]
    }

    get schema(): GenericTreeNode<SchemaTag> {
        const metaData = this.metaData
        const children = Object.values(this._byId)
            .sort(standardComponentSortOrder)
            .map((component) => (component.schema))
        const imports = metaData.filter(wrappedNodeTypeGuard(isSchemaImport))
        const importKeys = unique(imports.map(({ children }) => (children.map(({ data }) => (data)).filter(isImportable).map(({ key, as }) => (as ?? key)))).flat(1))
        return {
            data: { tag: 'Asset', key: this._key, Story: undefined },
            children: [
                ...metaData.filter(treeNodeTypeguard(isSchemaMeta)),
                ...imports,
                //
                // Don't include a separate schema entry for an import that doesn't change the component
                //
                ...children.filter(({ data, children }) => (children.length || !(isImportable(data) && importKeys.includes(data.key)))),
                ...metaData.filter(wrappedNodeTypeGuard(isSchemaExport))
            ]
        }
    }

    _clone(): StandardForm {
        return new StandardForm(this.toJSON())
    }

    //
    // TODO: StandardForm merge method accounts for component-level edits (like StandardRemove and StandardReplace)
    // and merges all contents in place
    //
    merge(incoming: StandardForm): StandardForm {
        const allKeys = unique(Object.keys(this._byId), Object.keys(incoming._byId))
        const returnValue = this._clone()
        returnValue._byId = allKeys
            .reduce<Record<string, StandardComponent>>((previous, key) => {
                const base = this._byId[key]
                const incomingComponent = incoming._byId[key]
                //
                // Branch out to the several possible cases of combining edit tags and/or content
                //
                if (base) {
                    if (incomingComponent) {
                        if (base instanceof StandardRemove) {
                            if (incomingComponent instanceof StandardRemove) {
                                throw new Error('StandardRemove types cannot be directly merged')
                            }
                            if (incomingComponent instanceof StandardReplace) {
                                throw new MergeConflictError()
                            }
                            //
                            // A remove operation followed by an add should be merged into a Replace
                            //
                            return {
                                ...previous,
                                [key]: new StandardReplace({
                                    key,
                                    tag: 'Replace',
                                    match: base._match.toJSON() as StandardComponentNonEditData,
                                    payload: incomingComponent.toJSON() as StandardComponentNonEditData
                                })
                            }
                        }
                        else if (base instanceof StandardReplace) {
                            //
                            // A replace followed by a remove should be merged into a remove of the original content
                            //
                            if (incomingComponent instanceof StandardRemove) {
                                if (!deepEqual(removeNDJSONOnlyProperties(base._payload.toJSON()), removeNDJSONOnlyProperties(incomingComponent._match.toJSON()))) {
                                    throw new MergeConflictError()
                                }
                                return {
                                    ...previous,
                                    [key]: new StandardRemove({
                                        key,
                                        tag: 'Remove',
                                        component: base._match.toJSON() as StandardComponentNonEditData
                                    })
                                }
                            }
                            //
                            // Two replace operations should be merged into a single chained operation
                            //
                            if (incomingComponent instanceof StandardReplace) {
                                if (!deepEqual(removeNDJSONOnlyProperties(base._payload.toJSON()), removeNDJSONOnlyProperties(incomingComponent._match.toJSON()))) {
                                    throw new MergeConflictError()
                                }
                                return {
                                    ...previous,
                                    [key]: new StandardReplace({
                                        key,
                                        tag: 'Replace',
                                        match: base._match.toJSON() as StandardComponentNonEditData,
                                        payload: incomingComponent._payload.toJSON() as StandardComponentNonEditData
                                    })
                                }
                            }
                            //
                            // A replace operation followed by more content should be merged to a replace with combined payload
                            //
                            const mergedPayload = base._payload.merge(incomingComponent)
                            if (!mergedPayload) {
                                throw new MergeConflictError()
                            }
                            return {
                                ...previous,
                                [key]: new StandardReplace({
                                    key,
                                    tag: 'Replace',
                                    match: base._match.toJSON() as StandardComponentNonEditData,
                                    payload: mergedPayload.toJSON() as StandardComponentNonEditData
                                })
                            }
                        }
                        else {
                            //
                            // Remove should evaluate the match and then remove the relevant component
                            //
                            if (incomingComponent instanceof StandardRemove) {
                                if (!deepEqual(removeNDJSONOnlyProperties(base.toJSON()), removeNDJSONOnlyProperties(incomingComponent._match.toJSON()))) {
                                    throw new MergeConflictError()
                                }
                                const { [key]: _, ...rest } = previous
                                return rest
                            }
                            //
                            // Replace should evaluate the match and then replace the relevant component
                            //
                            if (incomingComponent instanceof StandardReplace) {
                                if (!deepEqual(removeNDJSONOnlyProperties(base.toJSON()), removeNDJSONOnlyProperties(incomingComponent._match.toJSON()))) {
                                    throw new MergeConflictError()
                                }
                                return {
                                    ...previous,
                                    [key]: incomingComponent._payload
                                }
                            }
                            const merge = base.merge(incomingComponent as any)
                            if (!merge) {
                                return previous
                            }
                            else {
                                return { ...previous, [key]: merge }
                            }    
                        }
                    }
                    else {
                        return { ...previous, [key]: base }
                    }
                }
                else {
                    if (incomingComponent) {
                        return { ...previous, [key]: incomingComponent }
                    }
                    else {
                        return previous
                    }
                }
            }, {})

        const combinedMetaData = new SchemaTagTree([...this._metaData, ...incoming._metaData])
        returnValue._metaData = applyEdits(combinedMetaData.tree)

        return returnValue
    }
}