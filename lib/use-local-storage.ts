'use client'

import { useCallback, useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
const cache = new Map<string, { raw: string | null; value: unknown }>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  const onStorage = () => callback()
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', onStorage)
  }
}

function read<T>(key: string, fallback: T): T {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    return fallback
  }
  const cached = cache.get(key)
  if (cached && cached.raw === raw) return cached.value as T
  let value: T = fallback
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T
    } catch {
      value = fallback
    }
  }
  cache.set(key, { raw, value })
  return value
}

export function useLocalStorage<T>(key: string, fallback: T) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  )

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = read(key, fallback)
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved))
      } catch {
        // Storage may be full or blocked; keep the UI working in memory.
        cache.set(key, { raw: null, value: resolved })
      }
      notify()
    },
    // fallback is intentionally excluded so callers can pass inline defaults.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )

  return [value, setValue] as const
}

const notify = () => listeners.forEach((l) => l())

export function removeStorageKeys(match: (key: string) => boolean) {
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && match(key)) keys.push(key)
    }
    keys.forEach((key) => {
      window.localStorage.removeItem(key)
      cache.delete(key)
    })
  } catch {
    return
  }
  notify()
}

export function writeStorageEntries(entries: [key: string, value: unknown][]) {
  const written: string[] = []
  try {
    for (const [key, value] of entries) {
      window.localStorage.setItem(key, JSON.stringify(value))
      cache.delete(key)
      written.push(key)
    }
  } catch {
    written.forEach((key) => window.localStorage.removeItem(key))
    notify()
    return false
  }
  notify()
  return true
}

function measureBytes(prefix: string) {
  let chars = 0
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key?.startsWith(prefix)) chars += key.length + (window.localStorage.getItem(key)?.length ?? 0)
    }
  } catch {
    return 0
  }
  // localStorage stores UTF-16, two bytes per code unit.
  return chars * 2
}

export function useStorageBytes(prefix: string) {
  return useSyncExternalStore(
    subscribe,
    () => measureBytes(prefix),
    () => 0,
  )
}

export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}
