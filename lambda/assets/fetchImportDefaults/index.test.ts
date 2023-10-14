import { fetchImportsMessage } from '.'

jest.mock('../clients')
import { sfnClient } from '../clients'
jest.mock('../internalCache')
import internalCache from '../internalCache'
jest.mock('./baseClasses')
import { Graph } from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph'

const sfnClientMock = sfnClient as jest.Mocked<typeof sfnClient>
const internalCacheMock = jest.mocked(internalCache, true)

describe('fetchImportsMessage', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCacheMock.Graph.get.mockResolvedValue(new Graph<string, { key: string }, {}>({}, [], {}))
        internalCacheMock.Meta.get.mockResolvedValue([])
    })

    it('should pass inheritanceGraph to step function', async () => {
        //
        // TODO: Should test functionality
        //
    })

})