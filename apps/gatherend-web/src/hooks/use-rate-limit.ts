/**
 * Hook de Rate Limiting para formularios del frontend
 * Previene spam de submits y ataques de fuerza bruta
 */

import { useState, useCallback, useRef } from "react";

interface UseRateLimitOptions {
  /** Número máximo de intentos permitidos */
  maxAttempts: number;
  /** Ventana de tiempo en milisegundos */
  windowMs: number;
  /** Tiempo de bloqueo en milisegundos cuando se excede el límite */
  lockoutMs?: number;
}

interface UseRateLimitReturn {
  /** Si está actualmente bloqueado por rate limit */
  isLocked: boolean;
  /** Intentos restantes */
  attemptsRemaining: number;
  /** Tiempo restante de bloqueo en segundos */
  lockoutSecondsRemaining: number;
  /** Función para registrar un intento. Retorna true si está permitido */
  checkAndRecord: () => boolean;
  /** Resetear el rate limiter */
  reset: () => void;
}

/**
 * Hook para implementar rate limiting en formularios del frontend
 *
 * @example
 * ```tsx
 * const { isLocked, attemptsRemaining, lockoutSecondsRemaining, checkAndRecord } = useRateLimit({
 *   maxAttempts: 5,
 *   windowMs: 60000, // 1 minuto
 *   lockoutMs: 30000, // 30 segundos de bloqueo
 * });
 *
 * const handleSubmit = async (e) => {
 *   e.preventDefault();
 *   if (!checkAndRecord()) {
 *     // Rate limited
 *     return;
 *   }
 *   // Proceder con el submit
 * };
 * ```
 */
export function useRateLimit(options: UseRateLimitOptions): UseRateLimitReturn {
  const { maxAttempts, windowMs, lockoutMs = 30000 } = options;

  const [isLocked, setIsLocked] = useState(false);
  const [lockoutSecondsRemaining, setLockoutSecondsRemaining] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(maxAttempts);

  const attemptsRef = useRef<number[]>([]);
  const lockoutEndRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startLockoutCountdown = useCallback((endTime: number) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const updateRemaining = () => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        setIsLocked(false);
        setLockoutSecondsRemaining(0);
        lockoutEndRef.current = null;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        setLockoutSecondsRemaining(remaining);
      }
    };

    updateRemaining();
    intervalRef.current = setInterval(updateRemaining, 1000);
  }, []);

  const checkAndRecord = useCallback((): boolean => {
    const now = Date.now();

    // Si está bloqueado, verificar si el bloqueo expiró
    if (lockoutEndRef.current) {
      if (now < lockoutEndRef.current) {
        return false;
      }
      // Bloqueo expirado, resetear
      lockoutEndRef.current = null;
      attemptsRef.current = [];
      setIsLocked(false);
      setAttemptsRemaining(maxAttempts);
    }

    // Limpiar intentos fuera de la ventana
    attemptsRef.current = attemptsRef.current.filter(
      (timestamp) => now - timestamp < windowMs
    );

    // Verificar si excede el límite
    if (attemptsRef.current.length >= maxAttempts) {
      // Activar bloqueo
      const lockoutEnd = now + lockoutMs;
      lockoutEndRef.current = lockoutEnd;
      setIsLocked(true);
      setAttemptsRemaining(0);
      startLockoutCountdown(lockoutEnd);
      return false;
    }

    // Registrar el intento
    attemptsRef.current.push(now);
    setAttemptsRemaining(maxAttempts - attemptsRef.current.length);

    return true;
  }, [maxAttempts, windowMs, lockoutMs, startLockoutCountdown]);

  const reset = useCallback(() => {
    attemptsRef.current = [];
    lockoutEndRef.current = null;
    setIsLocked(false);
    setLockoutSecondsRemaining(0);
    setAttemptsRemaining(maxAttempts);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [maxAttempts]);

  return {
    isLocked,
    attemptsRemaining,
    lockoutSecondsRemaining,
    checkAndRecord,
    reset,
  };
}

// Configuraciones predefinidas
export const RATE_LIMIT_CONFIGS = {
  /** Sign in/up: 5 intentos por minuto, 30s de bloqueo */
  auth: {
    maxAttempts: 5,
    windowMs: 60 * 1000,
    lockoutMs: 30 * 1000,
  },
  /** Verificación de código: 3 intentos por minuto, 60s de bloqueo */
  verification: {
    maxAttempts: 3,
    windowMs: 60 * 1000,
    lockoutMs: 60 * 1000,
  },
  /** Reenvío de código: 2 por minuto, 120s de bloqueo */
  resendCode: {
    maxAttempts: 2,
    windowMs: 60 * 1000,
    lockoutMs: 120 * 1000,
  },
} as const;
