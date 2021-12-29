import { testKeys, TestTemplate } from '../baseClasses'

type dijkstraArgs = {
    startKey: testKeys,
    endKey: testKeys,
    template: TestTemplate
}

export const dijkstra = jest.fn<testKeys[], [dijkstraArgs]>()

export default dijkstra
