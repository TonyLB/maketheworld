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
        const root = testCache.OrchestrateMessages.newMessageGroup()
        testCache.OrchestrateMessages.newMessageGroup() // Distractor data
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

    it('should create before groupId', () => {
        const root = testCache.OrchestrateMessages.newMessageGroup()
        testCache.OrchestrateMessages.newMessageGroup() // Distractor data
        const test = testCache.OrchestrateMessages.before(root)
        testCache.OrchestrateMessages.before(root)

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
            before: ['UUID#4', 'UUID#3'],
            during: [],
            after: []
        })
    })

    it('should create after groupId', () => {
        const root = testCache.OrchestrateMessages.newMessageGroup()
        testCache.OrchestrateMessages.newMessageGroup() // Distractor data
        const test = testCache.OrchestrateMessages.after(root)
        testCache.OrchestrateMessages.after(root)

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
            during: [],
            after: ['UUID#3', 'UUID#4']
        })
    })

    it('should properly order elements in allOffsets', () => {
        const rootOne = testCache.OrchestrateMessages.newMessageGroup()
        testCache.OrchestrateMessages.next(rootOne)
        const beforeOne = testCache.OrchestrateMessages.before(rootOne)
        testCache.OrchestrateMessages.after(rootOne)
        testCache.OrchestrateMessages.next(rootOne)
        testCache.OrchestrateMessages.next(beforeOne)

        const rootTwo = testCache.OrchestrateMessages.newMessageGroup()
        const duringTwo = testCache.OrchestrateMessages.next(rootTwo)
        testCache.OrchestrateMessages.after(duringTwo)
        testCache.OrchestrateMessages.before(duringTwo)
        
        expect(testCache.OrchestrateMessages.allOffsets()).toEqual({
            'UUID#1': 0,
            'UUID#2': 1,
            'UUID#3': -2,
            'UUID#4': 3,
            'UUID#5': 2,
            'UUID#6': -1,
            'UUID#7': 0,
            'UUID#8': 2,
            'UUID#9': 3,
            'UUID#10': 1
        })
    })
})

