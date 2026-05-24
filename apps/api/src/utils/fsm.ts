import { AppError } from '../middleware/error.js';

type InstallmentStatus   = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'CANCELLED' | 'CLOSED';
type VerificationStatus  = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

const INSTALLMENT: Record<InstallmentStatus, InstallmentStatus[]> = {
  PENDING:   ['ACTIVE', 'CANCELLED'],
  ACTIVE:    ['COMPLETED', 'DEFAULTED', 'CANCELLED'],
  COMPLETED: ['CLOSED'],
  DEFAULTED: ['ACTIVE', 'CLOSED'],
  CANCELLED: [],
  CLOSED:    [],
};

const VERIFICATION: Record<VerificationStatus, VerificationStatus[]> = {
  PENDING:     ['UNDER_REVIEW'],
  UNDER_REVIEW:['APPROVED', 'REJECTED'],
  APPROVED:    [],
  REJECTED:    [],
};

function assertTransition<S extends string>(map: Record<S, S[]>, from: S, to: S, label: string): void {
  if (!(map[from] ?? []).includes(to)) {
    throw new AppError(`${label}: cannot transition from ${from} → ${to}`, 400);
  }
}

export const fsm = {
  installment: {
    assert: (from: InstallmentStatus, to: InstallmentStatus) =>
      assertTransition(INSTALLMENT, from, to, 'Installment'),
    allowed: (from: InstallmentStatus) => INSTALLMENT[from] ?? [],
  },
  verification: {
    assert: (from: VerificationStatus, to: VerificationStatus) =>
      assertTransition(VERIFICATION, from, to, 'Verification'),
    allowed: (from: VerificationStatus) => VERIFICATION[from] ?? [],
  },
};
