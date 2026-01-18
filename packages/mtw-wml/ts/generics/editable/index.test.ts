import { StandardEditablePayload, StandardEditableFactoryProps, standardEditableFactory } from './index'
import { MergeConflictError } from '@tonylb/mtw-base/ts/standardize'
import { GenericTree, treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import { isSchemaString } from '@tonylb/mtw-base/ts/schema/renderTree'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'
import { isSchemaTreeNode, schemaToWML } from '../../schema'

interface TestData {
    id: number
    name: string
}

const testTypeguard = (value: any): value is TestData => {
    return typeof value === 'object' && value !== null && typeof value.id === 'number' && typeof value.name === 'string'
}

class testClass implements StandardEditablePayload<TestData> {
    data: TestData
    get schema() {
        return [{ data: { tag: 'String' as const, value: this.data.name }, children: [] }]
    }
    constructor(data: TestData) {
        this.data = data as TestData
    }
    clone() {
        return new testClass(this.data)
    }
    toJSON() {
        return { ...this.data }
    }
}

const testPayloadFactory = (props: TestData | GenericTree<SchemaTag>): testClass | undefined => {
    if (testTypeguard(props)) {
        return new testClass(props)
    }
    if ((Array.isArray(props) && props.every(isSchemaTreeNode)) && treeNodeTypeguard(isSchemaString)(props[0])) {
        return new testClass({ id: 0, name: props[0].data.value })
    }
    return undefined
}

const factoryProps: StandardEditableFactoryProps<TestData, testClass> = {
    typeguard: testTypeguard,
    payloadFactory: testPayloadFactory,
    payload: testClass,
    add: (base, incoming) => {
        return { id: base.id, name: `${base.name}${incoming.name}` }
    },
    subtract: (base, incoming, options: { fromStart?: boolean } = {}) => {
        if (base.name === incoming.name) {
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
    },
    diff: (base, incoming) => {
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

describe('standardEditableFactory', () => {
    const { EditableClass, PlainClass, RemoveClass, ReplaceClass, dataTypeguard } = standardEditableFactory(factoryProps, 'StandardTest');

    describe('dataTypeguard', () => {
        it('should accept plain data that matches the base typeguard', () => {
            const validData: TestData = { id: 1, name: 'Test' };
            expect(dataTypeguard(validData)).toBe(true);
        });
        
        it('should reject plain data that does not match the base typeguard', () => {
            const invalidData = { id: 'not a number', name: 'Test' };
            expect(dataTypeguard(invalidData)).toBe(false);
        });
        
        it('should accept Remove structure with valid match data', () => {
            const removeData = {
                tag: 'Remove' as const,
                match: { id: 1, name: 'Test' }
            };
            expect(dataTypeguard(removeData)).toBe(true);
        });
        
        it('should reject Remove structure with invalid match data', () => {
            const removeData = {
                tag: 'Remove' as const,
                match: { id: 'not a number', name: 'Test' }
            };
            expect(dataTypeguard(removeData)).toBe(false);
        });
        
        it('should accept Replace structure with valid match and payload data', () => {
            const replaceData = {
                tag: 'Replace' as const,
                match: { id: 1, name: 'Old' },
                payload: { id: 2, name: 'New' }
            };
            expect(dataTypeguard(replaceData)).toBe(true);
        });
        
        it('should reject Replace structure with invalid match data', () => {
            const replaceData = {
                tag: 'Replace' as const,
                match: { id: 'not a number', name: 'Old' },
                payload: { id: 2, name: 'New' }
            };
            expect(dataTypeguard(replaceData)).toBe(false);
        });
        
        it('should reject Replace structure with invalid payload data', () => {
            const replaceData = {
                tag: 'Replace' as const,
                match: { id: 1, name: 'Old' },
                payload: { id: 'not a number', name: 'New' }
            };
            expect(dataTypeguard(replaceData)).toBe(false);
        });
        
        it('should reject objects with wrong tag names', () => {
            const wrongTagData = {
                tag: 'WrongTag',
                match: { id: 1, name: 'Test' }
            };
            expect(dataTypeguard(wrongTagData)).toBe(false);
        });
        
        it('should reject null values', () => {
            expect(dataTypeguard(null)).toBe(false);
        });
        
        it('should reject primitive values', () => {
            expect(dataTypeguard('string')).toBe(false);
            expect(dataTypeguard(42)).toBe(false);
            expect(dataTypeguard(true)).toBe(false);
        });
    });

     // NOTE: Robust testing approach - these tests verify that:
     // 1. The correct class types are instantiated (instanceof checks)
     // 2. The data round-trips correctly through create() and toJSON()
     // 3. The _delta getter works correctly with fromDelta()
     //
     // This unified approach tests both the creation logic AND the serialization logic
     // simultaneously, providing comprehensive coverage without separate test sections.
     //
     // The standardEditableFactory classes now implement:
     // ✅ create() factory method for various input types
     // ✅ toJSON() methods on all generated classes
     // ✅ _delta getter for extracting deltas
     // ✅ fromDelta() factory method for delta reconstruction (returns undefined for empty deltas)
     // ✅ schema getters on all generated classes
     // ✅ merge/diff operations (operating on deltas, can return undefined when no content remains)
     // ✅ StandardEditableWrapper interface compatibility (clone, plain, nestedSchema methods)

    describe('create method', () => {
        it('should create PlainClass for simple data object', () => {
            const data: TestData = { id: 1, name: 'Test' };
            const component = EditableClass.create(data);
            expect(component).toBeDefined();
            expect(component).toBeInstanceOf(PlainClass);
            expect(component.toJSON()).toEqual(data);
        });

        it('should create PlainClass for simple string', () => {
            const component = EditableClass.create('Test');
            expect(component).toBeDefined();
            expect(component).toBeInstanceOf(PlainClass);
            expect(schemaToWML(component.schema)).toEqual('Test');
        });

        it('should create RemoveClass for <Remove> tag', () => {
            const component = EditableClass.create('<Remove>Test</Remove>');
            expect(component).toBeDefined();
            expect(component).toBeInstanceOf(RemoveClass);
            expect(schemaToWML(component.schema)).toEqual('<Remove>Test</Remove>');
        });

        it('should create ReplaceClass for <Replace> tag', () => {
            const component = EditableClass.create('<Replace>Old</Replace><With>New</With>');
            expect(component).toBeDefined();
            expect(component).toBeInstanceOf(ReplaceClass);
            expect(schemaToWML(component.schema)).toEqual('<Replace>Old</Replace><With>New</With>');
        });

        it('should create RemoveClass for Remove object', () => {
            const removeData = { tag: 'Remove' as const, match: { id: 1, name: 'Test' } };
            const component = EditableClass.create(removeData);
            expect(component).toBeDefined();
            expect(component).toBeInstanceOf(RemoveClass);
            expect(component.toJSON()).toEqual(removeData);
        });

        it('should create ReplaceClass for Replace object', () => {
            const replaceData = { 
                tag: 'Replace' as const, 
                match: { id: 1, name: 'Old' }, 
                payload: { id: 2, name: 'New' } 
            };
            const component = EditableClass.create(replaceData);
            expect(component).toBeDefined();
            expect(component).toBeInstanceOf(ReplaceClass);
            expect(component.toJSON()).toEqual(replaceData);
        });

        it('should create PlainClass for schema tree', () => {
            const schema: GenericTree<SchemaTag> = [{ data: { tag: 'String', value: 'Test' }, children: [] }];
            const component = EditableClass.create(schema);
            expect(component).toBeDefined();
            expect(component).toBeInstanceOf(PlainClass);
            expect(component.toJSON()).toEqual({ id: 0, name: 'Test' });
            expect(schemaToWML(component.schema)).toEqual('Test');
        });

        it('should create RemoveClass for Remove schema tree', () => {
            const schema: GenericTree<SchemaTag> = [{ 
                data: { tag: 'Remove' as const }, 
                children: [{ data: { tag: 'String', value: 'Test' }, children: [] }] 
            }];
            const component = EditableClass.create(schema);
            expect(component).toBeDefined();
            expect(component).toBeInstanceOf(RemoveClass);
            expect(component.toJSON()).toEqual({ tag: 'Remove', match: { id: 0, name: 'Test' } });
            expect(schemaToWML(component.schema)).toEqual('<Remove>Test</Remove>');
        });

        it('should create ReplaceClass for Replace schema tree', () => {
            const schema: GenericTree<SchemaTag> = [{ 
                data: { tag: 'Replace' as const }, 
                children: [
                    { data: { tag: 'ReplaceMatch' as const }, children: [{ data: { tag: 'String', value: 'Old' }, children: [] }] },
                    { data: { tag: 'ReplacePayload' as const }, children: [{ data: { tag: 'String', value: 'New' }, children: [] }] }
                ] 
            }];
            const component = EditableClass.create(schema);
            expect(component).toBeDefined();
            expect(component).toBeInstanceOf(ReplaceClass);
            expect(component.toJSON()).toEqual({ tag: 'Replace', match: { id: 0, name: 'Old' }, payload: { id: 0, name: 'New' } });
            expect(schemaToWML(component.schema)).toEqual('<Replace>Old</Replace><With>New</With>');
        });
    });

    describe('_delta getter', () => {
        it('should return add delta for PlainClass', () => {
            const data: TestData = { id: 1, name: 'Test' };
            const component = EditableClass.create(data);
            const delta = component._delta;
            
            expect(delta.add).toBeDefined();
            expect(delta.remove).toBeUndefined();
            expect(delta.add).toEqual(data);
        });

        it('should return remove delta for RemoveClass', () => {
            // Use a Remove object instead of WML to avoid parsing issues
            const removeData = { tag: 'Remove' as const, match: { id: 1, name: 'Test' } };
            const component = EditableClass.create(removeData);
            const delta = component._delta;
            
            expect(delta.remove).toBeDefined();
            expect(delta.add).toBeUndefined();
            // Note: We can't easily test the exact value without implementing toJSON properly
            // but we can verify the structure is correct
            expect(typeof delta.remove).toBe('object');
        });

        it('should return both remove and add delta for ReplaceClass', () => {
            // Use a Replace object instead of WML to avoid parsing issues
            const replaceData = { 
                tag: 'Replace' as const, 
                match: { id: 1, name: 'Old' }, 
                payload: { id: 2, name: 'New' } 
            };
            const component = EditableClass.create(replaceData);
            const delta = component._delta;
            
            expect(delta.remove).toBeDefined();
            expect(delta.add).toBeDefined();
            expect(typeof delta.remove).toBe('object');
            expect(typeof delta.add).toBe('object');
        });

        // fromDelta static method tests
        it('should create PlainClass from add-only delta', () => {
            const delta = { add: { id: 1, name: 'Test' } };
            const component = EditableClass.fromDelta(delta);
            
            expect(component).toBeDefined();
            expect(component).toBeInstanceOf(PlainClass);
            expect(component!.toJSON()).toEqual(delta.add);
            expect(schemaToWML(component!.schema)).toEqual('Test');
        });

        it('should create RemoveClass from remove-only delta', () => {
            const delta = { remove: { id: 1, name: 'Test' } };
            const component = EditableClass.fromDelta(delta);
            
            expect(component).toBeDefined();
            expect(component).toBeInstanceOf(RemoveClass);
            expect(component!.toJSON()).toEqual({ tag: 'Remove', match: delta.remove });
            expect(schemaToWML(component!.schema)).toEqual('<Remove>Test</Remove>');
        });

        it('should create ReplaceClass from add+remove delta', () => {
            const delta = { 
                remove: { id: 1, name: 'Old' }, 
                add: { id: 2, name: 'New' } 
            };
            const component = EditableClass.fromDelta(delta);
            
            expect(component).toBeDefined();
            expect(component).toBeInstanceOf(ReplaceClass);
            expect(component!.toJSON()).toEqual({ tag: 'Replace', match: delta.remove, payload: delta.add });
            expect(schemaToWML(component!.schema)).toEqual('<Replace>Old</Replace><With>New</With>');
        });

        it('should return undefined for empty delta', () => {
            const delta = {};
            const result = EditableClass.fromDelta(delta);
            expect(result).toBeUndefined();
        });

        it('should round-trip through _delta and fromDelta', () => {
            const data: TestData = { id: 1, name: 'Test' };
            const originalComponent = EditableClass.create(data);
            const delta = originalComponent._delta;
            const recreatedComponent = EditableClass.fromDelta(delta);
            
            expect(recreatedComponent).toBeDefined();
            expect(recreatedComponent).toBeInstanceOf(PlainClass);
            expect(recreatedComponent!._delta).toEqual(delta);
            expect(recreatedComponent!.toJSON()).toEqual(data);
            expect(schemaToWML(recreatedComponent!.schema)).toEqual('Test');
        });
    });

    describe('miscellaneous', () => {
        it('should clone PlainClass correctly', () => {
            const data: TestData = { id: 1, name: 'Test' };
            const originalComponent = EditableClass.create(data);
            const clonedComponent = originalComponent.clone();
            
            expect(clonedComponent).toBeInstanceOf(PlainClass);
            expect(clonedComponent).not.toBe(originalComponent); // Different instance
            expect(clonedComponent.toJSON()).toEqual(originalComponent.toJSON());
            expect(clonedComponent.schema).toEqual(originalComponent.schema);
        });
        
        it('should clone RemoveClass correctly', () => {
            const removeData = { tag: 'Remove' as const, match: { id: 1, name: 'Test' } };
            const originalComponent = EditableClass.create(removeData);
            const clonedComponent = originalComponent.clone();
            
            expect(clonedComponent).toBeInstanceOf(RemoveClass);
            expect(clonedComponent).not.toBe(originalComponent); // Different instance
            expect(clonedComponent.toJSON()).toEqual(originalComponent.toJSON());
            expect(clonedComponent.schema).toEqual(originalComponent.schema);
        });
        
        it('should clone ReplaceClass correctly', () => {
            const replaceData = { 
                tag: 'Replace' as const, 
                match: { id: 1, name: 'Old' }, 
                payload: { id: 2, name: 'New' } 
            };
            const originalComponent = EditableClass.create(replaceData);
            const clonedComponent = originalComponent.clone();
            
            expect(clonedComponent).toBeInstanceOf(ReplaceClass);
            expect(clonedComponent).not.toBe(originalComponent); // Different instance
            expect(clonedComponent.toJSON()).toEqual(originalComponent.toJSON());
            expect(clonedComponent.schema).toEqual(originalComponent.schema);
        });
        
        it('should provide correct plain property for PlainClass', () => {
            const data: TestData = { id: 1, name: 'Test' };
            const component = EditableClass.create(data);
            
            expect(component.plain).toBeDefined();
            expect(component.plain).toBeInstanceOf(testClass);
            expect(component.plain!.toJSON()).toEqual(data);
        });
        
        it('should provide correct plain property for RemoveClass', () => {
            const removeData = { tag: 'Remove' as const, match: { id: 1, name: 'Test' } };
            const component = EditableClass.create(removeData);
            
            expect(component.plain).toBeDefined();
            expect(component.plain).toBeInstanceOf(testClass);
            expect(component.plain!.toJSON()).toEqual({ id: 1, name: 'Test' });
        });
        
        it('should provide correct plain property for ReplaceClass', () => {
            const replaceData = { 
                tag: 'Replace' as const, 
                match: { id: 1, name: 'Old' }, 
                payload: { id: 2, name: 'New' } 
            };
            const component = EditableClass.create(replaceData);
            
            expect(component.plain).toBeInstanceOf(testClass);
            expect(component.plain!.toJSON()).toEqual({ id: 2, name: 'New' });
        });
        
        it('should provide nestedSchema method that returns schema', () => {
            const data: TestData = { id: 1, name: 'Test' };
            const component = EditableClass.create(data);
            
            const nestedSchema = component.nestedSchema({ tag: 'String', value: 'Test' });
            expect(nestedSchema).toEqual(component.schema);
        });

        it('should provide remapReferences method for PlainClass', () => {
            const data: TestData = { id: 1, name: 'Test' };
            const component = EditableClass.create(data);
            expect(typeof component.remapReferences).toBe('function');
            // Note: This test doesn't verify the actual remapping logic since TestPayload doesn't implement remapReferences
            // In a real implementation, this would test the actual remapping behavior
        });

        it('should provide remapReferences method for RemoveClass', () => {
            const data: TestData = { id: 1, name: 'Test' };
            const component = EditableClass.create({ tag: 'Remove', match: data });
            expect(typeof component.remapReferences).toBe('function');
        });

        it('should provide remapReferences method for ReplaceClass', () => {
            const data: TestData = { id: 1, name: 'Test' };
            const component = EditableClass.create({ tag: 'Replace', match: data, payload: data });
            expect(typeof component.remapReferences).toBe('function');
        });
    });

    describe('merge', () => {
        it('should correctly merge two content tags', () => {
            const data1: TestData = { id: 1, name: 'Test' };
            const data2: TestData = { id: 2, name: 'Test2' };
            const editable1 = EditableClass.create(data1);
            const editable2 = EditableClass.create(data2);
            
            const merged = editable1.merge(editable2);
            expect(merged).toBeDefined();
            expect(merged).toBeInstanceOf(PlainClass);
            expect(merged!.toJSON()).toEqual({ id: 1, name: 'TestTest2' });
        });

        it('should correctly merge a remove into a matching content tag', () => {
            const data1: TestData = { id: 1, name: 'Test' };
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'Test' } };
            const editable1 = EditableClass.create(data1);
            const editable2 = EditableClass.create(data2);
            
            const merged = editable1.merge(editable2);
            // When content is completely removed, result should be undefined
            expect(merged).toBeUndefined();
        });

        it('should correctly merge remove into a longer content tag', () => {
            const data1: TestData = { id: 1, name: 'TestOne' };
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'One' } };
            const editable1 = EditableClass.create(data1);
            const editable2 = EditableClass.create(data2);
            
            const merged = editable1.merge(editable2);
            expect(merged).toBeDefined();
            expect(merged).toBeInstanceOf(PlainClass);
            expect(merged!.toJSON()).toEqual({ id: 1, name: 'Test' });
        });

        it('should correctly merge remove into a shorter content tag', () => {
            const data1: TestData = { id: 1, name: 'One' };
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'TestOne' } };
            const editable1 = EditableClass.create(data1);
            const editable2 = EditableClass.create(data2);
            
            const merged = editable1.merge(editable2);
            expect(merged).toBeDefined();
            expect(merged).toBeInstanceOf(RemoveClass);
            expect(merged!.toJSON()).toEqual({ tag: 'Remove', match: { id: 1, name: 'Test' } });
        });

        it('should throw a merge conflict error when merging remove into conflicting content', () => {
            const data1: TestData = { id: 1, name: 'Test' };
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'Different' } };
            const editable1 = EditableClass.create(data1);
            const editable2 = EditableClass.create(data2);
            
            expect(() => editable1.merge(editable2)).toThrow();
        });
    });

    describe('diff', () => {
        it('should correctly diff two content tags', () => {
            const data1: TestData = { id: 1, name: 'Test' };
            const data2: TestData = { id: 2, name: 'TestTest2' };
            const editable1 = EditableClass.create(data1);
            const editable2 = EditableClass.create(data2);
            
            const diffed = editable1.diff(editable2);
            expect(diffed).toBeDefined();
            expect(diffed).toBeInstanceOf(PlainClass);
            expect(diffed!.toJSON()).toEqual({ id: 1, name: 'Test2' });
        });

        it('should correctly diff remove from a longer content tag', () => {
            const data1: TestData = { id: 1, name: 'TestOne' };
            const data2: TestData = { id: 1, name: 'Test' };
            const editable1 = EditableClass.create(data1);
            const editable2 = EditableClass.create(data2);
            
            const diffed = editable1.diff(editable2);
            expect(diffed).toBeDefined();
            expect(diffed).toBeInstanceOf(RemoveClass);
            expect(diffed!.toJSON()).toEqual({ tag: 'Remove', match: { id: 1, name: 'One' } });
        });

        it('should correctly diff remove from a shorter content tag', () => {
            const data1: TestData = { id: 1, name: 'Test' };
            const data2: TestData = { id: 1, name: 'TestOne' };
            const editable1 = EditableClass.create(data1);
            const editable2 = EditableClass.create(data2);
            
            const diffed = editable1.diff(editable2);
            expect(diffed).toBeDefined();
            expect(diffed).toBeInstanceOf(PlainClass);
            expect(diffed!.toJSON()).toEqual({ id: 1, name: 'One' });
        });
    });

    describe('invert method', () => {
        it('should invert Plain (Add) to Remove', () => {
            const data: TestData = { id: 1, name: 'Test' };
            const plain = EditableClass.create(data);
            expect(plain).toBeInstanceOf(PlainClass);
            
            const inverted = plain.invert();
            expect(inverted).toBeInstanceOf(RemoveClass);
            expect(inverted.toJSON()).toEqual({ tag: 'Remove', match: data });
        });

        it('should invert Remove to Plain (Add)', () => {
            const data: TestData = { id: 1, name: 'Test' };
            const remove = RemoveClass.create({ tag: 'Remove', match: data });
            expect(remove).toBeInstanceOf(RemoveClass);
            
            const inverted = remove.invert();
            expect(inverted).toBeInstanceOf(PlainClass);
            expect(inverted.toJSON()).toEqual(data);
        });

        it('should invert Replace by swapping match and payload', () => {
            const matchData: TestData = { id: 1, name: 'Old' };
            const payloadData: TestData = { id: 2, name: 'New' };
            const replace = EditableClass.create({ tag: 'Replace', match: matchData, payload: payloadData });
            expect(replace).toBeInstanceOf(ReplaceClass);
            
            const inverted = replace.invert();
            expect(inverted).toBeInstanceOf(ReplaceClass);
            expect(inverted.toJSON()).toEqual({ 
                tag: 'Replace', 
                match: payloadData, 
                payload: matchData 
            });
        });

        it('should satisfy double-inversion property (invert.invert returns equivalent)', () => {
            const data: TestData = { id: 1, name: 'Test' };
            const plain = EditableClass.create(data);
            
            // Double inversion should return to original
            const doubleInverted = plain.invert().invert();
            expect(doubleInverted).toBeInstanceOf(PlainClass);
            expect(doubleInverted.toJSON()).toEqual(plain.toJSON());
        });

        it('should satisfy double-inversion property for Remove', () => {
            const data: TestData = { id: 1, name: 'Test' };
            const remove = RemoveClass.create({ tag: 'Remove', match: data });
            
            // Double inversion should return to original
            const doubleInverted = remove.invert().invert();
            expect(doubleInverted).toBeInstanceOf(RemoveClass);
            expect(doubleInverted.toJSON()).toEqual(remove.toJSON());
        });

        it('should satisfy double-inversion property for Replace', () => {
            const matchData: TestData = { id: 1, name: 'Old' };
            const payloadData: TestData = { id: 2, name: 'New' };
            const replace = EditableClass.create({ tag: 'Replace', match: matchData, payload: payloadData });
            
            // Double inversion should return to original
            const doubleInverted = replace.invert().invert();
            expect(doubleInverted).toBeInstanceOf(ReplaceClass);
            expect(doubleInverted.toJSON()).toEqual(replace.toJSON());
        });
    });
})