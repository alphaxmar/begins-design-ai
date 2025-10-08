export interface LogContext {
  userId?: string
  requestId?: string
  endpoint?: string
  method?: string
  userAgent?: string
  ip?: string
  [key: string]: any
}

export interface ErrorLog {
  timestamp: string
  level: 'error' | 'warn' | 'info' | 'debug'
  message: string
  error?: Error
  context?: LogContext
  stack?: string
}

export class Logger {
  private context: LogContext

  constructor(context: LogContext = {}) {
    this.context = context
  }

  private formatLog(level: ErrorLog['level'], message: string, error?: Error, additionalContext?: LogContext): ErrorLog {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } as any : undefined,
      context: { ...this.context, ...additionalContext },
      stack: error?.stack
    }
  }

  error(message: string, error?: Error, context?: LogContext) {
    const log = this.formatLog('error', message, error, context)
    console.error(JSON.stringify(log))
    return log
  }

  warn(message: string, context?: LogContext) {
    const log = this.formatLog('warn', message, undefined, context)
    console.warn(JSON.stringify(log))
    return log
  }

  info(message: string, context?: LogContext) {
    const log = this.formatLog('info', message, undefined, context)
    console.info(JSON.stringify(log))
    return log
  }

  debug(message: string, context?: LogContext) {
    const log = this.formatLog('debug', message, undefined, context)
    console.debug(JSON.stringify(log))
    return log
  }

  withContext(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext })
  }
}

// Helper function to create logger with request context
export function createRequestLogger(c: any): Logger {
  const url = new URL(c.req.url)
  return new Logger({
    requestId: c.req.header('x-request-id') || crypto.randomUUID(),
    endpoint: url.pathname,
    method: c.req.method,
    userAgent: c.req.header('user-agent'),
    ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for'),
    userId: c.get('userEmail')
  })
}

// Error monitoring helper
export function monitorError(error: Error, context: LogContext = {}) {
  const logger = new Logger(context)
  logger.error('Unhandled error occurred', error)
  
  // In production, you could send this to external monitoring services
  // like Sentry, DataDog, or CloudWatch
  return logger
}