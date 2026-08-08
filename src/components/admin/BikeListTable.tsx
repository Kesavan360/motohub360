'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

export interface BikeListItem {
  _id: string
  slug: string
  brandSlug: string
  brandName: string
  name: string
  tagline: string
  category: string
  status: 'draft' | 'published'
  pricing: {
    exShowroom: number
    onRoad?: number
  }
  heroImageUrl: string
  publishedAt?: string | null
  createdAt: string
  updatedAt?: string
}

interface BikeListTableProps {
  bikes: BikeListItem[]
}

export default function BikeListTable({
  bikes: initialBikes,
}: BikeListTableProps) {
  const [bikes, setBikes] = useState(initialBikes)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'draft' | 'published'
  >('all')
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const filteredBikes = useMemo(() => {
    const query = search.trim().toLowerCase()

    return bikes.filter((bike) => {
      const matchesSearch =
        !query ||
        bike.name.toLowerCase().includes(query) ||
        bike.brandName.toLowerCase().includes(query) ||
        bike.category.toLowerCase().includes(query)

      const matchesStatus =
        statusFilter === 'all' || bike.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [bikes, search, statusFilter])

  async function toggleStatus(bike: BikeListItem) {
    setLoadingId(bike._id)

    try {
      const response = await fetch(
        `/api/admin/bikes/${bike._id}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      const data = await response.json()

      setBikes((current) =>
        current.map((item) =>
          item._id === bike._id
            ? {
                ...item,
                status: data.status,
                publishedAt: data.publishedAt ?? item.publishedAt,
                updatedAt: data.updatedAt ?? item.updatedAt,
              }
            : item,
        ),
      )
    } catch (error) {
      console.error(error)
      alert('Failed to update bike status.')
    } finally {
      setLoadingId(null)
    }
  }

  async function deleteBike(bike: BikeListItem) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${bike.name}"?`,
    )

    if (!confirmed) {
      return
    }

    setLoadingId(bike._id)

    try {
      const response = await fetch(
        `/api/bikes/${bike._id}`,
        {
          method: 'DELETE',
        },
      )

      if (!response.ok) {
        throw new Error('Failed to delete bike')
      }

      setBikes((current) =>
        current.filter((item) => item._id !== bike._id),
      )
    } catch (error) {
      console.error(error)
      alert('Failed to delete bike.')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Bikes
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            Manage all motorcycle entries in MotoHub360.
          </p>
        </div>

        <Link
          href="/admin/bikes/new"
          className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
        >
          + Add New Bike
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row">
        <input
          type="search"
          placeholder="Search bikes, brands or categories..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-900 sm:flex-1"
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value as 'all' | 'draft' | 'published',
            )
          }
          className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-900"
        >
          <option value="all">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {/* Result count */}
      <div className="text-sm text-zinc-500">
        Showing {filteredBikes.length} of {bikes.length} bikes
      </div>

      {/* Empty state */}
      {filteredBikes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
          <h2 className="text-lg font-medium text-zinc-900">
            {bikes.length === 0
              ? 'No bikes found'
              : 'No matching bikes'}
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            {bikes.length === 0
              ? 'Create your first bike to get started.'
              : 'Try changing your search or status filter.'}
          </p>

          {bikes.length === 0 && (
            <Link
              href="/admin/bikes/new"
              className="mt-5 inline-flex rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Add New Bike
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full text-left">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                <tr>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Bike
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Brand
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Category
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Price
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Status
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Updated
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {filteredBikes.map((bike) => (
                  <tr
                    key={bike._id}
                    className="transition hover:bg-zinc-50"
                  >
                    {/* Bike */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-20 overflow-hidden rounded-lg bg-zinc-100">
                          {bike.heroImageUrl ? (
                            <img
                              src={bike.heroImageUrl}
                              alt={bike.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                              No image
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="font-medium text-zinc-900">
                            {bike.name}
                          </p>

                          <p className="mt-0.5 text-xs text-zinc-500">
                            {bike.slug}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Brand */}
                    <td className="px-5 py-4 text-sm text-zinc-700">
                      {bike.brandName}
                    </td>

                    {/* Category */}
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium capitalize text-zinc-700">
                        {bike.category}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="px-5 py-4 text-sm font-medium text-zinc-900">
                      ₹{bike.pricing.exShowroom.toLocaleString('en-IN')}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        disabled={loadingId === bike._id}
                        onClick={() => toggleStatus(bike)}
                        className="disabled:cursor-not-allowed disabled:opacity-50"
                        title="Toggle publish status"
                      >
                        <span
                          className={
                            bike.status === 'published'
                              ? 'rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700'
                              : 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700'
                          }
                        >
                          {bike.status === 'published'
                            ? 'Published'
                            : 'Draft'}
                        </span>
                      </button>
                    </td>

                    {/* Updated */}
                    <td className="px-5 py-4 text-sm text-zinc-500">
                      {new Date(
                        bike.updatedAt ?? bike.createdAt,
                      ).toLocaleDateString('en-IN')}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/bikes/${bike.slug}/edit`}
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          Edit
                        </Link>

                        <button
                          type="button"
                          disabled={loadingId === bike._id}
                          onClick={() => deleteBike(bike)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}