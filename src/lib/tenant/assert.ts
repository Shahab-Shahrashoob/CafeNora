export class TenantViolationError extends Error {
  constructor(message = "Cross-tenant access attempted") {
    super(message);
    this.name = "TenantViolationError";
  }
}

export function assertSameCafe(rowCafeId: string, sessionCafeId: string): void {
  if (rowCafeId !== sessionCafeId) throw new TenantViolationError();
}