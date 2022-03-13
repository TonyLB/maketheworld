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
                zone: 'Library',
                Name: 'Tess',
                fileURL: 'testIcon.png',
                Pronouns: {
                    subject: 'she',
                    object: 'her',
                    possessive: 'her',
                    adjective: 'hers',
                    reflexive: 'herself'
                },
                FirstImpression: 'Frumpy Goth',
                OneCoolThing: 'Fuchsia eyes',
                Outfit: 'A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.',
                player: 'TEST'
            }]
        })
        expect(assetDB.putItem).toHaveBeenCalledWith({
            AssetId: 'CHARACTER#12345',
            DataCategory: 'Meta::Character',
            zone: 'Library',
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            scopedId: 'TESS',
            player: 'TEST',
            fileURL: 'testIcon.png',
            Name: 'Tess',
            Pronouns: {
                subject: 'she',
                object: 'her',
                possessive: 'her',
                adjective: 'hers',
                reflexive: 'herself'
            },
            FirstImpression: 'Frumpy Goth',
            OneCoolThing: 'Fuchsia eyes',
            Outfit: 'A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.'
        })
    })

    it('should save meta, rooms for Asset type', async () => {
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
                tag: 'Map',
                key: 'Village'
            },
            {
                tag: 'Room',
                key: 'Welcome',
            },
            {
                tag: 'Feature',
                key: 'clockTower'
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
                tag: 'Map',
                key: 'Village'
            },
            {
                tag: 'Room',
                key: 'Welcome'
            },
            {
                tag: 'Feature',
                key: 'clockTower'
            }],
            mergeFunction: expect.any(Function),
            extractKey: expect.any(Function)
        })
    })

    it('should save meta, rooms for Story type', async () => {
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