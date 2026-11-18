export class BaseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BaseError';
  }
}

export class ValidationError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ConnectionError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export class TimeoutError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class ForeignKeyConstraintError extends DatabaseError {
  constructor(message) {
    super(message);
    this.name = 'ForeignKeyConstraintError';
  }
}

export class UniqueConstraintError extends DatabaseError {
  constructor(message) {
    super(message);
    this.name = 'UniqueConstraintError';
  }
}

export class ExclusionConstraintError extends DatabaseError {
  constructor(message) {
    super(message);
    this.name = 'ExclusionConstraintError';
  }
}
