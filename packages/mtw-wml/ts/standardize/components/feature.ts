import { excludeUndefined } from "../../lib/lists"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardDiffOptions } from "./baseClasses"
import { StandardFeatureData } from "./dataTypes/feature"
import { childReferenceFactory, ReferenceFormat } from "./utils/references"
import { StandardToJSONOptions } from "./baseClasses"
import StandardReference, { ReferenceList, StandardKey } from "./reference"
import { StandardReferenceData } from "./dataTypes/reference"
import { isSchemaExample } from "@tonylb/mtw-base/ts/schema/example"
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaFeature } from "@tonylb/mtw-base/ts/schema/components"
import { deepEqual } from "../../lib/objects"
import { renderReference } from "./utils/schema"
import { HasShortName } from "./abstract"
import { StandardLiteral } from "../literal"
import SchemaTagTree from "../../tagTree/schema"
import { StandardExplicitParent } from "../explicit"

export class StandardFeaturePayload implements HasShortName, ComponentConstructorMethods<StandardFeatureData> {
    _shortName?: StandardLiteral;
    _examples: ReferenceList;
    tag = 'Feature' as const

    constructor(previous?: StandardFeaturePayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._examples = previous._examples
        }
        else {
            this._examples = new ReferenceList([])
        }
    }

    fromJSON(props: StandardFeatureData) {
        const { shortName } = props
        this._shortName = shortName ? new StandardLiteral(shortName) : undefined
        this._examples = new ReferenceList(props.examples?.map((reference) => (new StandardReference(reference))) ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaFeature)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const shortNameItem = tagTree
                .filter({ match: 'ShortName' })
                .prune({ not: { or: [{ match: 'String' }, { match: 'Remove' }, { match: 'Replace' }, { match: 'ReplaceMatch' }, { match: 'ReplacePayload' }] } })
                .tree
            this._shortName = shortNameItem.length ? new StandardLiteral(shortNameItem) : undefined
            this._examples = new ReferenceList(node.children.filter(wrappedNodeTypeGuard(isSchemaExample)).map(childReferenceFactory))
            return
        }
        throw new Error('Schema mismatch in StandardFeature constructor')
    }

    get shortName() { return this._shortName }
    get examples() { return this._examples }

    toJSON(options?: StandardToJSONOptions): Omit<StandardFeatureData, 'key' | 'universalKey'> {
        return {
            tag: 'Feature',
            shortName: this?.shortName?.toJSON(),
            ...(this.examples.payload.length ? { examples: this.examples.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Feature', key, uuid: universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema({ tag: 'ShortName' }))).flat(1),
                ...this.examples.schema,
            ]
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options
        
        // If organization is available, use assured references from organization
        // Otherwise, fall back to stored reference lists
        let examplesToRender = this.examples
        
        if (options.organization) {
            // Get children from organization and assure references
            const children = options.organization.getChildrenOfParent(key) ?? []
            const assured = this.assureReferences(children)
            examplesToRender = assured.examples
        }
        
        return {
            data: { tag: 'Feature', key: key.key ?? '', uuid: key.universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema({ tag: 'ShortName' }))).flat(1),
                ...examplesToRender.payload.map(renderReference({ lookup, options })).filter(excludeUndefined),
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardFeaturePayload()
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        returnValue._examples = this.examples.merge(incoming.examples) ?? new ReferenceList([])
        return returnValue as this
    }

    subset(): this {
        return new StandardFeaturePayload() as this
    }

    referencedKeys(): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...this.examples.payload.map((reference) => ({ referenceType: 'Direct' as const, key: reference._payload.plain.standardKey }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardFeaturePayload(this)
        return returnValue as this
    }

    remapReferences(props: { mappings: StandardKey[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardFeaturePayload(this)
        returnValue._examples = returnValue._examples.lookup(props.mappings).toFormat(props.mapTo)
        return returnValue as this
    }

    withChild(child: StandardReference): this {
        const returnValue = new StandardFeaturePayload(this)
        if (child._payload.plain.tag === 'Example') {
            returnValue._examples = returnValue._examples.assureItem(child)
        }
        else {
            throw new Error(`Invalid child type ${child._payload.tag} for StandardFeature`)
        }
        return returnValue as this
    }

    isEmpty(): boolean {
        // A feature is empty if it has no shortName and no examples
        const hasShortName = Boolean(this._shortName)
        const hasExamples = this._examples.payload.length > 0
        return !(hasShortName || hasExamples)
    }

    invert(): this {
        const returnValue = new StandardFeaturePayload()
        // Invert shortName if it exists (StandardLiteral has invert() from v2StandardEditableFactory)
        returnValue._shortName = this._shortName ? this._shortName.invert() as StandardLiteral : undefined
        // Invert examples ReferenceList
        returnValue._examples = this._examples.invert()
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): this {
        const returnValue = new StandardFeaturePayload(this)
        
        // Filter and map children by type, creating references with ref={0}
        const exampleReferences = new ReferenceList(
            children
                .filter(child => child._payload.plain.tag === 'Example')
                .map(child => child.withRef(0))
        )
        
        // Merge with existing bucket, preserving ref={0} references
        // cleanEmptyReferences: false ensures ref={0} entries are preserved when merging
        returnValue._examples = this._examples.merge(exampleReferences, { cleanEmptyReferences: false }) ?? this._examples
        
        return returnValue as this
    }
}

export class StandardFeature extends componentClassFactory(StandardFeaturePayload, 'StandardFeature') {
    get shortName() { return this._payload.shortName }
    get examples() { return this._payload.examples }

    override clone(): StandardFeature {
        const returnValue = new StandardFeature(this)
        returnValue._payload = new StandardFeaturePayload(this._payload)
        return returnValue
    }

    override diff(incoming: StandardComponent, options?: StandardDiffOptions): StandardComponent | undefined {
        if (!(incoming instanceof StandardFeature)) {
            throw new Error('Mismatched component types in diff')
        }
        // Check explicitParent differences separately
        const explicitParentDiff = this.explicitParent?.diff(incoming.explicitParent)
        const hasExplicitParentDiff = explicitParentDiff !== undefined
        const examplesDiff = this.examples.diff(incoming.examples) ?? new ReferenceList([])
        if (deepEqual(this.toJSON(), incoming.toJSON()) && !examplesDiff.payload.length && !hasExplicitParentDiff) {
            return undefined
        }
        const base = this.clone()
        base._payload = new StandardFeaturePayload()
        base._payload._shortName = this._payload._shortName
            ? this._payload._shortName.diff(incoming._payload._shortName)
            : incoming._payload._shortName
        base._payload._examples = examplesDiff
        // Apply explicitParent diff if it exists (pass pre-computed diff to avoid recalculation)
        this._applyExplicitParentDiffToComponent(base, incoming, explicitParentDiff)
        return base
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardFeature)) {
            return false
        }
        return !(this.examples.diff(incoming.examples)?.payload?.length) &&
            deepEqual(this.shortName?.toJSON(), incoming.shortName?.toJSON())
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardFeature(super.merge(incoming) as StandardFeature)
    }

    override withKey(key: string): StandardComponent {
        return new StandardFeature(super.withKey(key) as StandardFeature)
    }
    
    override withUniversalKey(key: ComponentUUID): StandardComponent {
        return new StandardFeature(super.withUniversalKey(key) as StandardFeature)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardFeature(super.withFileName(key) as StandardFeature)
    }

    override withMapping(mapping: StandardKey[]): StandardComponent {
        return new StandardFeature(super.withMapping(mapping) as StandardFeature)
    }

    override withImport(fromAsset: AssetUUID): StandardComponent {
        return new StandardFeature(super.withImport(fromAsset) as StandardFeature)
    }

    override withOrigin(origin: AssetUUID[]): StandardComponent {
        return new StandardFeature(super.withOrigin(origin) as StandardFeature)
    }
    
    override withChild(child: StandardReference): StandardComponent {
        return new StandardFeature(super.withChild(child) as StandardFeature)
    }


    override withExplicitParent(explicitParent: StandardExplicitParent | undefined): StandardComponent {
        return new StandardFeature(super.withExplicitParent(explicitParent) as StandardFeature)
    }

    override invert(): StandardFeature {
        return new StandardFeature(super.invert() as StandardFeature)
    }

}

export default StandardFeature
