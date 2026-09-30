/**
 * Property test: GSTIN validation
 *
 * Feature: furniture-billing, Property 8: GSTIN validation
 * Validates: Requirements 2.7
 *
 * The GSTIN format: ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$
 * Example: 09AAACP1234A1Z5
 *   - 2 digits  : state code (09)
 *   - 5 letters : PAN chars 1-5 (AAACP)
 *   - 4 digits  : PAN chars 6-9 (1234)
 *   - 1 letter  : PAN char 10 (A)
 *   - 1 char    : entity code [1-9A-Z] (1)
 *   - literal Z : check char type indicator
 *   - 1 char    : checksum [0-9A-Z] (5)
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { isValidGstin } from '../settings'

// Arbitraries for building valid GSTIN components
const stateCode = fc.integer({ min: 1, max: 37 }).map((n) => String(n).padStart(2, '0'))
const upperAlpha = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))
const digit = fc.constantFrom(...'0123456789'.split(''))
const entityCode = fc.constantFrom(...'123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))
const checksumChar = fc.constantFrom(...'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))

const validGstinArb = fc.tuple(
  stateCode,                                   // 2 digits
  fc.array(upperAlpha, { minLength: 5, maxLength: 5 }), // 5 letters
  fc.array(digit, { minLength: 4, maxLength: 4 }),       // 4 digits
  upperAlpha,                                  // 1 letter
  entityCode,                                  // entity code
  fc.constant('Z'),                            // literal Z
  checksumChar                                 // checksum
).map(([sc, letters, digits, letter, entity, z, check]) =>
  sc + letters.join('') + digits.join('') + letter + entity + z + check
)

describe('GSTIN validator (Property 8)', () => {
  it('accepts all correctly-structured GSTINs', () => {
    // Feature: furniture-billing, Property 8: GSTIN validation
    fc.assert(
      fc.property(validGstinArb, (gstin) => {
        expect(isValidGstin(gstin)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('rejects strings that are too short', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 14 }), (s) => {
        // A string shorter than 15 chars can never be a valid GSTIN
        if (s.length < 15) {
          expect(isValidGstin(s)).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('rejects strings that are too long', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 16, maxLength: 30 }), (s) => {
        expect(isValidGstin(s)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('rejects valid GSTIN with lowercase letters', () => {
    fc.assert(
      fc.property(validGstinArb, (gstin) => {
        // Lowercase version must fail (pattern requires [A-Z])
        const lower = gstin.toLowerCase()
        // Only reject if it actually changed (digits stay same)
        if (lower !== gstin) {
          expect(isValidGstin(lower)).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })

  // Known valid examples from the spec
  it('accepts known valid GSTINs', () => {
    expect(isValidGstin('09AAACP1234A1Z5')).toBe(true)
    expect(isValidGstin('27CCCAI9012C3Z3')).toBe(true)
    expect(isValidGstin('09BBBCS5678B2Z4')).toBe(true)
  })

  // Known invalid examples
  it('rejects known invalid GSTINs', () => {
    expect(isValidGstin('')).toBe(false)
    expect(isValidGstin('INVALID')).toBe(false)
    expect(isValidGstin('09AAACP1234A1Z')).toBe(false)   // 14 chars — too short
    expect(isValidGstin('09aaacp1234a1z5')).toBe(false)  // lowercase — pattern requires [A-Z]
    expect(isValidGstin('09AAACP1234A0Z5')).toBe(false)  // entity code 0 — must be [1-9A-Z]
  })
})
