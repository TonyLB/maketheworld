import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { defaultComponentFromTag, isStandardNDJSON, SerializeNDJSONMixin, StandardComponentData, StandardFormSubsetRequest, StandardFormSubsetRequestExit, StandardFormSubsetRequestFull, standardFormSubsetRequestMatch, standardFormSubsetRequestPriority, StandardNDJSON } from "./baseClasses"
import { excludeUndefined } from "../lib/lists"
import { isStandardComponentData, isStandardForm, StandardFormData } from "./components/dataTypes"
import SchemaTagTree from "../tagTree/schema"
import applyEdits from "../schema/treeManipulation/applyEdits"
import StandardRoom, { StandardRoomPayload } from "./components/room"
import StandardFeature, { StandardFeaturePayload } from "./components/feature"
import StandardKnowledge, { StandardKnowledgePayload } from "./components/knowledge"
import StandardMap from "./components/map"
import { wrappedNodeTypeGuard } from "../schema/utils"
import { HasDescription, HasName, HasShortName } from "./components/abstract"
import { isLegalKey } from "./utils"
import { StandardBaseData } from "./components/dataTypes/abstract"
import { StandardComponent } from "./components/baseClasses"
import processComponents, { ComponentProcessingTemplate } from "./processComponents"
import { StandardRemove, StandardReplace } from "./components/edits"
import { standardComponentFactory } from "./componentFactory"
import { StandardToJSONOptions } from "./components/baseClasses"
import { ComponentUUID, isSchemaAsset, isSchemaWithKey, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement } from "@tonylb/mtw-base/ts/schema/condition"
import { isSchemaImport, isSchemaMeta } from "@tonylb/mtw-base/ts/schema/metaData"
import { isSchemaExit } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaLink } from "@tonylb/mtw-base/ts/schema/renderTree"
import StandardCharacter from "./components/character"
import { isSchemaTreeNode, nodeFromWML } from "../schema"
import { mergeToComponentList, mergeUniversalKeyMappings } from "./mergeToComponentList"
import { StandardReferenceData } from "./components/dataTypes/reference"
import StandardReference, { ReferenceList, StandardKey } from "./components/reference"
import { standardComponentSortOrder } from "./sortOrder"
import { UUIDGenerator } from "@tonylb/mtw-utilities/ts/uuid/index"
import StandardAction from "./components/action"
import StandardComputed from "./components/computed"
import StandardImage from "./components/image"
import StandardMessage from "./components/message"
import StandardMoment from "./components/moment"
import StandardVariable from "./components/variable"
import StandardExample from "./components/example"

export const isStandardComponent = (value: any): value is StandardComponent => {
    return (value instanceof StandardRemove) ||
        (value instanceof StandardReplace) ||
        (value instanceof StandardAction) ||
        (value instanceof StandardCharacter) ||
        (value instanceof StandardComputed) ||
        (value instanceof StandardFeature) ||
        (value instanceof StandardImage) ||
        (value instanceof StandardKnowledge) ||
        (value instanceof StandardMap) ||
        (value instanceof StandardMessage) ||
        (value instanceof StandardMoment) ||
        (value instanceof StandardRoom) ||
        (value instanceof StandardExample) ||
        (value instanceof StandardVariable)
}

