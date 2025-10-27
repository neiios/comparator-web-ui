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

type PathSegment =
  | { kind: 'property'; key: string }
  | { kind: 'array'; index: number | '*' }

const isRecord = (value: unknown): value is Record<string, JsonValue> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const makePath = (base: string, key: string | number, isArray = false): string => {
  if (!base) {
    return isArray ? `[${key}]` : String(key)
  }

  return isArray ? `${base}[${key}]` : `${base}.${key}`
}

const formatJson = (value: JsonValue) => JSON.stringify(value, null, 2)

const deepClone = <T extends JsonValue>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T

const parseIgnorePath = (path: string): PathSegment[] | null => {
  const trimmed = path.trim()

  if (!trimmed) {
    return null
  }

  const segments: PathSegment[] = []
  let buffer = ''

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index]

    if (char === '.') {
      if (buffer) {
        segments.push({ kind: 'property', key: buffer })
        buffer = ''
      }
      continue
    }

    if (char === '[') {
      if (buffer) {
        segments.push({ kind: 'property', key: buffer })
        buffer = ''
      }

      const closingIndex = trimmed.indexOf(']', index)

      if (closingIndex === -1) {
        return null
      }

      const content = trimmed.slice(index + 1, closingIndex).trim()

      if (!content) {
        return null
      }

      if (content === '*') {
        segments.push({ kind: 'array', index: '*' })
      } else {
        const numericIndex = Number.parseInt(content, 10)

        if (Number.isNaN(numericIndex)) {
          return null
        }

        segments.push({ kind: 'array', index: numericIndex })
      }

      index = closingIndex
      continue
    }

    buffer += char
  }

  if (buffer) {
    segments.push({ kind: 'property', key: buffer })
  }

  return segments
}

const applyIgnoreSegments = (value: JsonValue, segments: PathSegment[]): void => {
  if (!segments.length) {
    return
  }

  const applyAtNode = (node: JsonValue, segmentIndex: number): void => {
    if (segmentIndex >= segments.length) {
      return
    }

    const segment = segments[segmentIndex]

    if (segment.kind === 'property') {
      if (!isRecord(node) || !(segment.key in node)) {
        return
      }

      if (segmentIndex === segments.length - 1) {
        delete node[segment.key]
        return
      }

      applyAtNode(node[segment.key] as JsonValue, segmentIndex + 1)
      return
    }

    if (!Array.isArray(node)) {
      return
    }

    if (segment.index === '*') {
      if (segmentIndex === segments.length - 1) {
        node.length = 0
        return
      }

      for (const item of node) {
        if (item !== undefined) {
          applyAtNode(item as JsonValue, segmentIndex + 1)
        }
      }

      return
    }

    const targetIndex = segment.index

    if (targetIndex < 0 || targetIndex >= node.length) {
      return
    }

    if (segmentIndex === segments.length - 1) {
      node.splice(targetIndex, 1)
      return
    }

    applyAtNode(node[targetIndex] as JsonValue, segmentIndex + 1)
  }

  const traverse = (node: JsonValue): void => {
    applyAtNode(node, 0)

    if (Array.isArray(node)) {
      for (const item of node) {
        if (item !== undefined) {
          traverse(item as JsonValue)
        }
      }
      return
    }

    if (isRecord(node)) {
      for (const value of Object.values(node)) {
        if (value !== undefined) {
          traverse(value as JsonValue)
        }
      }
    }
  }

  traverse(value)
}

const applyIgnorePathsToClone = <T extends JsonValue>(value: T, ignorePaths: string[]): T => {
  if (!ignorePaths.length) {
    return value
  }

  const clone = deepClone(value)

  for (const path of ignorePaths) {
    const segments = parseIgnorePath(path)

    if (!segments || !segments.length) {
      continue
    }

    applyIgnoreSegments(clone as JsonValue, segments)
  }

  return clone
}

const collectIgnorePaths = (rawConfig?: string): string[] => {
  if (!rawConfig) {
    return []
  }

  const trimmed = rawConfig.trim()

  if (!trimmed) {
    return []
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(trimmed)
  } catch (error) {
    throw new Error('Invalid configuration JSON: unable to parse input')
  }

  const result = new Set<string>()

  const visit = (node: unknown) => {
    if (node === null) {
      return
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item)
      }
      return
    }

    if (typeof node !== 'object') {
      return
    }

    const entries = Object.entries(node as Record<string, unknown>)

    for (const [key, value] of entries) {
      if (key === 'ignore_paths') {
        if (!Array.isArray(value)) {
          throw new Error('Invalid configuration JSON: "ignore_paths" must be an array of strings')
        }

        for (const entry of value) {
          if (typeof entry !== 'string') {
            throw new Error('Invalid configuration JSON: "ignore_paths" must be an array of strings')
          }

          const normalized = entry.trim()

          if (normalized) {
            result.add(normalized)
          }
        }

        continue
      }

      if (value && typeof value === 'object') {
        visit(value)
      }
    }
  }

  visit(parsed)

  return Array.from(result)
}

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

export const analyzeJson = (payload: string, configRaw?: string): DiffResult => {
  let parsed: unknown

  try {
    parsed = JSON.parse(payload)
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

  const ignorePaths = collectIgnorePaths(configRaw)

  const expectedForDiff = applyIgnorePathsToClone(expectedValue, ignorePaths)
  const actualForDiff = applyIgnorePathsToClone(actualValue, ignorePaths)

  const differences = computeDiff(expectedForDiff, actualForDiff)

  const expectedText = formatJson(expectedForDiff)
  const actualText = formatJson(actualForDiff)
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
