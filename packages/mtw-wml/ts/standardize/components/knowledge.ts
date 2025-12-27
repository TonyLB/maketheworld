import { excludeUndefined } from "../../lib/lists"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardDiffOptions } from "./baseClasses"
import { StandardKnowledgeData } from "./dataTypes/knowledge"
import { childReferenceFactory, ReferenceFormat } from "./utils/references"
import { StandardToJSONOptions } from "./baseClasses"
import StandardReference, { ReferenceList, StandardKey } from "./reference"
import { StandardReferenceData } from "./dataTypes/reference"
import { isSchemaExample } from "@tonylb/mtw-base/ts/schema/example"
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaKnowledge } from "@tonylb/mtw-base/ts/schema/components"
import { deepEqual } from "../../lib/objects"
import { renderReference } from "./utils/schema"
import { HasShortName } from "./abstract"
import { StandardLiteral } from "../literal"
import SchemaTagTree from "../../tagTree/schema"
import { StandardExplicitParent } from "../explicit"

export class StandardKnowledgePayload implements HasShortName, ComponentConstructorMethods<StandardKnowledgeData> {
    _shortName?: StandardLiteral;
    _examples: ReferenceList;
    tag = 'Knowledge' as const

    constructor(previous?: StandardKnowledgePayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._examples = previous._examples
        }
        else {
            this._examples = new ReferenceList([])
        }
    }

    fromJSON(props: StandardKnowledgeData) {
        const { shortName } = props
        this._shortName = shortName ? new StandardLiteral(shortName) : undefined
        this._examples = new ReferenceList(props.examples?.map((reference) => (new StandardReference(reference))) ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaKnowledge)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const shortNameItem = tagTree
                .filter({ match: 'ShortName' })
                .prune({ not: { or: [{ match: 'String' }, { match: 'Remove' }, { match: 'Replace' }, { match: 'ReplaceMatch' }, { match: 'ReplacePayload' }] } })
                .tree
            this._shortName = shortNameItem.length ? new StandardLiteral(shortNameItem) : undefined
            this._examples = new ReferenceList(node.children.filter(wrappedNodeTypeGuard(isSchemaExample)).map(childReferenceFactory))
            return
        }
        throw new Error('Schema mismatch in StandardKnowledge constructor')
    }

    get shortName() { return this._shortName }
    get examples() { return this._examples }

    toJSON(options: StandardToJSONOptions): Omit<StandardKnowledgeData, 'key' | 'universalKey'> {
        return {
            tag: 'Knowledge',
            shortName: this?.shortName?.toJSON(),
            ...(this.examples.payload.length ? { examples: this.examples.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Knowledge', key, uuid: universalKey },
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
            data: { tag: 'Knowledge', key: key.key ?? '', uuid: key.universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema({ tag: 'ShortName' }))).flat(1),
                ...examplesToRender.payload.map(renderReference({ lookup, options })).filter(excludeUndefined),
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardKnowledgePayload()
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        returnValue._examples = this.examples.merge(incoming.examples) ?? new ReferenceList([])
        return returnValue as this
    }

    subset(): this {
        return new StandardKnowledgePayload() as this
    }


    referencedKeys(): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...this.examples.payload.map((reference) => ({ referenceType: 'Direct' as const, key: reference.standardKey }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardKnowledgePayload(this)
        return returnValue as this
    }

    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardKnowledgePayload(this)
        returnValue._examples = returnValue._examples.lookup(props.mappings).toFormat(props.mapTo)
        return returnValue as this
    }
    
    withChild(child: StandardReference): this {
        const returnValue = new StandardKnowledgePayload(this)
        if (child.tag === 'Example') {
            returnValue._examples = returnValue._examples.assureItem(child)
        }
        else {
            throw new Error(`Invalid child type ${child.tag} for StandardKnowledge`)
        }
        return returnValue as this
    }

    isEmpty(): boolean {
        // A knowledge is empty if it has no shortName and no examples
        const hasShortName = Boolean(this._shortName)
        const hasExamples = this._examples.payload.length > 0
        return !(hasShortName || hasExamples)
    }

    invert(): this {
        const returnValue = new StandardKnowledgePayload()
        // Invert shortName if it exists (StandardLiteral has invert() from v2StandardEditableFactory)
        returnValue._shortName = this._shortName ? this._shortName.invert() as StandardLiteral : undefined
        // Invert examples ReferenceList
        returnValue._examples = this._examples.invert()
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): this {
        const returnValue = new StandardKnowledgePayload(this)
        
        // Filter and map children by type, creating references with ref={0}
        const exampleReferences = new ReferenceList(
            children
                .filter(child => child.tag === 'Example')
                .map(child => child.withRef(0))
        )
        
        // Merge with existing bucket, preserving ref={0} references
        // cleanEmptyReferences: false ensures ref={0} entries are preserved when merging
        returnValue._examples = this._examples.merge(exampleReferences, { cleanEmptyReferences: false }) ?? this._examples
        
        return returnValue as this
    }
}

export class StandardKnowledge extends componentClassFactory(StandardKnowledgePayload, 'StandardKnowledge') {
    get shortName() { return this._payload.shortName }
    get examples() { return this._payload.examples }

    override clone(): StandardKnowledge {
        const returnValue = new StandardKnowledge(this)
        returnValue._payload = new StandardKnowledgePayload(this._payload)
        return returnValue
    }

    override diff(incoming: StandardComponent, options?: StandardDiffOptions): StandardComponent | undefined {
        if (!(incoming instanceof StandardKnowledge)) {
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
        base._payload = new StandardKnowledgePayload()
        base._payload._shortName = this._payload._shortName
            ? this._payload._shortName.diff(incoming._payload._shortName)
            : incoming._payload._shortName
        base._payload._examples = examplesDiff
        // Apply explicitParent diff if it exists (pass pre-computed diff to avoid recalculation)
        this._applyExplicitParentDiffToComponent(base, incoming, explicitParentDiff)
        return base
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardKnowledge)) {
            return false
        }
        return !(this.examples.diff(incoming.examples)?.payload?.length) &&
            deepEqual(this.shortName?.toJSON(), incoming.shortName?.toJSON())
    }
    
    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardKnowledge(super.merge(incoming) as StandardKnowledge)
    }

    override withKey(key: string): StandardComponent {
        return new StandardKnowledge(super.withKey(key) as StandardKnowledge)
    }
    
    override withUniversalKey(key: ComponentUUID): StandardComponent {
        return new StandardKnowledge(super.withUniversalKey(key) as StandardKnowledge)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardKnowledge(super.withFileName(key) as StandardKnowledge)
    }

    override withMapping(mapping: StandardReference[]): StandardComponent {
        return new StandardKnowledge(super.withMapping(mapping) as StandardKnowledge)
    }

    override withImport(fromAsset: AssetUUID): StandardComponent {
        return new StandardKnowledge(super.withImport(fromAsset) as StandardKnowledge)
    }

    override withOrigin(origin: AssetUUID[]): StandardComponent {
        return new StandardKnowledge(super.withOrigin(origin) as StandardKnowledge)
    }

    override withChild(child: StandardReference): StandardComponent {
        return new StandardKnowledge(super.withChild(child) as StandardKnowledge)
    }


    override withExplicitParent(explicitParent: StandardExplicitParent | undefined): StandardComponent {
        return new StandardKnowledge(super.withExplicitParent(explicitParent) as StandardKnowledge)
    }

    override invert(): StandardKnowledge {
        return new StandardKnowledge(super.invert() as StandardKnowledge)
    }

}

export default StandardKnowledge
