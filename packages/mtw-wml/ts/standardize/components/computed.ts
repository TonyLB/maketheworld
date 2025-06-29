import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent } from "./baseClasses"
import { StandardComputedData } from "./dataTypes/computed"
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isSchemaComputed } from "@tonylb/mtw-base/ts/schema/computation";
import { StandardKey } from "./reference";

export class StandardComputedPayload implements ComponentConstructorMethods<StandardComputedData> {
    _src?: string;
    _dependencies?: string[];
    tag = 'Computed' as const;

    constructor(previous?: StandardComputedPayload) {
        if (previous) {
            this._src = `${previous.src}`
            this._dependencies = previous.dependencies ? [...previous.dependencies] : undefined
        }
    }

    fromJSON(props: StandardComputedData) {
        this._src = props.src
        this._dependencies = props.dependencies
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaComputed)(node)) {
            this._src = node.data.src
            return
        }
        throw new Error('Schema mismatch in StandardComputed constructor')
    }

    get src() { return this._src ?? '' }
    get dependencies() { return this._dependencies }

    toJSON(): Omit<StandardComputedData, 'key' | 'universalKey'> {
        return {
            tag: 'Computed',
            src: this.src,
            dependencies: this.dependencies
        }
    }

    schema(key: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Computed', key, uuid: universalKey, src: this.src },
            children: []
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardComputedPayload()
        returnValue._src = incoming.src ?? this.src
        return returnValue as this
    }

    subset(): this {
        return new StandardComputedPayload() as this
    }

    referencedKeys(): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency"; }[] {
        return (this.dependencies ?? []).map((key) => ({ key: new StandardKey(key), referenceType: 'Dependency' }))
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
    }
}

export class StandardComputed extends componentClassFactory(StandardComputedPayload, 'StandardComputed') {
    get src() { return this._payload.src }
    get dependencies() { return this._payload.dependencies }

    override clone(): StandardComputed {
        const returnValue = new StandardComputed(this)
        returnValue._payload = new StandardComputedPayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardComputed(super.merge(incoming) as StandardComputed)
    }

    override withKey(key: string): StandardComponent {
        return new StandardComputed(super.withKey(key) as StandardComputed)
    }

    override withUniversalKey(key: ComponentUUID): StandardComponent {
        return new StandardComputed(super.withUniversalKey(key) as StandardComputed)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardComputed(super.withFileName(key) as StandardComputed)
    }

    override withMapping(mapping: StandardKey[]): StandardComponent {
        return new StandardComputed(super.withMapping(mapping) as StandardComputed)
    }

}

export default StandardComputed
