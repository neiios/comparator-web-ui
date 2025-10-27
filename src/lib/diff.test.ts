import { describe, expect, it } from 'vitest'
import { analyzeJson } from './diff'

describe('analyzeJson', () => {
  it('returns no differences when expected and actual match', () => {
    const payload = JSON.stringify({
      expected: { foo: 'bar', nested: { value: 10 } },
      actual: { foo: 'bar', nested: { value: 10 } },
    })

    const result = analyzeJson(payload)

    expect(result.differences).toHaveLength(0)
    expect(result.expected).toEqual({ foo: 'bar', nested: { value: 10 } })
    expect(result.actual).toEqual({ foo: 'bar', nested: { value: 10 } })
    expect(result.unifiedDiff).toBe('')
  })

  it('detects missing and extra keys between expected and actual', () => {
    const payload = JSON.stringify({
      compare_item: {
        expected: {
          item: {
            price: 5,
            currency: 'USD',
          },
        },
        actual: {
          item: {
            price: 7,
            currency: 'USD',
            discount: 1,
          },
        },
      },
    })

    const result = analyzeJson(payload)

    expect(result.differences).toEqual([
      {
        path: 'item.price',
        type: 'mismatch',
        expected: 5,
        actual: 7,
      },
      {
        path: 'item.discount',
        type: 'extra',
        actual: 1,
      },
    ])

    expect(result.unifiedDiff).toContain('--- expected.json')
    expect(result.unifiedDiff).toContain('+++ actual.json')
    expect(result.unifiedDiff).toMatch(/-\s+"price": 5/)
    expect(result.unifiedDiff).toMatch(/\+\s+"price": 7/)
    expect(result.unifiedDiff).toMatch(/\+\s+"discount": 1/)
    expect(result.unifiedDiff).toMatch(/\s+"currency": "USD"/)
  })

  it('detects array differences with missing entries', () => {
    const payload = JSON.stringify({
      expected: {
        items: [
          { id: 1, value: 'a' },
          { id: 2, value: 'b' },
        ],
      },
      actual: {
        items: [
          { id: 1, value: 'a' },
        ],
      },
    })

    const result = analyzeJson(payload)

    expect(result.differences).toContainEqual({
      path: 'items[1]',
      type: 'missing',
      expected: { id: 2, value: 'b' },
    })
  })

  it('throws when input JSON cannot be parsed', () => {
    expect(() => analyzeJson('{not valid json')).toThrow(/unable to parse/i)
  })

  it('throws when expected or actual sections are missing', () => {
    const payload = JSON.stringify({ actual: {} })
    expect(() => analyzeJson(payload)).toThrow(/must include "expected" and "actual"/i)
  })
})
