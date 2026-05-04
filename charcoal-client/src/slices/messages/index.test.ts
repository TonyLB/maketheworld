import { vi } from 'vitest'
import reducer, {
    receiveMessages,
    getMessages,
    getPresentation
} from './index'
import {
    WorldMessage
} from '@tonylb/mtw-interfaces/ts/messages'

vi.mock('../../cacheDB')

describe('messages reducer', () => {

    describe('receiveMessages', () => {
        const testArray = [
            [2, 'Test-2'],
            [100, 'Test-B'],
            [100, 'Test-H'],
            [10000, 'Test-10000']
        ].map(([value, label]) => ({
            DisplayProtocol: 'WorldMessage',
            MessageId: label,
            Message: ['Test'],
            CreatedTime: value,
            Target: 'CHARACTER#Test'
        })) as WorldMessage[]

        const testAggregates = {
            'CHARACTER#TESS': {
                'Test-2': { earliestCreatedTime: 2, latestCreatedTime: 2 },
                'Test-B': { earliestCreatedTime: 100, latestCreatedTime: 100 },
                'Test-H': { earliestCreatedTime: 100, latestCreatedTime: 100 },
                'Test-10000': { earliestCreatedTime: 10000, latestCreatedTime: 10000 }
            }
        }

        const testPresentation = {
            'CHARACTER#TESS': [...testArray]
        }

        const state = {
            history: {
                'CHARACTER#TESS': testArray
            },
            aggregates: testAggregates,
            presentation: testPresentation
        }

        it('should accept message in empty state', () => {
            expect(reducer(undefined, receiveMessages([{
                DisplayProtocol: 'WorldMessage',
                CreatedTime: 1,
                Message: ['Test message'],
                MessageId: 'Test',
                Target: 'CHARACTER#TESS'
            }]))).toEqual({
                history: {
                    'CHARACTER#TESS': [{
                        DisplayProtocol: 'WorldMessage',
                        CreatedTime: 1,
                        Message: ['Test message'],
                        MessageId: 'Test',
                        Target: 'CHARACTER#TESS'
                    }]
                },
                aggregates: {
                    'CHARACTER#TESS': {
                        Test: { earliestCreatedTime: 1, latestCreatedTime: 1 }
                    }
                },
                presentation: {
                    'CHARACTER#TESS': [{
                        DisplayProtocol: 'WorldMessage',
                        CreatedTime: 1,
                        Message: ['Test message'],
                        MessageId: 'Test',
                        Target: 'CHARACTER#TESS'
                    }]
                }
            })
        })

        it('should accept CommandTranscriptMessage rows from Messages pipeline', () => {
            expect(reducer(undefined, receiveMessages([{
                DisplayProtocol: 'CommandTranscriptMessage',
                CreatedTime: 2,
                Message: ['look'],
                MessageId: 'MESSAGE#command',
                Target: 'CHARACTER#TESS'
            } as any]))).toEqual({
                history: {
                    'CHARACTER#TESS': [{
                        DisplayProtocol: 'CommandTranscriptMessage',
                        CreatedTime: 2,
                        Message: ['look'],
                        MessageId: 'MESSAGE#command',
                        Target: 'CHARACTER#TESS'
                    }]
                },
                aggregates: {
                    'CHARACTER#TESS': {
                        'MESSAGE#command': { earliestCreatedTime: 2, latestCreatedTime: 2 }
                    }
                },
                presentation: {
                    'CHARACTER#TESS': [{
                        DisplayProtocol: 'CommandTranscriptMessage',
                        CreatedTime: 2,
                        Message: ['look'],
                        MessageId: 'MESSAGE#command',
                        Target: 'CHARACTER#TESS'
                    }]
                }
            })
        })

        it('should add target entry when none exists', () => {
            expect(reducer(state, receiveMessages([{
                DisplayProtocol: 'WorldMessage',
                CreatedTime: 1,
                Message: ['Test message'],
                MessageId: 'Test',
                Target: 'CHARACTER#MARCO'
            }]))).toEqual({
                history: {
                    'CHARACTER#MARCO': [{
                        DisplayProtocol: 'WorldMessage',
                        CreatedTime: 1,
                        Message: ['Test message'],
                        MessageId: 'Test',
                        Target: 'CHARACTER#MARCO'
                    }],
                    'CHARACTER#TESS': testArray
                },
                aggregates: {
                    ...testAggregates,
                    'CHARACTER#MARCO': {
                        Test: { earliestCreatedTime: 1, latestCreatedTime: 1 }
                    }
                },
                presentation: {
                    ...testPresentation,
                    'CHARACTER#MARCO': [{
                        DisplayProtocol: 'WorldMessage',
                        CreatedTime: 1,
                        Message: ['Test message'],
                        MessageId: 'Test',
                        Target: 'CHARACTER#MARCO'
                    }]
                }
            })
        })

        it('should insert at start of array', () => {
            expect(reducer(state, receiveMessages([{
                DisplayProtocol: 'WorldMessage',
                CreatedTime: 1,
                Message: ['Test message'],
                MessageId: 'Test',
                Target: 'CHARACTER#TESS'
            }]))).toEqual({
                history: {
                    'CHARACTER#TESS': [{
                        DisplayProtocol: 'WorldMessage',
                        CreatedTime: 1,
                        Message: ['Test message'],
                        MessageId: 'Test',
                        Target: 'CHARACTER#TESS'
                    },
                    ...testArray
                ]
                },
                aggregates: {
                    ...testAggregates,
                    'CHARACTER#TESS': {
                        ...testAggregates['CHARACTER#TESS'],
                        Test: { earliestCreatedTime: 1, latestCreatedTime: 1 }
                    }
                },
                presentation: {
                    'CHARACTER#TESS': [{
                        DisplayProtocol: 'WorldMessage',
                        CreatedTime: 1,
                        Message: ['Test message'],
                        MessageId: 'Test',
                        Target: 'CHARACTER#TESS'
                    },
                    ...testArray
                    ]
                }
            })
        })

        it('should insert at end of array', () => {
            expect(reducer(state, receiveMessages([{
                DisplayProtocol: 'WorldMessage',
                CreatedTime: 200000,
                Message: ['Test message'],
                MessageId: 'Test',
                Target: 'CHARACTER#TESS'
            }]))).toEqual({
                history: {
                    'CHARACTER#TESS': [
                        ...testArray,
                        {
                            DisplayProtocol: 'WorldMessage',
                            CreatedTime: 200000,
                            Message: ['Test message'],
                            MessageId: 'Test',
                            Target: 'CHARACTER#TESS'
                        }
                    ]
                },
                aggregates: {
                    ...testAggregates,
                    'CHARACTER#TESS': {
                        ...testAggregates['CHARACTER#TESS'],
                        Test: { earliestCreatedTime: 200000, latestCreatedTime: 200000 }
                    }
                },
                presentation: {
                    'CHARACTER#TESS': [
                        ...testArray,
                        {
                            DisplayProtocol: 'WorldMessage',
                            CreatedTime: 200000,
                            Message: ['Test message'],
                            MessageId: 'Test',
                            Target: 'CHARACTER#TESS'
                        }
                    ]
                }
            })
        })

        it('should extend aggregate when second revision shares MessageId', () => {
            const base = reducer(undefined, receiveMessages([{
                DisplayProtocol: 'WorldMessage',
                CreatedTime: 100,
                Message: ['first'],
                MessageId: 'MESSAGE#rev',
                Target: 'CHARACTER#TESS'
            }]))
            expect(
                reducer(base, receiveMessages([{
                    DisplayProtocol: 'WorldMessage',
                    CreatedTime: 200,
                    Message: ['second'],
                    MessageId: 'MESSAGE#rev',
                    Target: 'CHARACTER#TESS'
                }]))
            ).toEqual({
                history: {
                    'CHARACTER#TESS': [
                        {
                            DisplayProtocol: 'WorldMessage',
                            CreatedTime: 100,
                            Message: ['first'],
                            MessageId: 'MESSAGE#rev',
                            Target: 'CHARACTER#TESS'
                        },
                        {
                            DisplayProtocol: 'WorldMessage',
                            CreatedTime: 200,
                            Message: ['second'],
                            MessageId: 'MESSAGE#rev',
                            Target: 'CHARACTER#TESS'
                        }
                    ]
                },
                aggregates: {
                    'CHARACTER#TESS': {
                        'MESSAGE#rev': { earliestCreatedTime: 100, latestCreatedTime: 200 }
                    }
                },
                presentation: {
                    'CHARACTER#TESS': [{
                        DisplayProtocol: 'WorldMessage',
                        CreatedTime: 100,
                        Message: ['second'],
                        MessageId: 'MESSAGE#rev',
                        Target: 'CHARACTER#TESS'
                    }]
                }
            })
        })

        it('should update earliest when later insert has earlier CreatedTime for same MessageId', () => {
            const base = reducer(undefined, receiveMessages([{
                DisplayProtocol: 'WorldMessage',
                CreatedTime: 100,
                Message: ['first'],
                MessageId: 'MESSAGE#rev',
                Target: 'CHARACTER#TESS'
            }]))
            expect(
                reducer(base, receiveMessages([{
                    DisplayProtocol: 'WorldMessage',
                    CreatedTime: 50,
                    Message: ['older'],
                    MessageId: 'MESSAGE#rev',
                    Target: 'CHARACTER#TESS'
                }]))
            ).toEqual({
                history: {
                    'CHARACTER#TESS': [
                        {
                            DisplayProtocol: 'WorldMessage',
                            CreatedTime: 50,
                            Message: ['older'],
                            MessageId: 'MESSAGE#rev',
                            Target: 'CHARACTER#TESS'
                        },
                        {
                            DisplayProtocol: 'WorldMessage',
                            CreatedTime: 100,
                            Message: ['first'],
                            MessageId: 'MESSAGE#rev',
                            Target: 'CHARACTER#TESS'
                        }
                    ]
                },
                aggregates: {
                    'CHARACTER#TESS': {
                        'MESSAGE#rev': { earliestCreatedTime: 50, latestCreatedTime: 100 }
                    }
                },
                presentation: {
                    'CHARACTER#TESS': [{
                        DisplayProtocol: 'WorldMessage',
                        CreatedTime: 50,
                        Message: ['first'],
                        MessageId: 'MESSAGE#rev',
                        Target: 'CHARACTER#TESS'
                    }]
                }
            })
        })

        it('should not change aggregates on idempotent replace of same CreatedTime and MessageId', () => {
            const msg = {
                DisplayProtocol: 'WorldMessage' as const,
                CreatedTime: 100,
                Message: ['first'],
                MessageId: 'MESSAGE#same',
                Target: 'CHARACTER#TESS' as const
            }
            const base = reducer(undefined, receiveMessages([msg]))
            expect(
                reducer(base, receiveMessages([{ ...msg, Message: ['replaced'] }]))
            ).toEqual({
                history: {
                    'CHARACTER#TESS': [{ ...msg, Message: ['replaced'] }]
                },
                aggregates: {
                    'CHARACTER#TESS': {
                        'MESSAGE#same': { earliestCreatedTime: 100, latestCreatedTime: 100 }
                    }
                },
                presentation: {
                    'CHARACTER#TESS': [{ ...msg, Message: ['replaced'] }]
                }
            })
        })
    })

    describe('getMessages proxy selector', () => {
        const testArray = [
            [2, 'Test-2'],
            [100, 'Test-B'],
            [100, 'Test-H'],
            [10000, 'Test-10000']
        ].map(([value, label]) => ({
            DisplayProtocol: 'WorldMessage',
            MessageId: label,
            Message: ['Test message'],
            CreatedTime: value,
            Target: 'CHARACTER#Test'
        })) as WorldMessage[]

        const state = {
            messages: {
                history: { 'CHARACTER#TESS': testArray },
                aggregates: {},
                presentation: {}
            }
        } as any

        it('should return values when available', () => {
            expect(getMessages(state)['CHARACTER#TESS']).toEqual(testArray)
        })

        it('should return empty array when target not available', () => {
            expect(getMessages(state)['CHARACTER#MARCO']).toEqual([])
        })

        it('should handle object.entries correctly', () => {
            expect(Object.entries(getMessages(state))).toEqual([['CHARACTER#TESS', testArray]])
        })
    })

    describe('getPresentation proxy selector', () => {
        const pres = [{
            DisplayProtocol: 'WorldMessage',
            MessageId: 'M1',
            Message: ['x'],
            CreatedTime: 1,
            Target: 'CHARACTER#TESS'
        }] as WorldMessage[]

        const state = {
            messages: {
                history: {},
                aggregates: {},
                presentation: { 'CHARACTER#TESS': pres }
            }
        } as any

        it('should return values when available', () => {
            expect(getPresentation(state)['CHARACTER#TESS']).toEqual(pres)
        })

        it('should return empty array when target not available', () => {
            expect(getPresentation(state)['CHARACTER#MARCO']).toEqual([])
        })

        it('should handle object.entries correctly', () => {
            expect(Object.entries(getPresentation(state))).toEqual([['CHARACTER#TESS', pres]])
        })
    })
})
