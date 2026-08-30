'use client'

import {
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation'
import FilterBar, {
  type FilterBarProps,
  type FilterValues,
} from '@/components/listing/FilterBar'

const FILTER_DEFAULTS: FilterValues = {
  category: 'all',
  priceRange: 'all',
  sort: 'featured',
}

const FILTER_KEYS: Array<keyof FilterValues> = [
  'category',
  'priceRange',
  'sort',
]

interface FilterBarConnectorProps {
  initialValues?: FilterBarProps['initialValues']
  hiddenFilters?: FilterBarProps['hiddenFilters']
  className?: FilterBarProps['className']
}

export default function FilterBarConnector({
  initialValues,
  hiddenFilters = [],
  className,
}: FilterBarConnectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(values: FilterValues) {
    const params = new URLSearchParams(searchParams)

    for (const key of FILTER_KEYS) {
      if (hiddenFilters.includes(key)) {
        params.delete(key)
        continue
      }

      const value = values[key]
      if (value === FILTER_DEFAULTS[key]) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <FilterBar
      initialValues={initialValues}
      hiddenFilters={hiddenFilters}
      className={className}
      onChange={handleChange}
    />
  )
}
