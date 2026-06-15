jest.mock('../internalCache')
import internalCache from '../internalCache'

import { parseCommand } from '.'
import { CommandAPIMessage } from '@tonylb/mtw-interfaces/ts/ephemera'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)

describe('parseCommand', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('look commands', () => {
        beforeEach(() => {
            internalCacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#123',
                Name: 'Test Character',
                assets: ['Personal'],
                RoomId: 'ROOM#456',
                RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
                HomeId: 'ROOM#HOME'
            })
            
            // Mock the ComponentRender.get to return a StandardForm with embedded WML
            internalCacheMock.ComponentRender.get.mockResolvedValue(new StandardForm(`
                <Asset uuid=(render)>
                    <Room uuid=(ROOM#456)>
                        <Exit to=(ROOM#789)>north</Exit>
                        <Exit to=(ROOM#101)>south</Exit>
                        <Character uuid=(CHARACTER#123) />
                    </Room>
                </Asset>
            `, { standardizeMode: 'ephemeraWire' }))
        })

        it('should parse "look" command', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'look'
            }

            const result = await parseCommand(request)

            expect(result).toEqual({
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'CHARACTER#123',
                    EphemeraId: 'ROOM#456'
                }
            })
        })

        it('should parse "l" command', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'l'
            }

            const result = await parseCommand(request)

            expect(result).toEqual({
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'CHARACTER#123',
                    EphemeraId: 'ROOM#456'
                }
            })
        })

        it('should parse "look at door" command', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'look at door'
            }

            const result = await parseCommand(request)

            expect(result).toBeUndefined()
        })

        it('should parse "look at north" command', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'look at north'
            }

            const result = await parseCommand(request)

            expect(result).toEqual({
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'CHARACTER#123',
                    EphemeraId: 'ROOM#789'
                }
            })
        })

        it('should parse "look at south" command', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'look at south'
            }

            const result = await parseCommand(request)

            expect(result).toEqual({
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'CHARACTER#123',
                    EphemeraId: 'ROOM#101'
                }
            })
        })

        it('should NOT parse "look at character" command yet', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'look at character'
            }

            const result = await parseCommand(request)

            // The current implementation doesn't support looking at characters yet
            // This test confirms what the system should NOT do until extended
            expect(result).toBeUndefined()
        })
    })

    describe('move commands', () => {
        beforeEach(() => {
            internalCacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#123',
                Name: 'Test Character',
                assets: ['Personal'],
                RoomId: 'ROOM#456',
                RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
                HomeId: 'ROOM#HOME'
            })
            
            // Mock the ComponentRender.get to return a StandardForm with embedded WML
            internalCacheMock.ComponentRender.get.mockResolvedValue(new StandardForm(`
                <Asset uuid=(render)>
                    <Room uuid=(ROOM#456)>
                        <Exit to=(ROOM#789)>north</Exit>
                        <Exit to=(ROOM#101)>south</Exit>
                        <Character uuid=(CHARACTER#123) />
                    </Room>
                </Asset>
            `, { standardizeMode: 'ephemeraWire' }))
        })

        it('should NOT parse "move" command with direction', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'move north'
            }

            const result = await parseCommand(request)

            // The current implementation doesn't support "move" commands
            // This test confirms what the system should NOT do
            expect(result).toBeUndefined()
        })

        it('should NOT parse "move south" command', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'move south'
            }

            const result = await parseCommand(request)

            // The current implementation doesn't support "move" commands
            // This test confirms what the system should NOT do
            expect(result).toBeUndefined()
        })

        it('should parse "go north" command', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'go north'
            }

            const result = await parseCommand(request)

            expect(result).toEqual({
                message: 'action',
                actionType: 'move',
                payload: {
                    CharacterId: 'CHARACTER#123',
                    RoomId: 'ROOM#789',
                    ExitName: 'north'
                }
            })
        })

        it('should parse "go south" command', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'go south'
            }

            const result = await parseCommand(request)

            expect(result).toEqual({
                message: 'action',
                actionType: 'move',
                payload: {
                    CharacterId: 'CHARACTER#123',
                    RoomId: 'ROOM#101',
                    ExitName: 'south'
                }
            })
        })
    })

    describe('communication commands', () => {
        beforeEach(() => {
            internalCacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#123',
                Name: 'Test Character',
                assets: ['Personal'],
                RoomId: 'ROOM#456',
                RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
                HomeId: 'ROOM#HOME'
            })
            
            // Mock the ComponentRender.get to return a StandardForm with embedded WML
            internalCacheMock.ComponentRender.get.mockResolvedValue(new StandardForm(`
                <Asset uuid=(render)>
                    <Room uuid=(ROOM#456)>
                        <Exit to=(ROOM#789)>north</Exit>
                        <Exit to=(ROOM#101)>south</Exit>
                        <Character uuid=(CHARACTER#123) />
                    </Room>
                </Asset>
            `, { standardizeMode: 'ephemeraWire' }))
        })

        it('should NOT parse "say" command yet', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'say Hello'
            }

            const result = await parseCommand(request)

            // The current implementation doesn't support communication commands yet
            // This test confirms what the system should NOT do until extended
            expect(result).toBeUndefined()
        })

        it('should NOT parse "narrate" command yet', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'narrate Hello'
            }

            const result = await parseCommand(request)

            // The current implementation doesn't support communication commands yet
            // This test confirms what the system should NOT do until extended
            expect(result).toBeUndefined()
        })

        it('should NOT parse "ooc" command yet', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'ooc Hello'
            }

            const result = await parseCommand(request)

            // The current implementation doesn't support communication commands yet
            // This test confirms what the system should NOT do until extended
            expect(result).toBeUndefined()
        })

        it('should NOT parse "whisper" command yet', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'whisper TestCharacter Hello'
            }

            const result = await parseCommand(request)

            // The current implementation doesn't support communication commands yet
            // This test confirms what the system should NOT do until extended
            expect(result).toBeUndefined()
        })

        it('should NOT parse "shout" command yet', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'shout Hello'
            }

            const result = await parseCommand(request)

            // The current implementation doesn't support communication commands yet
            // This test confirms what the system should NOT do until extended
            expect(result).toBeUndefined()
        })

        it('should NOT parse "emote" command yet', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'emote waves'
            }

            const result = await parseCommand(request)

            // The current implementation doesn't support communication commands yet
            // This test confirms what the system should NOT do until extended
            expect(result).toBeUndefined()
        })
    })

    describe('edge cases', () => {
        beforeEach(() => {
            internalCacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#123',
                Name: 'Test Character',
                assets: ['Personal'],
                RoomId: 'ROOM#456',
                RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
                HomeId: 'ROOM#HOME'
            })
            
            // Mock the ComponentRender.get to return a StandardForm with embedded WML
            internalCacheMock.ComponentRender.get.mockResolvedValue(new StandardForm(`
                <Asset uuid=(render)>
                    <Room uuid=(ROOM#456)>
                        <Exit to=(ROOM#789)>north</Exit>
                        <Exit to=(ROOM#101)>south</Exit>
                        <Character uuid=(CHARACTER#123) />
                    </Room>
                </Asset>
            `, { standardizeMode: 'ephemeraWire' }))
        })

        it('should handle empty command gracefully', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: ''
            }

            const result = await parseCommand(request)

            expect(result).toBeUndefined()
        })

        it('should handle whitespace-only command gracefully', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: '   '
            }

            const result = await parseCommand(request)

            expect(result).toBeUndefined()
        })

        it('should handle unknown command gracefully', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'unknown command'
            }

            const result = await parseCommand(request)

            expect(result).toBeUndefined()
        })

        it('should handle command with extra whitespace', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: '  look  '
            }

            const result = await parseCommand(request)

            expect(result).toEqual({
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'CHARACTER#123',
                    EphemeraId: 'ROOM#456'
                }
            })
        })
    })

    describe('case sensitivity', () => {
        beforeEach(() => {
            internalCacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#123',
                Name: 'Test Character',
                assets: ['Personal'],
                RoomId: 'ROOM#456',
                RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
                HomeId: 'ROOM#HOME'
            })
            
            // Mock the ComponentRender.get to return a StandardForm with embedded WML
            internalCacheMock.ComponentRender.get.mockResolvedValue(new StandardForm(`
                <Asset uuid=(render)>
                    <Room uuid=(ROOM#456)>
                        <Exit to=(ROOM#789)>north</Exit>
                        <Exit to=(ROOM#101)>south</Exit>
                        <Character uuid=(CHARACTER#123) />
                    </Room>
                </Asset>
            `, { standardizeMode: 'ephemeraWire' }))
        })

        it('should handle mixed case commands', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'LoOk'
            }

            const result = await parseCommand(request)

            expect(result).toEqual({
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'CHARACTER#123',
                    EphemeraId: 'ROOM#456'
                }
            })
        })

        it('should handle uppercase commands', async () => {
            const request: CommandAPIMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                command: 'LOOK'
            }

            const result = await parseCommand(request)

            expect(result).toEqual({
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'CHARACTER#123',
                    EphemeraId: 'ROOM#456'
                }
            })
        })
    })
})
