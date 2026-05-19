import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { defaultComponentFromTag, isStandardNDJSON, SerializeNDJSONMixin, StandardComponentInputData, StandardFormSemanticMode, StandardFormSubsetRequest, StandardFormSubsetCascadeCondition, standardFormSubsetRequestMatch, standardFormSubsetRequestPriority, StandardNDJSON, StandardComponentData } from "./baseClasses"
import { isStandardComponentInputData, isStandardFormInput, StandardFormData, StandardFormInputData } from "./components/dataTypes"
import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import SchemaTagTree from "../tagTree/schema"
import applyEdits from "../schema/treeManipulation/applyEdits"
import StandardRoom, { StandardRoomPayload } from "./components/room"
import StandardFeature, { StandardFeaturePayload } from "./components/feature"
import StandardKnowledge, { StandardKnowledgePayload } from "./components/knowledge"
import StandardMap from "./components/map"
import { findTaggedChildren, wrappedNodeTypeGuard } from "../schema/utils"
import { HasDescription, HasDisplayName, HasShortName } from "./components/abstract"
import { StandardBaseData } from "./components/dataTypes/abstract"
import { StandardComponent, StandardComponentReferenceKey } from "./components/baseClasses"
import processComponents from "./processComponents"
import { standardComponentFactory } from "./componentFactory"
import { StandardToJSONOptions } from "./components/baseClasses"
import { AssetUUID, ComponentUUID, isSchemaAsset, isSchemaAssetUUID, isSchemaOutputTag, isSchemaWithKey, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaImport } from "@tonylb/mtw-base/ts/schema/metaData"
import { isSchemaExit } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaLink } from "@tonylb/mtw-base/ts/schema/renderTree"
import StandardCharacter from "./components/character"
import { isSchemaTreeNode, nodeFromWML } from "../schema"
import { mergeToComponentList, mergeUniversalKeyMappings } from "./mergeToComponentList"
import { ReferenceListData, StandardReferenceData, StandardKeyData } from "./keys/dataTypes/reference"
import { ReferenceList } from "./keys/referenceList"
import StandardReference, { referenceSortOrder } from "./keys/reference"
import { StandardKey } from "./keys/key"
import { UUIDGenerator } from "@tonylb/mtw-utilities/ts/uuid/index"
import StandardImage from "./components/image"
import StandardMessage from "./components/message"
import StandardMoment from "./components/moment"
import StandardGuidance from "./components/guidance"
import StandardSituation from "./components/situation"
import StandardMark, { StandardLens } from "./components/worldState"
import { StandardLiteral } from "./literal"
import { StandardRender } from "./render"
import { excludeUndefined } from "../lib/lists"
import { KeyLookup } from "./keyLookup"
import { SchemaOrganization, createOrganizationContext } from "./schemaOrganization"
import { renderReference } from "./components/utils/schema"
import { RemoveClass as StandardExplicitKeyRemoveClass, ReplaceClass as StandardExplicitKeyReplaceClass } from "./explicit/key"
import { resolveStandardizeMode, type StandardFormConstructionOptions, type WmlStandardizeMode } from "./wmlStandardizeMode"
import { deepEqual } from "../lib/objects"
import { defaultedEquals } from "./components/utils/defaultedEquals"

//
// Component order defines which component tags are processed from schema (and their order).
//
const COMPONENT_ORDER: string[] = [
    'Character',
    'Image',
    'Room',
    'Feature',
    'Knowledge',
    'Map',
    'Message',
    'Moment',
    'Guidance',
    'Situation',
    'Mark',
    'Lens'
]

