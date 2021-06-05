const { resolveTargets } = require('./resolveTargets')
jest.mock('@aws-sdk/util-dynamodb')
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')

describe("resolveTargets", () => {

    let dbClient = { send: jest.fn() }
    beforeEach(() => {
        dbClient.send.mockResolvedValue({ Items: [{
            EphemeraId: 'CHARACTERINPLAY#ABC',
            RoomId: '123',
            Connected: true,
            ConnectionId: 'XYZ'
        },
        {
            EphemeraId: 'CHARACTERINPLAY#DEF',
            RoomId: '123',
            Connected: false,
            ConnectionId: 'WXY'
        },
        {
            EphemeraId: 'CHARACTERINPLAY#GHI',
            RoomId: '456',
            Connected: true,
            ConnectionId: 'XYZ'
        },
        {
            EphemeraId: 'CHARACTERINPLAY#JKL',
            RoomId: '456',
            Connected: false
        }]})
        marshall.mockImplementation((value) => (value))
        unmarshall.mockImplementation((value) => (value))
    })
    it('should return empty array when passed nothing', async () => {
        const test = await resolveTargets(dbClient)([])
        expect(test).toEqual({ byConnectionId: {}, resolvedMessages: [] })
    })
    it('should return connected character when passed that character only', async () => {
        const test = await resolveTargets(dbClient)([{ Targets: ['CHARACTER#ABC'], Message: 'Test' }])
        expect(test).toEqual({
            byConnectionId:
                { XYZ: [{ Target: 'ABC', Message: 'Test' }] },
            resolvedMessages: [
                { Targets: ['CHARACTER#ABC'], Message: 'Test' }
            ] })
    })
    it('should return disconnected character with connectionID when passed', async () => {
        const test = await resolveTargets(dbClient)([{ Targets: ['CHARACTER#DEF'], Message: 'Test' }])
        expect(test).toEqual({
            byConnectionId:
                { WXY: [{ Target: 'DEF', Message: 'Test' }] },
            resolvedMessages: [
                { Targets: ['CHARACTER#DEF'], Message: 'Test' }
            ] })
    })
    it('should return disconnected character with no connectionID but only for resolvedMessages', async () => {
        const test = await resolveTargets(dbClient)([{ Targets: ['CHARACTER#JKL'], Message: 'Test' }])
        expect(test).toEqual({
            byConnectionId: {},
            resolvedMessages: [
                { Targets: ['CHARACTER#JKL'], Message: 'Test' }
            ] })
    })
    it('should return connected characters when passed room only', async () => {
        const test = await resolveTargets(dbClient)([{ Targets: ['ROOM#123'], Message: 'Test' }])
        expect(test).toEqual({
            byConnectionId:
                { XYZ: [{ Target: 'ABC', Message: 'Test' }] },
            resolvedMessages: [
                { Targets: ['CHARACTER#ABC'], Message: 'Test' }
            ] })
    })
    it('should return specified character and connected characters when passed room and character ID', async () => {
        const test = await resolveTargets(dbClient)([{ Targets: ['ROOM#123', 'CHARACTER#DEF'], Message: 'Test' }])
        expect(test).toEqual({
            byConnectionId: {
                XYZ: [{ Target: 'ABC', Message: 'Test' }],
                WXY: [{ Target: 'DEF', Message: 'Test' }],
            },
            resolvedMessages: [
                { Targets: ['CHARACTER#DEF', 'CHARACTER#ABC'], Message: 'Test' }
            ] })
    })
    it('should group multiple messages appropriately', async () => {
        const test = await resolveTargets(dbClient)([
            { Targets: ['ROOM#123', 'CHARACTER#DEF'], Message: 'Test One' },
            { Targets: ['CHARACTER#ABC'], Message: 'Test Two' },
            { Targets: ['ROOM#456'], Message: 'Test Three' },
        ])
        expect(test).toEqual({
            byConnectionId: {
                XYZ: [
                    { Target: 'ABC', Message: 'Test One' },
                    { Target: 'ABC', Message: 'Test Two' },
                    { Target: 'GHI', Message: 'Test Three' }
                ],
                WXY: [{ Target: 'DEF', Message: 'Test One' }],
            },
            resolvedMessages: [
                { Targets: ['CHARACTER#DEF', 'CHARACTER#ABC'], Message: 'Test One' },
                { Targets: ['CHARACTER#ABC'], Message: 'Test Two' },
                { Targets: ['CHARACTER#GHI'], Message: 'Test Three' }
            ] })
    })
})
