'use client'

/**
 * InvoicePreview — Wraps InvoiceTemplate in a CSS-scaled container
 * so the A4 page fits inside the invoice editor sidebar.
 *
 * The inner template is always 794px wide (96dpi A4).
 * The outer container constrains width and applies a CSS scale transform.
 */

import { InvoiceTemplate } from './invoice-template'
import type { InvoiceData } from '@/lib/invoice-types'

interface Props {
  data: InvoiceData
  /** Container width in px. Template scales to fit. Default: 420 */
  containerWidth?: number
}

export function InvoicePreview({ data, containerWidth = 420 }: Props) {
  const TEMPLATE_WIDTH = 794
  const scale = containerWidth / TEMPLATE_WIDTH

  return (
    <div
      style={{
        width: `${containerWidth}px`,
        overflow: 'hidden',
        // Height scales proportionally with the A4 ratio
        // Min-height so the container doesn't collapse
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${TEMPLATE_WIDTH}px`,
        }}
      >
        <InvoiceTemplate data={data} />
      </div>
    </div>
  )
}