export const isStandardComponent = (value: any): value is StandardComponent => {
    return (value instanceof StandardCharacter) ||
        (value instanceof StandardFeature) ||
        (value instanceof StandardImage) ||
        (value instanceof StandardKnowledge) ||
        (value instanceof StandardMap) ||
        (value instanceof StandardMessage) ||
        (value instanceof StandardMoment) ||
        (value instanceof StandardRoom) ||
        (value instanceof StandardGuidance) ||
        (value instanceof StandardSituation) ||
        (value instanceof StandardMark) ||
        (value instanceof StandardLens)
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

export const hasDisplayName = (component: StandardComponent): component is StandardComponent & HasDisplayName => {
    return (component instanceof StandardCharacter)
}

export const hasDescription = (component: StandardComponent): component is StandardComponent & HasDescription => {
    return (component instanceof StandardRoom || component instanceof StandardFeature || component instanceof StandardKnowledge)
}

export const hasShortName = (component: StandardComponent): component is StandardComponent & HasShortName => {
    return (component instanceof StandardRoom) ||
        (component instanceof StandardCharacter) ||
        (component instanceof StandardFeature) ||
        (component instanceof StandardKnowledge) ||
        (component instanceof StandardMap) ||
        (component instanceof StandardImage) ||
        (component instanceof StandardMessage) ||
        (component instanceof StandardMoment) ||
        (component instanceof StandardSituation) ||
        (component instanceof StandardGuidance)
}

export type StandardFormEqualsOptions = {
    optimizeByUniversalKey?: boolean;
}

export class StandardForm {
    _universalKey: AssetUUID;
    _components: StandardComponent[];
    _metaData: GenericTree<SchemaTag>;
    _shortName?: StandardLiteral;
    _summary?: StandardRender;
    _topLevel?: ReferenceList;
    /**
     * Optional semantic mode indicating how this StandardForm should be interpreted and used.
     * 
     * @see {@link ./AGENT.md#semantic-modes AGENT.md - Semantic Modes} for detailed explanation of each mode
     */
    semanticMode?: StandardFormSemanticMode;
    standardizeMode: WmlStandardizeMode;
    _keyLookupCache?: KeyLookup;
    _schemaOrganizationCache?: SchemaOrganization;

    static resolveInitialStandardizeMode(
        args: StandardFormInputData | GenericTreeNode<SchemaTag> | StandardNDJSON | string,
        options?: StandardFormConstructionOptions,
    ): WmlStandardizeMode {
        if (isStandardFormInput(args) && args.standardizeMode !== undefined) {
            return resolveStandardizeMode(args.standardizeMode)
        }
        return resolveStandardizeMode(options?.standardizeMode)
    }

    constructor(
        args: StandardFormInputData | GenericTreeNode<SchemaTag> | StandardNDJSON | string,
        options?: StandardFormConstructionOptions,
    ) {
        this.standardizeMode = StandardForm.resolveInitialStandardizeMode(args, options)
        if (typeof args === 'string' && isSchemaAssetUUID(args)) {
            this._universalKey = args
            this._components = []
            this._metaData = []
            return
        }
        if (isStandardFormInput(args)) {
            this._universalKey = args.universalKey

            this._metaData = args.metaData.filter((node) => (!wrappedNodeTypeGuard(isSchemaImport)(node)))
            this._components = args.components.reduce<StandardComponent[]>((previous, standardData) => {
                const { component } = standardComponentFactory(standardData, { standardizeMode: this.standardizeMode })
                if (component) {
                    return [
                        ...previous,
                        component
                    ]
                }
                else {
                    return previous
                }
            }, [])
            // Extract Asset-level metadata from StandardFormData
            this._shortName = args.shortName ? new StandardLiteral(args.shortName, { tag: 'ShortName' }) : undefined
            this._summary = args.summary ? new StandardRender(args.summary) : undefined
            this._topLevel = args.topLevel ? new ReferenceList(args.topLevel) : undefined

            this.validate()
            return
        }
        if (isStandardNDJSON(args)) {
            const assetLine = args.find((line: StandardNDJSON[number]): line is { tag: 'Asset' } & StandardBaseData => ('tag' in line && line.tag === 'Asset'))
            if (!assetLine) {
                throw new Error('No asset header found in StandardForm NDJSON input')
            }
            if (!assetLine.universalKey || !isSchemaAssetUUID(assetLine.universalKey)) {
                throw new Error('Asset universalKey is required in NDJSON')
            }
            this._universalKey = assetLine.universalKey
            
            // Extract Asset-level metadata from NDJSON header
            this._shortName = (assetLine as any).shortName ? new StandardLiteral((assetLine as any).shortName, { tag: 'ShortName' }) : undefined
            this._summary = (assetLine as any).summary ? new StandardRender((assetLine as any).summary) : undefined
            this._topLevel = (assetLine as any).topLevel ? new ReferenceList((assetLine as any).topLevel) : undefined
            
            this._components = args.filter(isStandardComponentInputData).reduce<StandardComponent[]>((previous, standardData: StandardComponentInputData & SerializeNDJSONMixin) => {
                const { component } = standardComponentFactory(standardData, { standardizeMode: this.standardizeMode })
                if (component) {
                    component._from = standardData.from
                    return [...previous, component]
                }
                else {
                    return previous
                }
            }, [])

            this._metaData = []

            this.validate()
            return
        }
        if (isSchemaTreeNode(args) || typeof args === 'string') {
            const node = typeof args === 'string'
                ? nodeFromWML(args)
                : args

            if (treeNodeTypeguard(isSchemaAsset)(node)) {
                this._universalKey = node.data.uuid

                this._metaData = []

                //
                // Extract ShortName and Summary from Asset children.
                // Use findTaggedChildren for direct ShortName only (Asset-level shortName is a direct child of Asset).
                //
                const shortNameItem = findTaggedChildren({ children: node.children, tag: 'ShortName' })
                const tagTree = new SchemaTagTree(node.children)
                const summaryItem = tagTree
                    .filter({ and: [{ match: 'Summary' }, { not: { match: 'Example' } }] })
                    .prune({ match: 'Summary' })
                    .tree
                    .filter(wrappedNodeTypeGuard(isSchemaOutputTag))
                this._shortName = shortNameItem.length ? new StandardLiteral(shortNameItem, { tag: 'ShortName' }) : undefined
                this._summary = summaryItem.length ? new StandardRender(summaryItem) : undefined

                const { components: componentFragments, topLevel: topLevelKeys } = processComponents({ 
                    componentOrder: COMPONENT_ORDER, 
                    schema: node.children,
                    assetUUID: this._universalKey,
                    standardizeMode: this.standardizeMode,
                })
                const universalKeyMappings: StandardKey[] = componentFragments
                    .reduce<StandardKey[]>((previous, component) => {
                        const previousMatchIndex = previous.findIndex(({ key, universalKey }) => (
                            (key && key === component.key) ||
                            (universalKey && universalKey === component.universalKey)
                        ))
                        if (previousMatchIndex === -1) {
                            return [...previous, component.standardKey]
                        }
                        const previousMatch = previous[previousMatchIndex]
                        if (previousMatch && (
                            (previousMatch.key && component.key && previousMatch.key !== component.key) ||
                            (previousMatch.universalKey && component.universalKey && previousMatch.universalKey !== component.universalKey))) {
                            throw new Error(`Key / UniversalKey mismatch in StandardForm constructor (${component.key} / ${component.universalKey})`)
                        }
                        // Merge previousMatch with component's standardKey
                        const mergedKey = component.standardKey
                        return [
                            ...previous.slice(0, previousMatchIndex),
                            mergedKey,
                            ...previous.slice(previousMatchIndex + 1)
                        ]
                    }, [])
                    .filter(({ key, universalKey }) => (key || universalKey))
                this._components = componentFragments
                    .reduce<StandardComponent[]>(mergeToComponentList(universalKeyMappings), [])
                    
                // Populate topLevel from processComponents result (already a ReferenceList)
                this._topLevel = topLevelKeys
                
                // Sort using SchemaOrganization (validates circular parents during construction)
                const keyLookup = new KeyLookup(this._components)
                const organization = new SchemaOrganization({
                    components: this._components,
                    assetUUID: this._universalKey,
                    topLevel: this._topLevel,
                    keyLookup
                })
                this._components = this._components
                    .sort((componentA, componentB) => (organization.sortOrder(componentA.standardKey, componentB.standardKey)))
                
                // Validate other explicit parent rules (parent exists, parent type validity)
                this.validate()
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

    /**
     * Returns true when the StandardForm contains no meaningful content.
     * Meaningful content includes any components, Asset-level ShortName/Summary, or topLevel references.
     * Imports and empty metadata do not count as content.
     */
    isEmpty(): boolean {
        const hasComponents = this._components.some((component) => {
            if (!component.isEmpty()) {
                return true
            }
            // Key/Parent-only diffs are meaningful even when payload is empty.
            return Boolean(component.key || component.explicitParent)
        })
        const hasShortName = Boolean(this._shortName && !this._shortName.isEmpty())
        const hasSummary = Boolean(this._summary && !this._summary.isEmpty())
        const hasTopLevel = Boolean(this._topLevel && !this._topLevel.isEmpty())
        return !(hasComponents || hasShortName || hasSummary || hasTopLevel)
    }

    private _normalizedMetaData(): string[] {
        return (new SchemaTagTree(this._metaData))
            .tree
            .map((node) => JSON.stringify(node))
            .sort()
    }

    private _assetLevelEquals(incoming: StandardForm): boolean {
        return this._universalKey === incoming._universalKey &&
            this.standardizeMode === incoming.standardizeMode &&
            defaultedEquals(this._shortName, incoming._shortName) &&
            defaultedEquals(this._summary, incoming._summary) &&
            defaultedEquals(this._topLevel, incoming._topLevel) &&
            deepEqual(this._normalizedMetaData(), incoming._normalizedMetaData())
    }

    private _componentSetEquals(incoming: StandardForm): boolean {
        if (this._components.length !== incoming._components.length) {
            return false
        }
        const incomingByStandardKey = new Map(
            incoming._components.map((component) => [
                JSON.stringify(component.standardKey.toJSON()),
                component
            ])
        )
        if (incomingByStandardKey.size !== incoming._components.length) {
            return false
        }
        return this._components.every((component) => {
            const incomingComponent = incomingByStandardKey.get(JSON.stringify(component.standardKey.toJSON()))
            return incomingComponent ? component.equals(incomingComponent) : false
        })
    }

    private _canOptimizeByUniversalKey(incoming: StandardForm): boolean {
        if (this._components.some(({ universalKey }) => !universalKey) || incoming._components.some(({ universalKey }) => !universalKey)) {
            return false
        }
        const thisUniversalKeys = new Set(this._components.map(({ universalKey }) => universalKey))
        const incomingUniversalKeys = new Set(incoming._components.map(({ universalKey }) => universalKey))
        return thisUniversalKeys.size === this._components.length &&
            incomingUniversalKeys.size === incoming._components.length
    }

    private _componentSetEqualsByUniversalKey(incoming: StandardForm): boolean {
        if (this._components.length !== incoming._components.length) {
            return false
        }
        const incomingByUniversalKey = new Map(incoming._components.map((component) => [component.universalKey, component]))
        if (incomingByUniversalKey.size !== incoming._components.length) {
            return false
        }
        return this._components.every((component) => {
            const incomingComponent = component.universalKey ? incomingByUniversalKey.get(component.universalKey) : undefined
            return incomingComponent ? component.equals(incomingComponent) : false
        })
    }

    equals(incoming: StandardForm, options?: StandardFormEqualsOptions): boolean {
        if (this === incoming) {
            return true
        }
        if (!this._assetLevelEquals(incoming)) {
            return false
        }
        if (options?.optimizeByUniversalKey && this._canOptimizeByUniversalKey(incoming)) {
            return this._componentSetEqualsByUniversalKey(incoming)
        }
        return this._componentSetEquals(incoming)
    }

    get metaData(): GenericTree<SchemaTag> {
        return [...this._metaData]
    }

    get shortName(): StandardLiteral | undefined {
        return this._shortName
    }

    get summary(): StandardRender | undefined {
        return this._summary
    }

    get header(): { tag: 'Asset'; shortName?: StandardEditableData<string>; summary?: StandardEditableData<RenderTree>; topLevel?: ReferenceListData } & StandardBaseData & SerializeNDJSONMixin {
        const header: { tag: 'Asset'; shortName?: StandardEditableData<string>; summary?: StandardEditableData<RenderTree>; topLevel?: ReferenceListData } & StandardBaseData & SerializeNDJSONMixin = {
            tag: 'Asset',
            universalKey: this._universalKey
        }
        // Include Asset-level metadata in NDJSON header (following omission-over-empty principle)
        if (this._shortName) {
            header.shortName = this._shortName.toJSON()
        }
        if (this._summary) {
            header.summary = this._summary.toJSON()
        }
        if (this._topLevel) {
            header.topLevel = this._topLevel.toFormat('universal').toJSON()
        }
        return header
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
                    target.invalidateCache()
                    return true
                }
                throw new Error('Invalid value in StandardForm byId setter')
            }

        })
        return returnProxy as unknown as Record<string, StandardComponent>
    }

    referencedKeys(): StandardComponentReferenceKey[] {
        if (!this._topLevel) {
            return []
        }
        // Convert topLevel references to StandardComponentReferenceKey format
        return this._topLevel.payload
            .map(ref => ({
                reference: ref,
                referenceType: 'Direct' as const
            }))
    }

    /**
     * Returns references to all components in this StandardForm that reference the given component.
     * This is the inverse of per-component referencedKeys(): it finds who references the target.
     *
     * @param component - StandardReference identifying the component to look up
     * @returns Array of StandardReferences to referrer components (each referrer appears once)
     */
    referencedBy(component: StandardReference): StandardReference[] {
        const mappings = this._components.map((c) => c.reference)
        return this._components.reduce<StandardReference[]>((referrers, comp) => {
            const refs = comp.withMapping(mappings).referencedKeys()
            const mentions = refs.some(({ reference }) => reference.sameKey(component))
            if (mentions && !referrers.some((r) => r.sameKey(comp.reference))) {
                return [...referrers, comp.reference]
            }
            return referrers
        }, [])
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
                    target.invalidateCache()
                    return true
                }
                throw new Error('Invalid value in StandardForm byUniversalId setter')
            }

        })
        return returnProxy as unknown as Record<ComponentUUID, StandardComponent>
    }

    get universalKey(): AssetUUID { return this._universalKey }

    toJSON(options?: StandardToJSONOptions): StandardFormData {
        const mapKeys = this._components.map((component) => component.reference)
        const result: StandardFormData = {
            universalKey: this._universalKey,
            metaData: this.metaData,
            components: this._components.map((component) => (component.withMapping(mapKeys).remapReferences('universal').toJSON(options) as StandardComponentData))
        }
        // Include Asset-level metadata in JSON (following omission-over-empty principle)
        if (this._shortName) {
            result.shortName = this._shortName.toJSON()
        }
        if (this._summary) {
            result.summary = this._summary.toJSON()
        }
        if (this._topLevel) {
            result.topLevel = this._topLevel.toFormat('universal').toJSON()
        }
        if (this.standardizeMode !== 'asset') {
            result.standardizeMode = this.standardizeMode
        }
        return result
    }

    toNDJSON(): StandardNDJSON {
        const mapKeys = this._components.map((component) => component.reference)
        // Sort using SchemaOrganization
        const organization = this._getSchemaOrganization()
        const components: (StandardComponentData & SerializeNDJSONMixin)[] = this._components
            .sort((componentA, componentB) => (organization.sortOrder(componentA.standardKey, componentB.standardKey)))
            .map((component) => (component.withMapping(mapKeys).remapReferences('universal').toJSON()))
        return [
            this.header,
            ...components
        ]
    }

    get schema(): GenericTreeNode<SchemaTag> {
        // Get or create SchemaOrganization and create OrganizationContext
        const organization = this._getSchemaOrganization()
        const organizationContext = createOrganizationContext(organization)

        const remapped = this._clone()
        const mapKeys = remapped._components.map((component) => component.reference)
        remapped._components = remapped._components.map((component) => (component.withMapping(mapKeys)))

        // Create lookupWrapper AFTER remapping so it uses mapped components
        const lookupWrapper = (key: string | StandardKey): StandardComponent | undefined => {
            if (typeof key === 'string') {
                // String is assumed to be ComponentUUID (part of StandardKeyData)
                return remapped._lookup(key as ComponentUUID)
            }
            return remapped._lookup(key.toJSON())
        }

        // Get asset-level children from organization and ensure ref={0}
        const assetLevelChildren = organizationContext.getChildrenOfParent(remapped._universalKey)
        const assetLevelChildrenWithRef0 = assetLevelChildren.map(ref => ref.withRef(0))
        const assetLevelChildrenList = new ReferenceList(assetLevelChildrenWithRef0)

        // Merge with existing _topLevel to preserve any non-ref={0} references
        // cleanEmptyReferences: false ensures ref={0} entries are preserved when merging
        const topLevelToRender = remapped._topLevel
            ? remapped._topLevel.merge(assetLevelChildrenList, { cleanEmptyReferences: false }) ?? assetLevelChildrenList
            : assetLevelChildrenList

        // Get a placeholder key for options (renderReference will override it with the reference's key)
        const placeholderKey = (topLevelToRender.payload?.[0]?.standardKey) ?? new StandardKey({ tag: 'Room', key: 'Placeholder', universalKey: undefined })
        
        const children = (topLevelToRender.payload ?? [])
            .sort((referenceA, referenceB) => (referenceSortOrder(referenceA, referenceB)))
            .map(renderReference({ 
                lookup: lookupWrapper, 
                options: { 
                    key: placeholderKey, 
                    parent: undefined, 
                    organization: organizationContext 
                } 
            }))
            .filter(excludeUndefined)
            .flat(1)

        return {
            data: { tag: 'Asset', uuid: this._universalKey, Story: undefined },
            children: [
                ...[this._shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema())).flat(1),
                ...(this._summary?.nestedSchema({ tag: 'Summary', mappings: mapKeys }) ?? []),
                ...children
            ]
        }
    }

    _clone(): StandardForm {
        const returnValue = new StandardForm(this.universalKey, { standardizeMode: this.standardizeMode })
        returnValue.semanticMode = this.semanticMode
        returnValue._metaData = [...this._metaData]
        returnValue._shortName = this._shortName
        returnValue._summary = this._summary
        returnValue._topLevel = this._topLevel ? this._topLevel.clone() : undefined
        returnValue._components = this._components.map((component) => (component.clone()))
        return returnValue
    }

    get _keys(): StandardKey[] {
        return this._components
            .map((component) => (component.standardKey))
    }

    /**
     * All components in the asset.
     * Prefer this over Object.values(byId) or Object.values(byUniversalId) when iterating;
     * those proxies only surface components with key/universalKey defined respectively.
     * Read-only — do not mutate the returned array.
     */
    get components(): readonly StandardComponent[] {
        return this._components
    }

    invalidateCache(): void {
        this._keyLookupCache = undefined
        this._schemaOrganizationCache = undefined
    }

    _lookup(keyData: StandardKeyData): StandardComponent | undefined {
        if (!this._keyLookupCache) {
            this._keyLookupCache = new KeyLookup(this._components)
        }
        const result = this._keyLookupCache.lookup(new StandardKey(keyData))
        return result.component
    }

    assureComponents(references: ReferenceList): StandardForm {
        const returnValue = this._clone()
        const newComponents = references.payload.reduce<StandardComponent[]>((previous, reference) => {
            const existing = returnValue._lookup(reference.standardKey.toJSON())
            if (!existing) {
                const tag = reference.tag
                const key = reference.key
                const universalKey = reference.universalKey
                const defaultData = defaultComponentFromTag(tag, key, universalKey)
                const { component } = standardComponentFactory(defaultData, { standardizeMode: this.standardizeMode })
                if (component) {
                    return [...previous, component]
                }
            }
            return previous
        }, [])
        returnValue._components = [...returnValue._components, ...newComponents]
        returnValue.invalidateCache()
        return returnValue
    }

    /**
     * Returns a clone of this form with components replaced by the given array.
     * Use when you have a filtered/mapped list of component instances (e.g. after trimming Rooms).
     */
    withComponents(components: StandardComponent[]): StandardForm {
        const returnValue = this._clone()
        returnValue._components = components
        returnValue.invalidateCache()
        return returnValue
    }

    _getSchemaOrganization(): SchemaOrganization {
        if (!this._schemaOrganizationCache) {
            // Ensure _keyLookupCache is instantiated
            if (!this._keyLookupCache) {
                this._keyLookupCache = new KeyLookup(this._components)
            }
            this._schemaOrganizationCache = new SchemaOrganization({
                components: this._components,
                assetUUID: this._universalKey,
                topLevel: this._topLevel,
                keyLookup: this._keyLookupCache
            })
        }
        return this._schemaOrganizationCache
    }

    /**
     * Validates asset-wide patterns and throws errors if invalid patterns are detected.
     * Currently validates StandardExplicitParent relationships:
     * - Parent references exist in the asset
     * - No circular parent relationships (validated via SchemaOrganization constructor)
     */
    validate(): void {
        // Trigger SchemaOrganization creation to validate circular parent relationships
        // This will throw if cycles are detected
        this._getSchemaOrganization()
        
        // Validate other explicit parent rules (parent exists, parent type validity)
        this._validateExplicitParents()
    }

    private _validateExplicitParents(): void {
        for (const component of this._components) {
            if (!component.explicitParent) {
                continue
            }

            // Get the actual parent value from explicitParent
            const parentKey = component.explicitParent.standardKey
            if (parentKey === undefined) {
                // Remove state - no explicit parent to validate
                continue
            }

            // Validate parent exists
            this._validateParentExists(component, parentKey)

            // Note: Circular parentage is validated in SchemaOrganization constructor
            // (called before validate() during StandardForm construction)
        }
    }

    /**
     * Detects if a StandardForm contains any Key changes (Replace or Remove operations).
     * Used to determine if pre-merge remapping is needed.
     */
    private _hasKeyChanges(standardForm: StandardForm): boolean {
        return standardForm._components.some(component => {
            if (!component._key) return false
            const payload = (component._key as any).payload
            if (!payload) return false
            // Check if _key.payload is a ReplaceClass or RemoveClass
            return payload instanceof StandardExplicitKeyReplaceClass || 
                   payload instanceof StandardExplicitKeyRemoveClass
        })
    }

    /**
     * Validates that all components with Key changes (Replace or Remove) have universalKey set.
     * Throws an error if any component lacks universalKey, as it's required for stable reference anchoring.
     */
    private _validateKeyChanges(standardForm: StandardForm): void {
        for (const component of standardForm._components) {
            if (!component._key) continue
            const payload = (component._key as any).payload
            if (!payload) continue
            
            const isKeyChange = payload instanceof StandardExplicitKeyReplaceClass || 
                               payload instanceof StandardExplicitKeyRemoveClass
            
            if (isKeyChange && !component.universalKey) {
                const operation = payload instanceof StandardExplicitKeyReplaceClass ? 'rename' : 'remove'
                throw new Error(
                    `Cannot ${operation} key for component without universalKey. ` +
                    `Component: ${component.tag}${component.key ? ` key=${component.key}` : ''}`
                )
            }
        }
    }

    private _validateParentExists(component: StandardComponent, parentKey: StandardKey | 'ASSET'): void {
        if (parentKey === 'ASSET') {
            // ASSET sentinel is always valid (means top-level)
            return
        }

        const parentComponent = this._lookup(parentKey.toJSON())
        if (!parentComponent) {
            const componentIdentifier = component.key || component.universalKey || 'unknown'
            throw new Error(`Component ${componentIdentifier} (${component.tag}) has explicitParent referencing non-existent component: ${parentKey.key || parentKey.universalKey || 'unknown'}`)
        }
    }

    //
    // StandardForm merge method accounts for component-level edits and merges all contents in place
    //
    merge(incoming: StandardForm): StandardForm {
        const hasKeyChanges = this._hasKeyChanges(this) || this._hasKeyChanges(incoming)
        
        if (hasKeyChanges) {
            // Validate both forms - components with Key changes must have universalKey
            this._validateKeyChanges(this)
            this._validateKeyChanges(incoming)
            
            // Remap both to universal format before merging
            // This ensures references use stable universalKey instead of local keys
            const thisMappings = this._components.map(c => c.reference)
            const incomingMappings = incoming._components.map(c => c.reference)
            
            const remappedThis = this._clone()
            remappedThis._components = remappedThis._components.map(c => 
                c.withMapping(thisMappings).remapReferences('universal')
            )
            remappedThis._topLevel = remappedThis._topLevel?.toFormat('universal')
            
            const remappedIncoming = incoming._clone()
            remappedIncoming._components = remappedIncoming._components.map(c => 
                c.withMapping(incomingMappings).remapReferences('universal')
            )
            remappedIncoming._topLevel = remappedIncoming._topLevel?.toFormat('universal')
            
            // Merge the remapped forms
            return remappedThis._mergeInternal(remappedIncoming)
        }
        
        // Normal merge path (no key changes)
        return this._mergeInternal(incoming)
    }

    /**
     * Internal merge implementation that performs the actual merge operation.
     * Separated from public merge() to allow pre-processing (remapping) when needed.
     */
    private _mergeInternal(incoming: StandardForm): StandardForm {
        const mergedUniversalKeyMappings = mergeUniversalKeyMappings([...this._keys, ...incoming._keys])
        const returnValue = this._clone()
        returnValue._components = [...returnValue._components, ...incoming._clone()._components].reduce(mergeToComponentList(mergedUniversalKeyMappings), [])

        const combinedMetaData = new SchemaTagTree([...this._metaData, ...incoming._metaData])
        returnValue._metaData = applyEdits(combinedMetaData.tree)

        // Merge Asset-level metadata
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        returnValue._summary = (this._summary && incoming._summary) ? this._summary.merge(incoming._summary) : this._summary ?? incoming._summary

        // Merge topLevel references - ReferenceList.merge will handle eliminating ref={0} outcomes
        returnValue._topLevel = (this._topLevel && incoming._topLevel) ? this._topLevel.merge(incoming._topLevel) : this._topLevel ?? incoming._topLevel

        // Remove components that have had all references removed AND are empty
        // Components with no references but with content are valid (top-level inline edit pattern)
        const organization = returnValue._getSchemaOrganization()

        const priorComponentsWithNoReferences = this._components
            .filter((component) => (!organization.isReferenced(component.standardKey)))

        // Only remove components that are both unreferenced AND empty
        // Components with content but no references are kept (valid for top-level inline edits)
        returnValue._components = returnValue._components.filter((component) => {
            const wasUnreferenced = priorComponentsWithNoReferences.some((checkComponent) => (checkComponent.standardKey.equals(component.standardKey)))
            if (wasUnreferenced && component.isEmpty()) {
                return false  // Remove: unreferenced and empty
            }
            return true  // Keep: either referenced, or has content (top-level inline edit)
        })

        returnValue.validate()
        return returnValue
    }

    subset(requests: StandardFormSubsetRequest[]): StandardForm {
        const returnValue = this._clone()
        returnValue._metaData = [...this._metaData]
        const mappings = this._components.map((component) => component.reference)
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
        // cascadeRequests performs a breadth-first traversal of the request space to determine the complete
        // list of requests including any created by cascading conditions. Each iteration processes one "hop"
        // in the graph traversal, ensuring we don't repeat work and can process requests in the correct order.
        //
        const cascadeRequests = (initialRequests: StandardFormSubsetRequest[], cascadeCondition: StandardFormSubsetCascadeCondition): StandardFormSubsetRequest[] => {
            // Phase 1: Graph traversal to record visits for this specific condition
            const visits: Array<{ key: StandardKey; nodes: Set<string> }> = []
            
            // Helper function to find or create a visit entry
            const findOrCreateVisit = (key: StandardKey): { key: StandardKey; nodes: Set<string> } => {
                const existing = visits.find(v => 
                    v.key.universalKey === key.universalKey && 
                    v.key.key === key.key && 
                    v.key.tag === key.tag
                )
                if (existing) return existing
                
                const newVisit = { key: key.clone(), nodes: new Set<string>() }
                visits.push(newVisit)
                return newVisit
            }
            
            // Initialize pending visits from this condition's start nodes
            let pendingVisits: Array<{ componentKey: StandardKey, nodeName: string }> = initialRequests
                .filter(request => request.cascadeConditions?.some(c => c === cascadeCondition))
                .flatMap(request => request.keys)
                .flatMap(key => 
                    cascadeCondition.startNodes.map(startNode => ({ componentKey: key, nodeName: startNode }))
                )
            

            
            // Traverse graph until no new visits are generated
            while (pendingVisits.length > 0) {
                const currentVisits = [...pendingVisits]
                pendingVisits = []
                

                
                currentVisits.forEach(({ componentKey, nodeName }) => {
                    // Record this visit
                    const visitEntry = findOrCreateVisit(componentKey)
                    visitEntry.nodes.add(nodeName)
                    
                    // Find the node in this condition's graph
                    const node = cascadeCondition.graph.find(n => n.name === nodeName)
                    if (!node) return
                    
                    // Find connected components through transitions
                    const component = this._lookup(componentKey.toJSON())
                    if (!component) return
                    
                    const referencedKeys = component.withMapping(mappings).referencedKeys()
                    const connectedKeys = referencedKeys
                        .filter(({ referenceType }) => 
                            node.transitions.some(t => t.connectionType === referenceType)
                        )
                        .map(({ reference }) => reference.standardKey)
                    
                    // Add new visits for connected components
                    connectedKeys.forEach(connectedKey => {
                        node.transitions.forEach(transition => {
                            const targetNode = transition.targetNode
                            // Check if this would be a new visit
                            const existingVisit = visits.find(v => 
                                v.key.universalKey === connectedKey.universalKey && 
                                v.key.key === connectedKey.key && 
                                v.key.tag === connectedKey.tag
                            )
                            if (!existingVisit || !existingVisit.nodes.has(targetNode)) {
                                pendingVisits.push({ componentKey: connectedKey, nodeName: targetNode })
                            }
                        })
                    })
                })
            }
            

            
            // Phase 2: Generate requests from visits for this condition
            // Create a request for each component and let mergeIntoRequestList handle priority resolution
            const cascadeRequests = visits.reduce<StandardFormSubsetRequest[]>((requests, { key, nodes }) => {
                // Find the component using the key lookup
                const component = this._lookup(key.toJSON())
                if (!component) {
                    return requests
                }
                
                // Create a request for each node this component visited
                // mergeIntoRequestList will handle priority conflicts automatically
                return Array.from(nodes).reduce<StandardFormSubsetRequest[]>((currentRequests, nodeName) => {
                    const node = cascadeCondition.graph.find(n => n.name === nodeName)
                    if (!node) return currentRequests
                    
                    const cascadeRequest = {
                        requestType: node.requestType,
                        keys: [key]
                    }
                    
                    return mergeIntoRequestList(currentRequests, cascadeRequest)
                }, requests)
            }, [])
            

            
            return cascadeRequests
        }

        // Process each cascade condition separately, then merge results
        const allCascadeRequests = requests
            .flatMap(request => request.cascadeConditions ?? [])
            .flatMap(cascadeCondition => cascadeRequests(requests, cascadeCondition))
        
        // Merge all requests: initial + cascade results
        const allRequests = allCascadeRequests.reduce(mergeIntoRequestList, requests)
        const requestOutput = (request: StandardFormSubsetRequest, component: StandardComponent): StandardComponent[] => {
            if (request.requestType === 'Full') {
                return [component]
            }
            if (request.requestType === 'Stub' || request.requestType === 'ShortName' || request.requestType === 'ExitsAndShortName') {
                const returnValue = component.clone()
                if (returnValue instanceof StandardRoom) {
                    returnValue._payload = new StandardRoomPayload()
                    if ((request.requestType === 'ShortName' || request.requestType === 'ExitsAndShortName') && component instanceof StandardRoom) {
                        returnValue._payload._shortName = component._payload._shortName
                        if (request.requestType === 'ExitsAndShortName') {
                            returnValue._payload._exits = component.exits.clone()
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
                    const component = this._lookup(key.toJSON())
                    if (!component) {
                        return accumulator
                    }
                    return requestOutput(request, component).reduce<StandardComponent[]>((innerAccumulator, output) => (mergeToComponentList(returnValue._keys)(innerAccumulator, output)), accumulator)
                }, previous)
            }, [])
        const filteredTopLevel = returnValue._topLevel?.payload.filter((reference) => (returnValue._components.some((component) => (component.standardKey.equals(reference.standardKey))))) ?? []
        returnValue._topLevel = filteredTopLevel.length > 0 ? new ReferenceList(filteredTopLevel) : undefined

        return returnValue
    }

    /**
     * @deprecated Use explicit `<Key>` tags in edits and process through `merge()` instead.
     * This method is incomplete and does not properly update component references.
     * 
     * To rename a key:
     * 1. Create a component with the new key using `component.withKey(newKey)`
     * 2. Use `diff()` to generate an edit StandardForm with the Key change
     * 3. Merge the edit into your base StandardForm
     * 
     * Components must have `universalKey` set before key changes.
     */
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

    finalize(): StandardForm {
        let returnValue = this._clone()
        const uuidGenerator = new UUIDGenerator()
        const uuidDefaultedComponents = returnValue._components
            .map((component) => {
                if (!component.universalKey) {
                    return component.withUniversalKey(`${component.tag.toUpperCase()}#${uuidGenerator.next()}`)
                }
                return component
            })
        returnValue._components = uuidDefaultedComponents
        
        const mappings = returnValue._components.map((component) => component.reference)
        returnValue._components = returnValue._components.map((component) => (component.withMapping(mappings).remapReferences('universal')))
        return returnValue
    }

    diff(incoming: StandardForm): StandardForm {

        //
        // In order to have a baseline between two StandardForms, we first merge the keys of both forms
        // (to draw associations between local keys and universal keys wherever they exist in either
        // data structure). This importantly simplifies the resulting diff, and makes it more useful.
        //
        const mergedForKeys = [...this._components, ...incoming._components]
            .reduce<StandardReference[]>((previous, component) => {
                const existingIndex = previous.findIndex((key) => (key.sameKey(component.reference)))
                if (existingIndex === -1) {
                    return [...previous, component.reference]
                }
                else {
                    return previous.map((key, index) => {
                        if (index === existingIndex) {
                            return key.merge(component.reference) ?? key
                        }
                        return key
                    })
                }
            }, [])

        //
        // Sort the keys in the merged form to provide an order in which
        // to diff the components in each StandardForm against each other.
        //

        const allKeys = new ReferenceList(
            [...this._components, ...incoming._components]
            .map((component) => (new StandardReference(component.referenceData)))
        ).toFormat('universal').payload.map((reference) => (reference.toJSON()))

        //
        // Next, we need a zippered version of the components in the two forms, with an
        // incoming component (if it exists) and a previous component (if it exists).
        //

        const zipperedComponents = allKeys
            .map((reference: StandardReferenceData) => {
                // Convert StandardReferenceData to StandardKeyData by removing tag and ref if present
                const keyData: StandardKeyData = typeof reference === 'string' 
                    ? reference 
                    : reference.key 
                        ? { key: reference.key, universalKey: reference.universalKey }
                        : reference.universalKey ?? (() => { throw new Error('StandardReferenceData must have either key or universalKey') })()
                return {
                    reference,
                    previous: this._lookup(keyData)?.withMapping(mergedForKeys)?.remapReferences('both'),
                    incoming: incoming._lookup(keyData)?.withMapping(mergedForKeys)?.remapReferences('both')
                }
            })
            .filter(({ previous, incoming }) => (previous || incoming))

        //
        // Now we can diff the components in the two forms against each other, using the
        // zipperedComponents as the basis for the diff.
        //

        let diffedValue = this._clone()
        const topLevelDiff = (this._topLevel ?? new ReferenceList([])).diff(incoming._topLevel ?? new ReferenceList([]))
        diffedValue._topLevel = topLevelDiff
        const diffedComponents: StandardComponent[] = zipperedComponents
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
                    if (previousComponent && previousComponent.invert) {
                        const removedComponent = previousComponent.invert()
                        return [
                            ...previous,
                            removedComponent
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
        // With the removal of StandardRemove and StandardReplace, components are stored as plain components
        // with edits handled at the reference level. The diffed components are already complete.
        //
        diffedValue._components = diffedComponents

        // Collect all referenced keys from the diff: (1) keys referenced inside components, (2) keys at topLevel.
        // This ensures we add default empty components for any key that appears in the diff output but has no
        // content change (e.g. a Feature that only moved between Rooms, or a component added at topLevel).
        const referencedByComponents = diffedComponents.reduce<StandardReference[]>((previous, component) => {
            const componentReferences = component.referencedKeys()
            return componentReferences.reduce<StandardReference[]>((refs, { reference }) => {
                const mergedRef = mergedForKeys.find((key) => key.sameKey(reference))
                const refToAdd = mergedRef ?? reference
                const existingIndex = refs.findIndex((r) => r.sameKey(refToAdd))
                if (existingIndex === -1) {
                    return [...refs, refToAdd]
                }
                return refs
            }, previous)
        }, [])
        const referencedAtTopLevel = (diffedValue._topLevel?.payload ?? []).map((ref) => {
            const mergedRef = mergedForKeys.find((key) => key.sameKey(ref))
            return mergedRef ?? ref
        })
        const referencedKeys = referencedAtTopLevel.reduce<StandardReference[]>((refs, refToAdd) => {
            const existingIndex = refs.findIndex((r) => r.sameKey(refToAdd))
            if (existingIndex === -1) {
                return [...refs, refToAdd]
            }
            return refs
        }, referencedByComponents)
        const referencedComponentsList = new ReferenceList(referencedKeys)
        const diffedValueFinal = diffedValue.assureComponents(referencedComponentsList)

        const combinedMetaData = new SchemaTagTree([...this._metaData, ...incoming._metaData])
        diffedValueFinal._metaData = applyEdits(combinedMetaData.tree)

        // Diff Asset-level metadata
        const shortNameDiff = this._shortName
            ? this._shortName.diff(incoming._shortName)
            : incoming._shortName
        diffedValueFinal._shortName = shortNameDiff?.isEmpty() ? undefined : shortNameDiff
        const summaryDiff = this._summary
            ? this._summary.diff(incoming._summary)
            : incoming._summary
        diffedValueFinal._summary = summaryDiff?.isEmpty() ? undefined : summaryDiff

        diffedValueFinal.validate()
        return diffedValueFinal
    }

    /**
     * Creates a clone of this StandardForm with an updated semantic mode.
     * 
     * @param semanticMode - The new semantic mode to set, or undefined to clear it
     * @returns A new StandardForm instance with the updated semantic mode
     */
    withSemanticMode(semanticMode: StandardFormSemanticMode | undefined): StandardForm {
        const returnValue = this._clone()
        returnValue.semanticMode = semanticMode
        return returnValue
    }

    withStandardizeMode(standardizeMode: WmlStandardizeMode): StandardForm {
        const returnValue = this._clone()
        returnValue.standardizeMode = standardizeMode
        return returnValue
    }

    /**
     * Removes a component from this StandardForm and removes all references to it.
     * Returns a new StandardForm with the component removed (functional pattern, no mutation).
     * 
     * @param reference - The StandardReference identifying the component to remove
     * @param options - Optional configuration object (cascade option deferred for future implementation)
     * @returns A new StandardForm with the component and all its references removed
     */
    removeComponent(reference: StandardReference, options?: { cascade: boolean }): StandardForm {
        // Clone the StandardForm (functional pattern)
        const returnValue = this._clone()
        
        // Find the component to remove
        const componentToRemove = returnValue._lookup(reference.standardKey.toJSON())
        
        // If component not found, return the cloned form unchanged
        if (!componentToRemove) {
            return returnValue
        }
        
        // Collect all components to remove
        const componentsToRemove = [componentToRemove]
        
        // If cascade is enabled, find and add all descendant components
        if (options?.cascade) {
            const organization = returnValue._getSchemaOrganization()
            const descendantKeys = organization.implicitDescendantsOfAncestor(componentToRemove.standardKey)
            // Convert keys to components and add to removal list
            for (const descendantKey of descendantKeys) {
                const descendant = returnValue._lookup(descendantKey.toJSON())
                if (descendant) {
                    componentsToRemove.push(descendant)
                }
            }
        }
        
        // Remove all components from _components
        returnValue._components = returnValue._components.filter(
            (component) => !componentsToRemove.some(removed => removed.standardKey.equals(component.standardKey))
        )
        
        // Remove references to all removed components from remaining components
        const referencesToRemove = componentsToRemove.map(c => c.reference)
        returnValue._components = returnValue._components.map((component) =>
            component.removeReferences(referencesToRemove)
        )
        
        // Remove from _topLevel if present
        if (returnValue._topLevel) {
            const filteredTopLevel = returnValue._topLevel.payload.filter(
                (ref) => !referencesToRemove.some(removedRef => ref.sameKey(removedRef))
            )
            returnValue._topLevel = filteredTopLevel.length > 0
                ? new ReferenceList(filteredTopLevel)
                : undefined
        }
        
        // Invalidate caches
        returnValue.invalidateCache()
        
        // Validate the result
        returnValue.validate()
        
        return returnValue
    }

}

export type {
    StandardFormConstructionOptions,
    StandardizeFromSchemaContext,
    WmlStandardizeMode,
} from './wmlStandardizeMode'
export {
    DEFAULT_WML_STANDARDIZE_MODE,
    isWmlStandardizeMode,
    resolveStandardizeFromSchemaContext,
    resolveStandardizeMode,
} from './wmlStandardizeMode'