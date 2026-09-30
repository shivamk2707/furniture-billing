import { draftInvoiceSchema } from './src/lib/validations/invoice';

const values = {
  invoice_date: '2025-01-01',
  due_date: null,
  place_of_supply: '27',
  reverse_charge: false,
  customer_id: null,
  customer_name: 'Test Customer',
  customer_gstin: null,
  customer_pan: null,
  customer_mobile: null,
  customer_email: null,
  customer_billing_addr: null,
  customer_shipping_addr: null,
  transporter_name: null,
  vehicle_number: null,
  transport_doc_number: null,
  transport_doc_date: null,
  eway_bill_number: null,
  eway_bill_date: null,
  irn: null,
  ack_number: null,
  ack_date: null,
  line_items: [
    {
      description: 'Test Item',
      hsn_sac: '',
      quantity: '1',
      unit: 'Pcs',
      unit_price: '100',
      discount_type: 'amount',
      discount_value: '0',
      tax_rate: '18',
      sort_order: 1
    },
    {
      description: '',
      hsn_sac: '',
      quantity: '1',
      unit: 'Pcs',
      unit_price: '0',
      discount_type: 'amount',
      discount_value: '0',
      tax_rate: '18',
      sort_order: 2
    }
  ]
};

const result = draftInvoiceSchema.safeParse(values);
console.log(JSON.stringify(result, null, 2));
