import { StandardEditableData } from '@tonylb/mtw-base/ts/editable'
import { StandardEditablePayload, standardEditableFactory, StandardEditableFactoryProps, StandardEditableWrapper, StandardEditablePayloadDelta } from './index'
import { MergeConflictError } from '@tonylb/mtw-base/ts/standardize'
import { GenericTreeNode, treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import { isSchemaTreeNode } from '../../standardize/components/utils'
import { isSchemaString } from '@tonylb/mtw-base/ts/schema/renderTree'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'

interface TestData {
    id: number
    name: string
}

const testTypeguard = (value: any): value is TestData => {
    return typeof value === 'object' && value !== null && typeof value.id === 'number' && typeof value.name === 'string'
}

class testClass implements StandardEditablePayload<TestData> {
    data: TestData
    schema = []
    constructor(data: TestData) {
        this.data = data as TestData
    }
    clone() {
        return new testClass(this.data)
    }
    toJSON() {
        return { ...this.data }
    }
    add(base, incoming) {
        return { id: base.id, name: `${base.name}${incoming.name}` }
    }
    subtract(base, incoming, options: { fromStart?: boolean } = {}) {
        console.log(`subtracting ${incoming.name} from ${base.name}`)
        if (base.name === incoming.name) {
            console.log(`returning empty object`)
            return {}
        }
        else {
            if (base.name.length > incoming.name.length) {
                if (options.fromStart && base.name.startsWith(incoming.name)) {
                    return { id: base.id, name: base.name.slice(incoming.name.length) }
                }
                else if (base.name.endsWith(incoming.name)) {
                    return { add: { id: base.id, name: base.name.slice(0, base.name.length - incoming.name.length) } }
                }
            }
            else {
                if (options.fromStart && incoming.name.startsWith(base.name)) {
                    return { add: { id: base.id, name: incoming.name.slice(base.name.length) } }
                }
                else if (incoming.name.endsWith(base.name)) {
                    return { remove: { id: base.id, name: incoming.name.slice(0, (incoming.name.length - base.name.length)) } }
                }
            }
        }
        console.log(`throwing merge conflict error`)
        throw new MergeConflictError()
    }
    diff(base, incoming) {
        let firstDifferingIndex = 0
        while(firstDifferingIndex < base.name.length && firstDifferingIndex < incoming.name.length && base.name[firstDifferingIndex] === incoming.name[firstDifferingIndex]) {
            firstDifferingIndex++
        }
        if (base.name === incoming.name) {
            return {}
        }
        if (firstDifferingIndex === base.name.length) {
            return { add: { id: base.id, name: incoming.name.slice(firstDifferingIndex) } }
        }
        if (firstDifferingIndex === incoming.name.length) {
            return { remove: { id: base.id, name: base.name.slice(firstDifferingIndex) } }
        }
        return { add: { id: base.id, name: incoming.name.slice(firstDifferingIndex) }, remove: { id: base.id, name: base.name.slice(firstDifferingIndex) } }
    }
}

const testPayloadFactory = (props: StandardEditableData<TestData> | GenericTreeNode<SchemaTag>): StandardEditablePayload<TestData> | undefined => {
    if (testTypeguard(props)) {
        return new testClass(props)
    }
    console.log(`props: ${JSON.stringify(props)}`)
    if (isSchemaTreeNode(props) && treeNodeTypeguard(isSchemaString)(props)) {
        console.log(`Creating testClass from schema tag: ${props.data.value}`)
        return new testClass({ id: 0, name: props.data.value })
    }
    return undefined
}

const factoryProps: StandardEditableFactoryProps<TestData> = {
    typeguard: testTypeguard,
    payloadFactory: testPayloadFactory,
    payload: testClass
}

const { factory, typeguard } = standardEditableFactory(factoryProps)

describe('standardEditableFactory', () => {
    it('should create a valid TestEditable object when given valid data', () => {
        const data: TestData = { id: 1, name: 'Test' }
        const result = factory(data)
        expect(result?.toJSON()).toEqual(data)
    })

    it('should create a valid TestEditable object when given schema tag', () => {
        const data: GenericTreeNode<SchemaTag> = { data: { tag: 'String', value: 'Test' }, children: [] }
        const result = factory(data)
        expect(result?.toJSON()).toEqual({ id: 0, name: 'Test' })
    })

    it('should return undefined when given invalid data', () => {
        const data = { id: 'invalid', name: 'Test' }
        const result = factory(data as any)
        expect(result).toBeUndefined()
    })

    it('should correctly identify valid StandardEditableData', () => {
        const data: TestData = { id: 1, name: 'Test' }
        expect(typeguard(data)).toBe(true)
    })

    it('should correctly identify invalid StandardEditableData', () => {
        const data = { id: 'invalid', name: 'Test' }
        expect(typeguard(data)).toBe(false)
    })

    it('should correctly identify Remove tag with valid match', () => {
        const data = { tag: 'Remove', match: { id: 1, name: 'Test' } }
        expect(typeguard(data)).toBe(true)
    })

    it('should correctly identify Replace tag with valid match and payload', () => {
        const data = { tag: 'Replace', match: { id: 1, name: 'Test' }, payload: { id: 2, name: 'Test2' } }
        expect(typeguard(data)).toBe(true)
    })

    it('should return remove class when given valid remove data', () => {
        const data = { tag: 'Remove' as const, match: { id: 1, name: 'Test' } }
        const result = factory(data)
        expect(result?.toJSON()).toEqual(data)
    })

    it('should return remove class when given valid remove schema tag', () => {
        const data = { data: { tag: 'Remove' }, children: [{ data: { tag: 'String', value: 'Test' }, children: [] }] }
        const result = factory(data)
        expect(result?.toJSON()).toEqual({ tag: 'Remove', match: { id: 0, name: 'Test'} })
    })

    it('should return replace class when given valid replace data', () => {
        const data = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'TestTwo' } }
        const result = factory(data)
        expect(result?.toJSON()).toEqual(data)
    })

    it('should return replace class when given valid replace schema tag', () => {
        const data = {
            data: { tag: 'Replace' },
            children: [
                { data: { tag: 'ReplaceMatch' }, children: [{ data: { tag: 'String', value: 'Test' }, children: [] }] },
                { data: { tag: 'ReplacePayload' }, children: [{ data: { tag: 'String', value: 'TestTwo' }, children: [] }] }
            ]
        }
        const result = factory(data)
        expect(result?.toJSON()).toEqual({ tag: 'Replace', match: { id: 0, name: 'Test'}, payload: { id: 0, name: 'TestTwo' } })
    })

    describe('merge', () => {
        it('should correctly merge two content tags', () => {
            const data1 = { id: 1, name: 'Test' }
            const data2 = { id: 2, name: 'Test2' }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            expect(editable2).toBeDefined()
            if (editable2) {
                const merged = editable1?.merge(editable2)
                expect(merged?.toJSON()).toEqual({ id: 1, name: 'TestTest2' })
            }
        })
    
        it('should correctly merge a remove into a matching content tag', () => {
            const data1 = { id: 1, name: 'Test' }
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'Test' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toBeUndefined()
        })
    
        it('should correctly merge remove into a longer content tag', () => {
            const data1 = { id: 1, name: 'TestOne' }
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'One' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ id: 1, name: 'Test' })
        })

        it('should correctly merge remove into a shorter content tag', () => {
            const data1 = { id: 1, name: 'One' }
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'TestOne' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Remove', match: { id: 1, name: 'Test' } })
        })

        it('should correctly merge remove into a remove tag', () => {
            const data1 = { tag: 'Remove' as const, match: { id: 1, name: 'One' } }
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'Test' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Remove', match: { id: 1, name: 'TestOne' } })
        })

        it('should correctly merge a replace into a matching content tag', () => {
            const data1 = { id: 1, name: 'Test' }
            const data2 = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'TestTwo' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ id: 1, name: 'TestTwo' })
        })
    
        it('should correctly merge a replace into a longer content tag', () => {
            const data1 = { id: 1, name: 'TestOne' }
            const data2 = { tag: 'Replace' as const, match: { id: 1, name: 'One' }, payload: { id: 1, name: 'Two' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ id: 1, name: 'TestTwo' })
        })

        it('should correctly merge a replace into a shorter content tag', () => {
            const data1 = { id: 1, name: 'One' }
            const data2 = { tag: 'Replace' as const, match: { id: 1, name: 'TestOne' }, payload: { id: 1, name: 'OutputTwo' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Replace', match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'OutputTwo' } })
        })

        it('should correctly merge a replace into a remove tag', () => {
            const data1 = { tag: 'Remove' as const, match: { id: 1, name: 'One' } }
            const data2 = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'OutputTwo' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Replace', match: { id: 1, name: 'TestOne' }, payload: { id: 1, name: 'OutputTwo' } })
        })

        it('should correctly merge content into a replace tag', () => {
            const data1 = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'Output' } }
            const data2 = { id: 1, name: 'Two' }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Replace', match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'OutputTwo' } })
        })

        it('should correctly merge remove into a matching replace tag', () => {
            const data1 = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'Output' } }
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'Output' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Remove', match: { id: 1, name: 'Test' } })
        })

        it('should correctly merge remove into a longer replace tag', () => {
            const data1 = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'FinalOutput' } }
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'Output' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Replace', match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'Final' } })
        })

        it('should correctly merge remove into a shorter replace tag', () => {
            const data1 = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'Output' } }
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'FinalOutput' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Remove', match: { id: 1, name: 'FinalTest' } })
        })

        it('should correctly merge replace into a replace tag', () => {
            const data1 = { tag: 'Replace' as const, match: { id: 1, name: 'One' }, payload: { id: 1, name: 'Two' } }
            const data2 = { tag: 'Replace' as const, match: { id: 1, name: 'Two' }, payload: { id: 1, name: 'Three' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Replace', match: { id: 1, name: 'One' }, payload: { id: 1, name: 'Three' } })
        })
    })

    it('should correctly diff two content tags', () => {
        const data1 = { id: 1, name: 'Test' }
        const data2 = { id: 2, name: 'Test2' }
        const editable1 = factory(data1)
        const editable2 = factory(data2)
        expect(editable2).toBeDefined()
        if (editable2) {
            const diff = editable1?.diff(editable2)
            expect(diff?.toJSON()).toEqual({ id: 1, name: '2' })
        }
    })

    it('should correctly diff a remove into a content tag', () => {
        const data1 = { id: 1, name: 'Test' }
        const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'Test' } }
        const editable1 = factory(data1)
        const editable2 = factory(data2)
        const diff = editable1?.diff(editable2!)
        expect(diff?.toJSON()).toEqual({ tag: 'Remove', match: { id: 1, name: 'TestTest' } })
    })

    it('should correct diff content into a remove tag', () => {
        const data1 = { tag: 'Remove' as const, match: { id: 1, name: 'Test' } }
        const data2 = { id: 1, name: 'Test' }
        const editable1 = factory(data1)
        const editable2 = factory(data2)
        const diff = editable1?.diff(editable2!)
        expect(diff?.toJSON()).toEqual({ id: 1, name: 'TestTest' })
    })
})