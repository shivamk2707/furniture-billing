import { getCompanySettings } from '@/actions/settings'
import { InvoiceEditor } from '@/components/invoice/invoice-editor'

export default async function NewInvoicePage() {
  const settings = await getCompanySettings()

  return (
    <div className="h-screen flex flex-col p-4">
      <InvoiceEditor companySettings={settings} />
    </div>
  )
}
