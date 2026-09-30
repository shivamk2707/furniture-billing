import { getProducts } from '@/actions/products'
import { ProductsClient } from './products-client'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const products = await getProducts(q)

  return (
    <div className="p-8">
      <ProductsClient products={products} searchQuery={q ?? ''} />
    </div>
  )
}
