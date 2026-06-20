import React from 'react'

export function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse bg-slate-800 rounded-lg ${className}`} />
  )
}

export function StatsCardSkeleton() {
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between h-28 shadow-md">
      <div className="flex justify-between items-center">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <Skeleton className="h-7 w-28 my-1" />
      <Skeleton className="h-2 w-24" />
    </div>
  )
}

export function QuestionCardSkeleton() {
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-24" />
        <div className="flex space-x-1.5">
          <Skeleton className="h-4.5 w-4.5 rounded-full" />
          <Skeleton className="h-4.5 w-4.5 rounded-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        <Skeleton className="h-6 w-16 rounded-lg" />
        <Skeleton className="h-6 w-12 rounded-lg" />
        <Skeleton className="h-6 w-20 rounded-lg" />
      </div>
      <div className="flex justify-between items-center pt-3 border-t border-slate-850">
        <Skeleton className="h-3 w-32" />
        <div className="flex space-x-2">
          <Skeleton className="h-7 w-12 rounded-xl" />
          <Skeleton className="h-7 w-16 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export function NoteBlockSkeleton() {
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4.5 w-48" />
        <Skeleton className="h-5 w-16 rounded-lg" />
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
      <div className="flex justify-between items-center pt-3 border-t border-slate-850">
        <div className="flex space-x-1.5">
          <Skeleton className="h-5 w-14 rounded-lg" />
          <Skeleton className="h-5 w-14 rounded-lg" />
        </div>
        <Skeleton className="h-6.5 w-20 rounded-xl" />
      </div>
    </div>
  )
}
