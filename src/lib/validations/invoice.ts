import { z } from 'zod'

const emptyToNull = z.string().transform(v => v === '' ? null : v).nullable().optional()

export const lineItemSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
  product_id: z.string().uuid().nullable().optional().or(z.literal('').transform(() => null)),
  description: z.string().min(1, 'Description is required'),
  hsn_sac: emptyToNull,
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unit: emptyToNull,
  unit_price: z.coerce.number().min(0, 'Price must be 0 or more'),
  discount_type: z.enum(['amount', 'percent']).default('amount'),
  discount_value: z.coerce.number().min(0).default(0),
  tax_rate: z.coerce.number().min(0).max(100).default(18),
  sort_order: z.number().int().default(0),
})



export const draftInvoiceSchema = z.object({
  invoice_date: emptyToNull,
  due_date: emptyToNull,
  place_of_supply: emptyToNull,
  reverse_charge: z.boolean().default(false),
  customer_id: z.string().uuid().nullable().optional().or(z.literal('').transform(() => null)),
  customer_name: emptyToNull,
  customer_gstin: emptyToNull,
  customer_pan: emptyToNull,
  customer_mobile: emptyToNull,
  customer_email: emptyToNull,
  customer_billing_addr: emptyToNull,
  customer_shipping_addr: emptyToNull,
  transporter_name: emptyToNull,
  vehicle_number: emptyToNull,
  transport_doc_number: emptyToNull,
  transport_doc_date: emptyToNull,
  eway_bill_number: emptyToNull,
  eway_bill_date: emptyToNull,
  irn: emptyToNull,
  ack_number: emptyToNull,
  ack_date: emptyToNull,
  line_items: z.array(lineItemSchema).default([]),
})

export type LineItemFormValues = z.infer<typeof lineItemSchema>
export type DraftInvoiceFormValues = z.infer<typeof draftInvoiceSchema>

export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra',
  '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
  '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar',
  '36': 'Telangana', '37': 'Andhra Pradesh (New)',
}
