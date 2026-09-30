import { getInvoices } from '@/actions/invoices'
import { getActiveCompany } from '@/lib/auth/require-role'
import { notFound } from 'next/navigation'
import { InvoicesClient } from './invoices-client'

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    payment?: string
    from?: string
    to?: string
    page?: string
  }>
}) {
  const params = await searchParams
  const page = Number(params.page ?? 1)
  const pageSize = 20

  const auth = await getActiveCompany()
  if (!auth) notFound()

  const { invoices, total } = await getInvoices({
    search: params.q,
    status: params.status,
    paymentStatus: params.payment,
    dateFrom: params.from,
    dateTo: params.to,
    page,
    pageSize,
  })

  return (
    <div className="p-8">
      <InvoicesClient
        invoices={invoices}
        total={total}
        page={page}
        pageSize={pageSize}
        searchQuery={params.q ?? ''}
        statusFilter={params.status ?? ''}
        paymentFilter={params.payment ?? ''}
        role={auth.role}
      />
    </div>
  )
}
