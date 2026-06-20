import React from 'react'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  style?: React.CSSProperties
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style }: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'var(--surface-2)',
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}

export function PackageCardSkeleton() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 18px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton width={110} height={18} />
          <Skeleton width={80} height={13} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <Skeleton width={64} height={22} />
          <Skeleton width={50} height={11} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <Skeleton width={100} height={13} />
        <Skeleton width={80} height={13} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <Skeleton width={56} height={22} borderRadius={999} />
        <Skeleton width={68} height={22} borderRadius={999} />
      </div>
      <Skeleton height={44} borderRadius={10} />
    </div>
  )
}

export function TripCardSkeleton() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 18px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton width={130} height={18} />
          <Skeleton width={90} height={13} />
        </div>
        <Skeleton width={54} height={24} borderRadius={999} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
        <Skeleton width={90} height={13} />
        <Skeleton width={70} height={13} />
        <Skeleton width={80} height={13} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Skeleton height={40} borderRadius={10} style={{ flex: 1 }} />
        <Skeleton height={40} borderRadius={10} style={{ flex: 1 }} />
      </div>
    </div>
  )
}

export function LiftCardSkeleton() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Skeleton width={120} height={16} />
          <Skeleton width={80} height={12} />
        </div>
        <Skeleton width={52} height={22} borderRadius={999} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Skeleton width={70} height={12} />
        <Skeleton width={60} height={12} />
      </div>
      <Skeleton height={40} borderRadius={10} />
    </div>
  )
}