export const assertTypeguard = <T extends any, G extends T>(value: T, typeguard: (value: T) => value is G): G => {
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

export const defaultSelected = <Extra extends {}>(tree: GenericTree<SchemaTag>): GenericTree<SchemaTag> => (
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

export const hasName = (component: StandardComponent): component is StandardComponent & HasName => {
    return (component instanceof StandardRoom || component instanceof StandardFeature || component instanceof StandardKnowledge || component instanceof StandardMap)
}

export const hasDescription = (component: StandardComponent): component is StandardComponent & HasDescription => {
    return (component instanceof StandardRoom || component instanceof StandardFeature || component instanceof StandardKnowledge)
}

export const hasShortName = (component: StandardComponent): component is StandardComponent & HasShortName => {
    return (component instanceof StandardRoom) ||
        (component instanceof StandardCharacter)
}

const lookupInComponentList = (componentList: StandardComponent[], key: StandardKey): StandardComponent | undefined => {
    if (typeof key === 'string') {
        return componentList.find((component) => (component.universalKey === key))
    }
    return componentList.find((component) => (
        (component.key && component.key === key.key) ||
        (component.universalKey && component.universalKey === key.universalKey)
    ))
}


export class StandardForm {
    _key?: string;
    _components: StandardComponent[];
    _metaData: GenericTree<SchemaTag>;

    constructor(args: StandardFormData | GenericTreeNode<SchemaTag> | StandardNDJSON | string) {
        if (typeof args === 'string' && (isLegalKey(args) || args === '')) {
            this._key = args
            this._components = []
            this._metaData = []
            return
        }
        if (isStandardForm(args)) {
            this._key = args.key

            this._metaData = args.metaData.filter((node) => (!wrappedNodeTypeGuard(isSchemaImport)(node)))
            this._components = args.components.reduce<StandardComponent[]>((previous, standardData) => {
                const standardItem = standardComponentFactory(standardData)
                if (standardItem) {
                    return [
                        ...previous,
                        standardItem
                    ]
                }
                else {
                    return previous
                }
            }, [])
            return
        }
        if (isStandardNDJSON(args)) {
            const assetLine = args.find((line: StandardNDJSON[number]): line is { tag: 'Asset' } & StandardBaseData => ('tag' in line && line.tag === 'Asset'))
            if (!assetLine) {
                throw new Error('No asset header found in StandardForm NDJSON input')
            }
            this._key = assetLine.key
            this._components = args.filter(isStandardComponentData).reduce<StandardComponent[]>((previous, standardData: StandardComponentData & SerializeNDJSONMixin) => {
                const standardItem = standardComponentFactory(standardData)
                if (standardItem) {
                    standardItem._from = standardData.from
                    return [...previous, standardItem]
                }
                else {
                    return previous
                }
            }, [])

            this._metaData = []

            return
        }
        if (isSchemaTreeNode(args) || typeof args === 'string') {
            const node = typeof args === 'string'
                ? nodeFromWML(args)
                : args

            if (treeNodeTypeguard(isSchemaAsset)(node)) {
                this._key = node.data.key

                this._metaData = node.children.filter(wrappedNodeTypeGuard(isSchemaMeta))

                //
                // Templates for the following component tags: 'Character', 'Image', 'Room', 'Feature', 'Knowledge', 'Map', 'Message', 'Moment', 'Variable', 'Computed', 'Action'
                //
                const componentTemplates: ComponentProcessingTemplate[] = [
                    { key: 'Character' },
                    { key: 'Image' },
                    {
                        key: 'Room',
                        legalParents: ['Map', 'Message']
                    },
                    {
                        key: 'Feature',
                        legalParents: ['Room']
                    },
                    { key: 'Knowledge' },
                    { key: 'Map' },
                    {
                        key: 'Message',
                        legalParents: ['Moment']
                    },
                    { key: 'Moment' },
                    { key: 'Variable' },
                    { key: 'Computed' },
                    { key: 'Action' },
                    {
                        key: 'Example',
                        legalParents: ['Room', 'Feature', 'Knowledge']
                    }
                ]

                const componentFragments = processComponents({ componentTemplates, schema: node.children })
                const universalKeyMappings: StandardKey[] = componentFragments
                    .reduce<StandardKey[]>((previous, component) => {
                        const previousMatchIndex = previous.findIndex(({ key, universalKey }) => (
                            (key && key === component.key) ||
                            (universalKey && universalKey === component.universalKey)
                        ))
                        if (previousMatchIndex === -1) {
                            return [...previous, new StandardKey(component._key)]
                        }
                        const previousMatch = previous[previousMatchIndex]
                        if (previousMatch && (
                            (previousMatch.key && component.key && previousMatch.key !== component.key) ||
                            (previousMatch.universalKey && component.universalKey && previousMatch.universalKey !== component.universalKey))) {
                            throw new Error(`Key / UniversalKey mismatch in StandardForm constructor (${component.key} / ${component.universalKey})`)
                        }
                        return [
                            ...previous.slice(0, previousMatchIndex),
                            new StandardKey({
                                universalKey: previousMatch.universalKey ?? component.universalKey,
                                key: previousMatch.key ?? component.key,
                                tag: previousMatch.tag ?? component.tag
                            }),
                            ...previous.slice(previousMatchIndex + 1)
                        ]
                    }, [])
                    .filter(({ key, universalKey }) => (key || universalKey))
                this._components = componentFragments
                    .reduce<StandardComponent[]>(mergeToComponentList(universalKeyMappings), [])
                    .sort(({ _key: keyA }, { _key: keyB }) => (standardComponentSortOrder(keyA, keyB)))
                return
            }
            else {
                this._metaData = []
                this._components = []
            }
        }
        console.log(`Invalid arguments: ${JSON.stringify(args, null, 4)}`)
        throw new Error('Invalid arguments in StandardForm constructor')
    }

    get metaData(): GenericTree<SchemaTag> {
        return [...this._metaData]
    }

    get header(): { tag: 'Asset' } & StandardBaseData & SerializeNDJSONMixin {
        return {
            tag: 'Asset',
            key: this._key,
            universalKey: `ASSET#${this._key}`
        }
    }

    get byId(): Record<string, StandardComponent> {
        const returnProxy = new Proxy(this, {
            get: (target, prop: string) => {
                const findComponent = target._components.find((component) => (component.key === prop))
                if (findComponent) {
                    return findComponent
                }
                return undefined
            },
            has(target, prop: string): boolean {
                const findComponent = target._components.find((component) => (component.key === prop))
                if (findComponent) {
                    return true
                }
                return false
            },
            set: (target, prop: string, value: StandardComponent): boolean => {
                if (isStandardComponent(value)) {
                    const findComponentIndex = target._components.findIndex((component) => (component.key === prop))
                    if (findComponentIndex === -1) {
                        target._components.push(value)
                    }
                    else {
                        target._components = [
                            ...target._components.slice(0, findComponentIndex),
                            value,
                            ...target._components.slice(findComponentIndex + 1)
                        ]
                    }
                    return true
                }
                throw new Error('Invalid value in StandardForm byId setter')
            }

        })
        return returnProxy as unknown as Record<string, StandardComponent>
    }

    get byUniversalId(): Record<ComponentUUID, StandardComponent> {
        const returnProxy = new Proxy(this, {
            get: (target, prop: ComponentUUID) => {
                const findComponent = target._components.find((component) => (component.universalKey === prop))
                if (findComponent) {
                    return findComponent
                }
                return undefined
            },
            has(target, prop: ComponentUUID): boolean {
                const findComponent = target._components.find((component) => (component.universalKey === prop))
                if (findComponent) {
                    return true
                }
                return false
            },
            set: (target, prop: ComponentUUID, value: StandardComponent): boolean => {
                if (isStandardComponent(value)) {
                    const findComponentIndex = target._components.findIndex((component) => (component.universalKey === prop))
                    if (findComponentIndex === -1) {
                        target._components.push(value)
                    }
                    else {
                        target._components = [
                            ...target._components.slice(0, findComponentIndex),
                            value,
                            ...target._components.slice(findComponentIndex + 1)
                        ]
                    }
                    return true
                }
                throw new Error('Invalid value in StandardForm byUniversalId setter')
            }

        })
        return returnProxy as unknown as Record<ComponentUUID, StandardComponent>
    }

    get key(): string { return this._key ?? '' }

    toJSON(options?: StandardToJSONOptions): StandardFormData {
        const mapKeys = this._components.map(({ _key }) => (_key.plain))
        return {
            key: this._key,
            metaData: this.metaData,
            components: this._components.map((component) => (component.withMapping(mapKeys).remapReferences('universal').toJSON(options) as StandardComponentData))
        }
    }

    toNDJSON(): StandardNDJSON {
        const components: (StandardComponentData & SerializeNDJSONMixin)[] = this._components
            .sort(({ _key: keyA }, { _key: keyB }) => (standardComponentSortOrder(keyA, keyB)))
            .map((component) => (component.toJSON()))
        return [
            this.header,
            ...components
        ]
    }

    get schema(): GenericTreeNode<SchemaTag> {
        const metaData = this.metaData
        const sortedChildren = this._components
            .filter(({ _key }) => ((_key.context ?? []).length === 0))
            .sort(({ _key: keyA }, { _key: keyB }) => (standardComponentSortOrder(keyA, keyB)))
        const mapKeys = this._components.map(({ _key }) => (_key.plain))
        const children = sortedChildren
            .map((component) => (component.withMapping(mapKeys).remapReferences('key').nestedSchema(this._lookup.bind(this), { context: [] })))
        return {
            data: { tag: 'Asset', key: this._key, Story: undefined },
            children: [
                ...metaData.filter(treeNodeTypeguard(isSchemaMeta)),
                ...children
            ]
        }
    }

    _clone(): StandardForm {
        const returnValue = new StandardForm(this.key)
        returnValue._metaData = [...this._metaData]
        returnValue._components = this._components.map((component) => (component.clone()))
        return returnValue
    }

    get _keys(): StandardKey[] {
        return this._components
            .map((component) => (component._key))
    }

    _lookup(reference: StandardReferenceData): StandardComponent | undefined {
        return lookupInComponentList(this._components, new StandardKey(reference))
    }

    //
    // StandardForm merge method accounts for component-level edits (like StandardRemove and StandardReplace)
    // and merges all contents in place
    //
    merge(incoming: StandardForm): StandardForm {
        const mergedUniversalKeyMappings = mergeUniversalKeyMappings([...this._keys, ...incoming._keys])
        const returnValue = this._clone()
        returnValue._components = [...this._clone()._components, ...incoming._clone()._components].reduce(mergeToComponentList(mergedUniversalKeyMappings), [])

        const combinedMetaData = new SchemaTagTree([...this._metaData, ...incoming._metaData])
        returnValue._metaData = applyEdits(combinedMetaData.tree)

        return returnValue
    }

    subset(requests: StandardFormSubsetRequest[]): StandardForm {
        const returnValue = this._clone()
        returnValue._metaData = [...this._metaData]
        const mappings = this._components.map((component) => (component._key))
        //
        // mergeIntoRequestList is a reducer that takes a current list of request, and a new request that should
        // be merged into the list. For each key in the new request, it checks if there is a prior request
        // for that key, and if so, whether the new request has a higher priority than the prior request.
        // If so, it updates the prior request by removing that key (it will no longer be processed at the
        // lower priority request type) and adding the new request type for that key at the appropriate type,
        // either adding it to the keys list of an existing request, or creating a new request. If removing
        // a key from a prior request would leave it with no keys, then that request is removed from the list.
        //
        const mergeIntoRequestList = (previous: StandardFormSubsetRequest[], request: StandardFormSubsetRequest): StandardFormSubsetRequest[] => {
            const updatedToAddEmptyRequestTypeRecordIfNeeded = previous.find(standardFormSubsetRequestMatch(request))
                ? previous
                : [
                    ...previous,
                    {
                        ...request,
                        keys: []
                    }
                ]
            //
            // A local helper function to add a single key to the request list at the requested type
            //
            const addKeyToRequest = (match: StandardFormSubsetRequest) => (requestList: StandardFormSubsetRequest[], key: StandardKey): StandardFormSubsetRequest[] => {
                const index = requestList.findIndex(standardFormSubsetRequestMatch(match))
                if (index === -1) {
                    return [
                        ...requestList,
                        {
                            ...match,
                            keys: [key]
                        }
                    ]
                }
                return requestList.map((item, i) => {
                    if (i === index) {
                        return {
                            ...item,
                            keys: [...item.keys.filter((checkKey) => (!key.equals(checkKey))), key]
                        }
                    }
                    return item
                })
            }

            //
            // Update key lists to remove lower priority previous request
            //
            return request.keys.reduce<StandardFormSubsetRequest[]>((accumulator, key) => {
                const priorRequestByKey = accumulator.find(({ keys }) => (keys.some((checkKey) => (key.equals(checkKey)))))
                if (priorRequestByKey) {
                    const priorPriority = standardFormSubsetRequestPriority(priorRequestByKey)
                    if (standardFormSubsetRequestPriority(request) < priorPriority) {
                        //
                        // If the new request has a higher priority than the prior request, then remove the key
                        // from the prior request and add the new request type for that key.
                        //
                        const trimmedAccumulator = accumulator.map((prior) => {
                            if (prior === priorRequestByKey) {
                                const newKeys = prior.keys.filter((checkKey) => (!key.equals(checkKey)))
                                return {
                                    ...prior,
                                    keys: newKeys
                                }
                            }
                            return prior
                        }).filter(({ keys }) => (keys.length > 0))
                        return addKeyToRequest(request)(trimmedAccumulator, key)
                    }
                }
                return addKeyToRequest(request)(accumulator, key)
            }, updatedToAddEmptyRequestTypeRecordIfNeeded)

        }

        //
        // cascadeRequests is a recursive function that takes a list of new requests, and a list of *prior* requests,
        // and in the context of this StandardForm, determines the full and complete list of requests (including any
        // that are created by cascading conditions). At each step, it checks for cascades generated by the new requests,
        // and creates a cascadeList, then compares that cascadeList against the merger of the prior requests and the new requests.
        // If there are any new requests in the cascadeList that are not already in the merged requests, then it recursively calls
        // itself with the cascadeList as the new requests, and the merged requests as the prior requests.
        //
        const cascadeRequests = (newRequests: StandardFormSubsetRequest[], priorRequests: StandardFormSubsetRequest[] = []): StandardFormSubsetRequest[] => {
            const mergedRequests = newRequests.reduce(mergeIntoRequestList, priorRequests)
            const cascadeList = newRequests.reduce<StandardFormSubsetRequest[]>((previous, request) => {
                if (request.requestType !== 'Full' && request.requestType !== 'Exit') {
                    return previous
                }
                const cascadeFunction: (referenceKey: StandardKey) => StandardFormSubsetRequest[] = (key) => ([
                    ...([this._lookup(key)]
                        .filter(excludeUndefined)
                        .map((component) => {
                            const referencedKeys = component.withMapping(mappings).referencedKeys()
                            return referencedKeys.map(({ key, referenceType }) => {
                                if (request.requestType === 'Full') {
                                    if (referenceType === 'Direct') {
                                        return {
                                            requestType: 'Full' as const,
                                            keys: [key],
                                            cascadeConditions: request.cascadeConditions?.filter(({ chainCascade }) => (chainCascade))
                                        }
                                    }
                                    if (referenceType === 'Position') {
                                        return {
                                            requestType: 'ShortName' as const,
                                            keys: [key],
                                            cascadeConditions: request.cascadeConditions?.filter(({ chainCascade }) => (chainCascade))
                                        }
                                    }
                                }
                                return {
                                    requestType: 'Stub' as const,
                                    keys: [key],
                                    cascadeConditions: request.cascadeConditions?.filter(({ chainCascade }) => (chainCascade))
                                }
                            })
                        })
                        .flat(1)
                    ),
                    ...(request.cascadeConditions && request.cascadeConditions.length)
                        ? request.cascadeConditions?.map(({ conditionType, cascadeType, chainCascade }) => {
                            const returnValue = {
                                requestType: cascadeType,
                                keys: [this._lookup(key)]
                                    .filter(excludeUndefined)
                                    .map((component) => (
                                        component.withMapping(mappings).referencedKeys()
                                            .filter(({ referenceType }) => (referenceType === conditionType))
                                            .map(({ key }) => (key))
                                    ))
                                    .flat(1),
                                cascadeConditions: chainCascade ? request.cascadeConditions : undefined
                            }
                            if (returnValue.keys.length === 0) {
                                return []
                            }
                            return returnValue
                        }).flat(1).filter(excludeUndefined) ?? []
                        : []
                ])
                return request.keys.map(cascadeFunction)
                    .flat(1)
                    .map((request) => ({
                        ...request,
                        keys: request.keys.map(this._lookup.bind(this))
                            .filter(excludeUndefined)
                            .map(({ _key }) => (_key))
                    }))
                    .reduce(mergeIntoRequestList, [])
            }, [])
            if (cascadeList.length === 0) {
                return mergedRequests
            }
            const newCascadeList = cascadeList.filter((request) => (!mergedRequests.find((checkRequest) => (
                standardFormSubsetRequestMatch(request) &&
                (!request.keys.some((key) => (!checkRequest.keys.some((checkKey) => (key.equals(checkKey))))))
            ))))
            if (newCascadeList.length === 0) {
                return mergedRequests
            }
            return cascadeRequests(newCascadeList, mergedRequests)
        }

        const allRequests = cascadeRequests(requests)
        const requestOutput = (request: StandardFormSubsetRequest, component: StandardComponent): StandardComponent[] => {
            if (request.requestType === 'Full') {
                return [component]
            }
            if (request.requestType === 'Stub' || request.requestType === 'ShortName' || request.requestType === 'Exit') {
                const returnValue = component.clone()
                if (returnValue instanceof StandardRoom) {
                    returnValue._payload = new StandardRoomPayload()
                    if ((request.requestType === 'ShortName' || request.requestType === 'Exit') && component instanceof StandardRoom) {
                        returnValue._payload._shortName = component._payload._shortName
                        if (request.requestType === 'Exit') {
                            returnValue._payload._exits = component.exits
                        }
                    }
                }
                if (returnValue instanceof StandardFeature) {
                    returnValue._payload = new StandardFeaturePayload()
                }
                if (returnValue instanceof StandardKnowledge) {
                    returnValue._payload = new StandardKnowledgePayload()
                }
                return [returnValue]
            }
            return []
        }

        returnValue._components = allRequests
            .reduce<StandardComponent[]>((previous, request) => {
                return request.keys.reduce<StandardComponent[]>((accumulator, key) => {
                    const component = lookupInComponentList(this._components, key)
                    if (!component) {
                        return accumulator
                    }
                    return requestOutput(request, component).reduce<StandardComponent[]>((innerAccumulator, output) => (mergeToComponentList(returnValue._keys)(innerAccumulator, output)), accumulator)
                }, previous)
            }, [])

        return returnValue
    }

    renameKey(props: { fromKey: string; toKey: string; retainOldExportAs?: boolean; }[]): StandardForm {
        const returnValue = this._clone()
        const findMatchingRename = (key: string): { fromKey: string; toKey: string; retainOldExportAs?: boolean; } | undefined => {
            const match = props.find(({ fromKey }) => (key.startsWith(fromKey)))
            return match
                ? {
                    fromKey: key,
                    toKey: `${match.toKey}${key.slice(match.fromKey.length)}`,
                    retainOldExportAs: match.retainOldExportAs
                }
                : undefined
        }
        const renameContentsCallback = (tree: GenericTree<SchemaTag>): GenericTree<SchemaTag> => (
            tree.map((node) => {
                if (treeNodeTypeguard(isSchemaWithKey)(node)) {
                    const match = findMatchingRename(node.data.key ?? '')
                    if (match) {
                        return {
                            data: { ...node.data, key: match.toKey },
                            children: renameContentsCallback(node.children)
                        }
                    }
                    return node
                }
                else {
                    if (treeNodeTypeguard(isSchemaExit)(node)) {
                        const matchTo = findMatchingRename(node.data.to)
                        if (matchTo) {
                            return {
                                data: {
                                    ...node.data,
                                    to: matchTo.toKey
                                },
                                children: renameContentsCallback(node.children)
                            }
                        }
                    }
                    if (treeNodeTypeguard(isSchemaLink)(node)) {
                        const matchTo = findMatchingRename(node.data.to)
                        if (matchTo) {
                            return {
                                data: {
                                    ...node.data,
                                    to: matchTo.toKey
                                },
                                children: renameContentsCallback(node.children)
                            }
                        }
                    }
                }
                return {
                    ...node,
                    children: renameContentsCallback(node.children)
                }
            })
        )
        // returnValue._components = returnValue._components
        //     .reduce<StandardComponent[]>((previous, component) => {
        //         const matchKey = findMatchingRename(component.key ?? '')
        //         if (matchKey) {
        //             if (lookupInComponentList(previous, matchKey.toKey)) {
        //                 throw new Error('renameKey collision')
        //             }

        //             return [
        //                 ...previous,
        //                 component
        //                     .mapContents(renameContentsCallback)
        //                     .withKey(matchKey.toKey)
        //             ]
        //         }
        //         if (previous[component.key ?? '']) {
        //             throw new Error('renameKey collision')
        //         }
        //         return {
        //             ...previous,
        //             [component.key ?? '']: component.mapContents(renameContentsCallback)
        //         }
        //     }, {})

        return returnValue
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardForm {
        const returnValue = this._clone()
        returnValue._components = returnValue._components.map((component) => (component.mapContents(callback)))
        return returnValue
    }

    withUpdatedUniversalKeys(callback: (key: string) => string | undefined): StandardForm {
        const returnValue = this._clone()
        returnValue._components = returnValue._components.map((component) => {
            const updatedUniversalKey = callback(component.key ?? '')
            if (updatedUniversalKey && !(component.universalKey === updatedUniversalKey)) {
                return component.withUniversalKey(updatedUniversalKey)
            }
            return component
        })
        return returnValue
    }

    assureComponent(reference: StandardKey): StandardForm {
        const returnValue = this._clone()
        const existingComponent = returnValue._lookup(reference)
        if (existingComponent) {
            return returnValue
        }
        const newComponent = standardComponentFactory(defaultComponentFromTag(reference.tag, reference.key, reference.universalKey))?.withLeastCommonContext(reference.context ?? [])
        if (!newComponent) {
            throw new Error(`Unable to create component for tag ${reference.tag} with key ${reference.key} and universalKey ${reference.universalKey}`)
        }
        returnValue._components = [...returnValue._components, newComponent]
        const parentContext = reference.context?.slice(-1) ?? []
        if (parentContext.length > 0) {
            const parentComponent = parentContext[0].withContext(reference.context?.slice(0, -1) ?? [])
            const assuredValue = returnValue.assureComponent(parentComponent)
            assuredValue._components = assuredValue._components
                .map((component) => {
                    if (component._key.plain.equals(parentComponent.plain)) {
                        return component.withChild(new StandardReference(reference.plain))
                    }
                    return component
                })
            return assuredValue
        }
        return returnValue
    }

    finalize(): StandardForm {
        const returnValue = this._clone()
        const uuidGenerator = new UUIDGenerator()
        const uuidDefaultedComponents = returnValue._components
            .map((component) => {
                if (!component.universalKey) {
                    return component.withUniversalKey(`${component.tag.toUpperCase()}#${uuidGenerator.next()}`)
                }
                return component
            })
        const rebuiltContextComponents = uuidDefaultedComponents
            .sort(({ _key: keyA }, { _key: keyB }) => ((keyA.context ?? []).length - (keyB.context ?? []).length))
            .reduce<StandardComponent[]>((previous, component) => {
                if (component._key.context && component._key.context.length > 0) {
                    const directParentKey = component._key.context.slice(-1)[0]
                    const directParent = lookupInComponentList(previous, directParentKey)
                    if (directParent) {
                        const newContext = [...(directParent._key.context ?? []), directParent._key.plain.toFormat('universal')]
                        return [...previous, component.withLeastCommonContext(newContext)]
                    }
                }
                return [...previous, component]
            }, [])
            .sort(({ _key: keyA }, { _key: keyB }) => (standardComponentSortOrder(keyA, keyB)))
        returnValue._components = rebuiltContextComponents
        const hierarchyAssuredStandardForm = returnValue._components
            .reduce<StandardForm>((previous, component) => {
                const parentComponent = component._key.context?.slice(-1)[0]?.withContext(component._key.context?.slice(0, -1) ?? [])
                if (parentComponent) {
                    const assuredComponent = previous.assureComponent(parentComponent)
                    assuredComponent._components = assuredComponent._components
                        .map((existingComponent) => {
                            if (existingComponent._key.plain.equals(parentComponent.plain)) {
                                return existingComponent.withChild(new StandardReference(component._key.plain))
                            }
                            return existingComponent
                        })
                    return assuredComponent
                }
                return previous
            }, returnValue)
        const mappings: StandardKey[] = hierarchyAssuredStandardForm._components
            .map((component) => (component._key))
        returnValue._components = hierarchyAssuredStandardForm._components.map((component) => (component.withMapping(mappings).remapReferences('universal')))
        return returnValue
    }

    diff(incoming: StandardForm): StandardForm {

        //
        // In order to have a baseline between two StandardForms, we first merge the keys of both forms
        // (to draw associations between local keys and universal keys wherever they exist in either
        // data structure). This importantly simplifies the resulting diff, and makes it more useful.
        //
        const mergedForKeys = [...this._components, ...incoming._components]
            .reduce<StandardKey[]>((previous, component) => {
                const existingIndex = previous.findIndex((key) => (key.plain.equals(component._key.plain)))
                if (existingIndex === -1) {
                    return [...previous, component._key]
                }
                else {
                    return previous.map((key, index) => {
                        if (index === existingIndex) {
                            return key.merge(component._key)
                        }
                        return key
                    })
                }
            }, [])

        //
        // Sort the keys in the merged form by the standardComponentSortOrder, to provide an order in which
        // to diff the components in each StandardForm against each other.
        //

        const allKeys = new ReferenceList(
            [...this._components, ...incoming._components]
            .map((component) => (new StandardReference(component.referenceData)))
        ).payload.map((reference) => (reference._payload.plain.toJSON()))

        //
        // Next, we need a zippered version of the components in the two forms, with an
        // incoming component (if it exists) and a previous component (if it exists).
        //

        const zipperedComponents = allKeys
            .map((reference) => ({
                reference,
                previous: this._lookup(reference)?.withMapping(mergedForKeys)?.remapReferences('both'),
                incoming: incoming._lookup(reference)?.withMapping(mergedForKeys)?.remapReferences('both')
            }))
            .filter(({ previous, incoming }) => (previous || incoming))

        //
        // Now we can diff the components in the two forms against each other, using the
        // zipperedComponents as the basis for the diff.
        //

        const diffedValue = this._clone()
        const diffedComponents = zipperedComponents
            .reduce<StandardComponent[]>((previous, { previous: previousComponent, incoming: incomingComponent }) => {
                if (previousComponent && incomingComponent) {
                    const diffedComponent = previousComponent.diff(incomingComponent, {})
                    if (diffedComponent) {
                        return [...previous, diffedComponent]
                    } else {
                        return previous
                    }
                }
                else {
                    if (previousComponent) {
                        return [
                            ...previous,
                            new StandardRemove(previousComponent)
                        ]
                    }
                    if (incomingComponent) {
                        return [
                            ...previous,
                            incomingComponent
                        ]
                    }
                    throw new Error('diff error')
                }
            }, [])

        //
        // Find components that are not diffed, but appear nested inside of diff components of
        // StandardReplace or StandardRemove form (so that you can match terms completely in the
        // final diff)
        //
        diffedValue._components = diffedComponents
            .filter((component) => (component instanceof StandardReplace || component instanceof StandardRemove))
            .reduce<StandardComponent[]>((previous, component) => {
                const nestedComponents = this._components
                    .filter(({ _key }) => (Boolean((_key.context ?? []).find((contextKey) => (contextKey.equals(component._key.plain))))))
                    .filter(({ universalKey }) => (!Boolean(previous.find(({ universalKey: existingUniversalKey }) => (existingUniversalKey === universalKey)))))
                return [...previous, ...nestedComponents]
            }, diffedComponents)

        const combinedMetaData = new SchemaTagTree([...this._metaData, ...incoming._metaData])
        diffedValue._metaData = applyEdits(combinedMetaData.tree)

        return diffedValue.finalize()
    }

}