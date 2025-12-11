export class MixcutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MixcutError';
  }
}

export class ValidationError extends MixcutError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
