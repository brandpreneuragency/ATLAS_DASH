// Typed HTTP errors. Routes throw these and the central error middleware
// turns them into JSON responses. Zod errors are handled separately.

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class BadRequest extends HttpError {
  constructor(message = 'Bad request') {
    super(400, 'bad_request', message);
  }
}
export class Unauthorized extends HttpError {
  constructor(message = 'Unauthorized') {
    super(401, 'unauthorized', message);
  }
}
export class Forbidden extends HttpError {
  constructor(message = 'Forbidden') {
    super(403, 'forbidden', message);
  }
}
export class NotFound extends HttpError {
  constructor(message = 'Not found') {
    super(404, 'not_found', message);
  }
}
export class Conflict extends HttpError {
  constructor(message = 'Conflict') {
    super(409, 'conflict', message);
  }
}
export class PayloadTooLarge extends HttpError {
  constructor(message = 'Payload too large') {
    super(413, 'payload_too_large', message);
  }
}
export class TooManyRequests extends HttpError {
  constructor(message = 'Too many requests') {
    super(429, 'too_many_requests', message);
  }
}

// Wrap an async route handler so thrown errors propagate to the error
// middleware instead of becoming unhandled promise rejections.
export function asyncHandler<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: any[]) => {
    const next = args[args.length - 1];
    Promise.resolve(fn(...args)).catch(next);
  }) as T;
}
