import { getCustomers } from '@/actions/customers'
import { CustomersClient } from './customers-client'

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const customers = await getCustomers(q)

  return (
    <div className="p-8">
      <CustomersClient customers={customers} searchQuery={q ?? ''} />
    </div>
  )
}
