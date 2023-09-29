import { Graph } from "../utils/graph"
import CascadeGraph from '.'
//
// TODO: Refactor calling patterns copied from sortedWalk
//

describe('CascadeGraph', () => {
    let testNodes: Record<string, { key: string }>

    beforeEach(() => {
        testNodes = {
            A: { key: 'A' },
            B: { key: 'B' },
            C: { key: 'C' },
            D: { key: 'D' },
            E: { key: 'E' },
            F: { key: 'F' },
        }
    })

    it('should correctly walk an acyclic tree', async () => {
        const testEdges = [
            { from: 'A', to: 'C' },
            { from: 'B', to: 'C' },
            { from: 'C', to: 'D' },
            { from: 'D', to: 'E' },
            { from: 'D', to: 'F' }
        ]
        const fetch = jest.fn().mockImplementation(async (keys) => (keys.map((key) => ({ key, value: `Value-${key}` }))))
        const process = jest.fn().mockImplementation(async ({ template }) => ({ value: `${template.key}::${template.key}` }))
        const template = new Graph(testNodes, testEdges, {},  true)
        const cascadeGraph = new CascadeGraph({
            template,
            fetch,
            process
        })
        await cascadeGraph.execute()
        const testCall = (key: string, priors: { key: string; value: string }[] = []) => ({
            template: { key },
            fetch: { value: `Value-${key}`},
            priors: priors.map(({ key, value }) => ({ key, edge: {}, fetch: { value: `Value-${key}` }, result: { value } }))
        })
        expect(process).toHaveBeenCalledTimes(6)
        expect(process).toHaveBeenCalledWith(testCall('B'))
        expect(process).toHaveBeenCalledWith(testCall('A'))
        expect(process).toHaveBeenCalledWith(testCall('C', [{ key: 'A', value: 'A::A' }, { key: 'B', value: 'B::B' }]))
        expect(process).toHaveBeenCalledWith(testCall('D', [{ key: 'C', value: 'C::C' }]))
        expect(process).toHaveBeenCalledWith(testCall('E', [{ key: 'D', value: 'D::D' }]))
        expect(process).toHaveBeenCalledWith(testCall('F', [{ key: 'D', value: 'D::D' }]))
    })

    // it('should correctly walk a cyclic tree', async () => {
    //     const testEdges = [
    //         { from: 'A', to: 'C' },
    //         { from: 'B', to: 'C' },
    //         { from: 'C', to: 'D' },
    //         { from: 'D', to: 'E' },
    //         { from: 'E', to: 'C' },
    //         { from: 'D', to: 'F' }
    //     ]
    //     const fetch = jest.fn().mockImplementation(async (keys) => (keys.map((key) => ({ key }))))
    //     const process = jest.fn().mockImplementation(async ({ keys }) => (keys.join('::')))
    //     const template = new Graph(testNodes, testEdges, {},  true)
    //     const cascadeGraph = new CascadeGraph({
    //         template,
    //         fetch,
    //         process
    //     })
    //     await cascadeGraph.execute()
    //     expect(process).toHaveBeenCalledTimes(4)
    //     expect(process).toHaveBeenCalledWith({ keys: ['B'], previous: [] })
    //     expect(process).toHaveBeenCalledWith({ keys: ['A'], previous: [] })
    //     expect(process).toHaveBeenCalledWith({ keys: ['C', 'D', 'E'], previous: ['A', 'B'] })
    //     expect(process).toHaveBeenCalledWith({ keys: ['F'], previous: ['C::D::E'] })
    // })

})