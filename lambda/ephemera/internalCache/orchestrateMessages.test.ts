jest.mock('uuid')
import { v4 as uuidv4 } from 'uuid'

import { CacheBase } from "./baseClasses";
import OrchestrateMessages from "./orchestrateMessages";

const uuidv4Mock = uuidv4 as jest.Mock

describe ('OrchestrateMessages', () => {
    const testCache = new (OrchestrateMessages(CacheBase))()

    beforeEach(() => {
        jest.clearAllMocks()
        testCache.clear()
        let uuidv4Index = 1
        uuidv4Mock.mockImplementation(() => (`UUID#${uuidv4Index++}`))
    })

    it('should create next groupId', () => {
        const root = testCache.OrchestrateMessages._newMessageGroup('')
        testCache.OrchestrateMessages._newMessageGroup('') // Distractor data
        const test = testCache.OrchestrateMessages.next(root)

        expect(test).toBe('UUID#3')
        expect(testCache.OrchestrateMessages.OrchestrateMessagesById[test]).toEqual({
            messageGroupId: 'UUID#3',
            parentGroupId: 'UUID#1',
            before: [],
            during: [],
            after: []
        })
        expect(testCache.OrchestrateMessages.OrchestrateMessagesById[root]).toEqual({
            messageGroupId: 'UUID#1',
            parentGroupId: '',
            before: [],
            during: ['UUID#3'],
            after: []
        })

    })
})

