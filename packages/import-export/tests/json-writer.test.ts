import { describe, it, expect } from 'vitest'
import { toStableJson } from '../src/json-writer.js'

describe('toStableJson', () => {
  it('produces deterministic output regardless of input key order', () => {
    const a = { b: 1, a: 2, c: 3 }
    const b = { c: 3, a: 2, b: 1 }
    expect(toStableJson(a)).toBe(toStableJson(b))
  })

  it('is idempotent — same input always produces same output', () => {
    const input = { name: 'test', version: '1.0.0', nested: { z: 1, a: 2 } }
    expect(toStableJson(input)).toBe(toStableJson(input))
  })

  it('sorts nested object keys at every level', () => {
    const input = { z: { b: 1, a: 2 }, a: { d: 4, c: 3 } }
    const result = JSON.parse(toStableJson(input)) as Record<string, Record<string, number>>
    expect(Object.keys(result)).toEqual(['a', 'z'])
    expect(Object.keys(result['a'])).toEqual(['c', 'd'])
    expect(Object.keys(result['z'])).toEqual(['a', 'b'])
  })

  it('preserves array element order — arrays are not sorted', () => {
    const input = { items: [3, 1, 2] }
    const result = JSON.parse(toStableJson(input)) as { items: number[] }
    expect(result.items).toEqual([3, 1, 2])
  })

  it('handles arrays of objects with stable key sorting per element', () => {
    const input = {
      ops: [
        { path: '/b', method: 'GET' },
        { method: 'POST', path: '/a' }
      ]
    }
    const result = JSON.parse(toStableJson(input)) as {
      ops: Array<Record<string, string>>
    }
    expect(Object.keys(result.ops[0]!)).toEqual(['method', 'path'])
    expect(Object.keys(result.ops[1]!)).toEqual(['method', 'path'])
  })

  it('handles null values without throwing', () => {
    const input = { a: null, b: 'value' }
    const result = toStableJson(input)
    expect(result).toContain('"a": null')
    expect(result).toContain('"b": "value"')
  })

  it('appends a trailing newline', () => {
    expect(toStableJson({ a: 1 }).endsWith('\n')).toBe(true)
  })

  it('handles deeply nested mixed structures', () => {
    const input = {
      z: [{ b: 2, a: 1 }, { d: 4, c: 3 }],
      a: { level2: { z: 'last', a: 'first' } }
    }
    const result = JSON.parse(toStableJson(input)) as Record<string, unknown>
    expect(Object.keys(result)).toEqual(['a', 'z'])
    const nested = (result['a'] as Record<string, Record<string, string>>)['level2']!
    expect(Object.keys(nested)).toEqual(['a', 'z'])
  })

  it('two calls on structurally equal objects with different key insertion order match byte-for-byte', () => {
    const first = JSON.stringify({ x: 1, a: 2 })
    const second = JSON.stringify({ a: 2, x: 1 })
    const obj1 = JSON.parse(first) as unknown
    const obj2 = JSON.parse(second) as unknown
    expect(toStableJson(obj1)).toBe(toStableJson(obj2))
  })
})
