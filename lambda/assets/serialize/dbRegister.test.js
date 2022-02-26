import { jest, describe, it, expect } from '@jest/globals'

import { assetDB, mergeIntoDataRange } from '/opt/utilities/dynamoDB/index.js'

import { dbRegister } from './dbRegister.js'

describe('dbRegister', () => {
    it('should put a single element for a Character file', async () => {
        await dbRegister({
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            scopeMap: { TESS: '12345' },
            assets: [{
                tag: 'Character',
                key: 'TESS',
                Name: 'Tess',
                Pronouns: 'She/her',
                FirstImpression: 'Frumpy Goth',
                OneCoolThing: 'Fuchsia eyes',
                Outfit: 'A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.',
                player: 'TEST'
            }]
        })
        expect(assetDB.putItem).toHaveBeenCalledWith({
            AssetId: 'CHARACTER#12345',
            DataCategory: 'Meta::Character',
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            scopedId: 'TESS',
            player: 'TEST',
            Name: 'Tess',
            Pronouns: 'She/her',
            FirstImpression: 'Frumpy Goth',
            OneCoolThing: 'Fuchsia eyes',
            Outfit: 'A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.'
        })
    })

    it('should save meta, rooms, variables, and actions for Asset type', async () => {
        await dbRegister({
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            scopeMap: {
                Welcome: '12345',
                power: 'ABC',
                togglePower: 'DEF'
            },
            assets: [{
                tag: 'Asset',
                key: 'TEST',
                name: 'Test',
                zone: 'Library'
            },
            {
                tag: 'Room',
                key: 'Welcome',
            },
            {
                tag: 'Variable',
                key: 'power',
                default: true
            },
            {
                tag: 'Action',
                key: 'togglePower',
                src: 'power = !power'
            }]
        })
        expect(assetDB.putItem).toHaveBeenCalledWith({
            AssetId: 'ASSET#TEST',
            DataCategory: 'Meta::Asset',
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            name: 'Test',
            zone: 'Library'
        })
        expect(mergeIntoDataRange).toHaveBeenCalledWith({
            table: 'assets',
            search: { DataCategory: 'ASSET#TEST' },
            items: [{
                tag: 'Room',
                key: 'Welcome',
            },
            {
                tag: 'Variable',
                key: 'power',
                default: true
            },
            {
                tag: 'Action',
                key: 'togglePower',
                src: 'power = !power'
            }],
            mergeFunction: expect.any(Function),
            extractKey: expect.any(Function)
        })
    })

    it('should save meta, rooms, variables, and actions for Story type', async () => {
        await dbRegister({
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            scopeMap: {
                Welcome: '12345',
                power: 'ABC',
                togglePower: 'DEF'
            },
            assets: [{
                tag: 'Asset',
                Story: true,
                key: 'TEST',
                name: 'Test',
                zone: 'Library'
            },
            {
                tag: 'Room',
                key: 'Welcome',
            },
            {
                tag: 'Variable',
                key: 'power',
                default: true
            },
            {
                tag: 'Action',
                key: 'togglePower',
                src: 'power = !power'
            }]
        })
        expect(assetDB.putItem).toHaveBeenCalledWith({
            AssetId: 'ASSET#TEST',
            DataCategory: 'Meta::Asset',
            Story: true,
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            name: 'Test',
            zone: 'Library'
        })
        expect(mergeIntoDataRange).toHaveBeenCalledWith({
            table: 'assets',
            search: { DataCategory: 'ASSET#TEST' },
            items: [{
                tag: 'Room',
                key: 'Welcome',
            },
            {
                tag: 'Variable',
                key: 'power',
                default: true
            },
            {
                tag: 'Action',
                key: 'togglePower',
                src: 'power = !power'
            }],
            mergeFunction: expect.any(Function),
            extractKey: expect.any(Function)
        })
    })

    it('should save meta only for instanced Story type', async () => {
        await dbRegister({
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            scopeMap: {
                Welcome: '12345',
                power: 'ABC',
                togglePower: 'DEF'
            },
            assets: [{
                tag: 'Asset',
                Story: true,
                instance: true,
                key: 'TEST',
                name: 'Test',
                zone: 'Library'
            },
            {
                tag: 'Room',
                key: 'Welcome',
            },
            {
                tag: 'Variable',
                key: 'power',
                default: true
            },
            {
                tag: 'Action',
                key: 'togglePower',
                src: 'power = !power'
            }]
        })
        expect(assetDB.putItem).toHaveBeenCalledWith({
            AssetId: 'ASSET#TEST',
            DataCategory: 'Meta::Asset',
            Story: true,
            instance: true,
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            name: 'Test',
            zone: 'Library'
        })
        expect(mergeIntoDataRange).toHaveBeenCalledWith({
            table: 'assets',
            search: { DataCategory: 'ASSET#TEST' },
            items: [],
            mergeFunction: expect.any(Function),
            extractKey: expect.any(Function)
        })
    })
})