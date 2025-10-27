import { createTwoFilesPatch } from 'diff'

export type DiffType = 'missing' | 'extra' | 'mismatch'

export interface DiffEntry {
  path: string
  type: DiffType
  expected?: unknown
  actual?: unknown
}

export interface DiffResult {
  expected: JsonValue
  actual: JsonValue
  differences: DiffEntry[]
  unifiedDiff: string
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

const isRecord = (value: unknown): value is Record<string, JsonValue> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const makePath = (base: string, key: string | number, isArray = false): string => {
  if (!base) {
    return isArray ? `[${key}]` : String(key)
  }

  return isArray ? `${base}[${key}]` : `${base}.${key}`
}

const formatJson = (value: JsonValue) => JSON.stringify(value, null, 2)

const computeDiff = (
  expected: JsonValue,
  actual: JsonValue,
  path = '',
): DiffEntry[] => {
  if (Object.is(expected, actual)) {
    return []
  }

  const expectedIsArray = Array.isArray(expected)
  const actualIsArray = Array.isArray(actual)

  if (expectedIsArray || actualIsArray) {
    if (!expectedIsArray || !actualIsArray) {
      return [
        {
          path: path || 'root',
          type: 'mismatch',
          expected,
          actual,
        },
      ]
    }

    const maxLength = Math.max(expected.length, actual.length)
    const diffs: DiffEntry[] = []

    for (let index = 0; index < maxLength; index += 1) {
      const nextPath = makePath(path, index, true)

      if (index >= expected.length) {
        diffs.push({
          path: nextPath,
          type: 'extra',
          actual: actual[index],
        })
        continue
      }

      if (index >= actual.length) {
        diffs.push({
          path: nextPath,
          type: 'missing',
          expected: expected[index],
        })
        continue
      }

      diffs.push(...computeDiff(expected[index], actual[index], nextPath))
    }

    return diffs
  }

  const expectedIsRecord = isRecord(expected)
  const actualIsRecord = isRecord(actual)

  if (expectedIsRecord || actualIsRecord) {
    if (!expectedIsRecord || !actualIsRecord) {
      return [
        {
          path: path || 'root',
          type: 'mismatch',
          expected,
          actual,
        },
      ]
    }

    const diffs: DiffEntry[] = []
    const keys = new Set([
      ...Object.keys(expected),
      ...Object.keys(actual),
    ])

    for (const key of keys) {
      const nextPath = makePath(path, key)

      if (!(key in actual)) {
        diffs.push({
          path: nextPath,
          type: 'missing',
          expected: expected[key],
        })
        continue
      }

      if (!(key in expected)) {
        diffs.push({
          path: nextPath,
          type: 'extra',
          actual: actual[key],
        })
        continue
      }

      diffs.push(...computeDiff(expected[key], actual[key], nextPath))
    }

    return diffs
  }

  return [
    {
      path: path || 'root',
      type: 'mismatch',
      expected,
      actual,
    },
  ]
}

export const analyzeJson = (raw: string): DiffResult => {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error('Invalid JSON: unable to parse input')
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('Parsed input must be a JSON object')
  }

  const parsedRecord = parsed as Record<string, unknown>

  const candidate = parsedRecord['compare_item']
  const container =
    typeof candidate === 'object' && candidate !== null
      ? (candidate as Record<string, unknown>)
      : parsedRecord

  const expected = container['expected']
  const actual = container['actual']

  if (expected === undefined || actual === undefined) {
    throw new Error(
      'Input JSON must include "expected" and "actual" sections either at the root or inside "compare_item".',
    )
  }

  const expectedValue = expected as JsonValue
  const actualValue = actual as JsonValue

  const differences = computeDiff(expectedValue, actualValue)

  const expectedText = formatJson(expectedValue)
  const actualText = formatJson(actualValue)
  const context = Math.max(
    expectedText.split('\n').length,
    actualText.split('\n').length,
  )

  const unifiedDiff =
    differences.length > 0
      ? createTwoFilesPatch(
          'expected.json',
          'actual.json',
          expectedText,
          actualText,
          '',
          '',
          { context },
        )
      : ''

  return {
    expected: expectedValue,
    actual: actualValue,
    differences,
    unifiedDiff,
  }
}
