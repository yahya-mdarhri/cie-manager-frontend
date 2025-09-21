"use client"

import { useState, useCallback } from "react"

interface PaginationState {
  currentPage: number
  totalPages: number
  totalCount: number
  pageSize: number
}

interface UsePaginationReturn {
  pagination: PaginationState
  setPagination: (pagination: Partial<PaginationState>) => void
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  canGoNext: boolean
  canGoPrev: boolean
  updateFromResponse: (response: any) => void
}

export function usePagination(initialPageSize: number = 10): UsePaginationReturn {
  const [pagination, setPaginationState] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    pageSize: initialPageSize,
  })

  const setPagination = useCallback((newPagination: Partial<PaginationState>) => {
    setPaginationState(prev => ({ ...prev, ...newPagination }))
  }, [])

  const goToPage = useCallback((page: number) => {
    setPaginationState(prev => ({
      ...prev,
      currentPage: Math.max(1, Math.min(page, prev.totalPages))
    }))
  }, [])

  const nextPage = useCallback(() => {
    setPaginationState(prev => ({
      ...prev,
      currentPage: Math.min(prev.currentPage + 1, prev.totalPages)
    }))
  }, [])

  const prevPage = useCallback(() => {
    setPaginationState(prev => ({
      ...prev,
      currentPage: Math.max(prev.currentPage - 1, 1)
    }))
  }, [])

  const canGoNext = pagination.currentPage < pagination.totalPages
  const canGoPrev = pagination.currentPage > 1

  const updateFromResponse = useCallback((response: any) => {
    if (response && typeof response === 'object') {
      setPaginationState(prev => ({
        ...prev,
        currentPage: response.page || 1,
        totalPages: response.total || 1,
        totalCount: response.count || 0,
      }))
    }
  }, [])

  return {
    pagination,
    setPagination,
    goToPage,
    nextPage,
    prevPage,
    canGoNext,
    canGoPrev,
    updateFromResponse,
  }
}
