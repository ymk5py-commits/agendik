import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Ejecuta una promesa y expone {data, loading, error, reload}.
 * Ignora respuestas de peticiones obsoletas y evita setState tras desmontar.
 */
export function useAsync(fn, deps = [], { enabled = true, initialData = null } = {}) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)
  const requestId = useRef(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    Promise.resolve()
      .then(fn)
      .then((result) => {
        if (!mounted.current || id !== requestId.current) return
        setData(result)
      })
      .catch((err) => {
        if (!mounted.current || id !== requestId.current) return
        setError(err.message || 'Ocurrió un error inesperado.')
      })
      .finally(() => {
        if (!mounted.current || id !== requestId.current) return
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  useEffect(() => {
    run()
  }, [run])

  return { data, loading, error, reload: run, setData }
}
