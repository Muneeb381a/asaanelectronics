import { z } from 'zod';
const SPECIAL_LABELS = {
    cnic: 'CNIC', guarantorCnic: 'Guarantor CNIC', guarantor2Cnic: 'Guarantor 2 CNIC',
    imei: 'IMEI', imeiNumber: 'IMEI / serial', iban: 'IBAN', dob: 'Date of birth',
    otpToken: 'Login session', code: 'Code', avoId: 'Verifier', newCustomerId: 'New customer',
    customerId: 'Customer', productId: 'Product', installmentId: 'Installment', staffId: 'Staff member',
    agentId: 'Agent', supplierId: 'Supplier', photoUrl: 'Customer photo', cnicFrontUrl: 'CNIC front image',
    cnicBackUrl: 'CNIC back image', blankChequeUrl: 'Blank cheque image', officeAddress: 'Office address',
    downPayment: 'Down payment', totalAmount: 'Total amount', paymentDueDay: 'Payment due day',
    handedAmount: 'Handed amount', confirmedAmount: 'Confirmed amount', newPassword: 'New password',
    currentPassword: 'Current password', shopName: 'Shop name', ownerNote: 'Owner note',
};
function fieldLabel(path) {
    const keys = path.filter((p) => typeof p === 'string');
    const key = keys[keys.length - 1] ?? '';
    if (!key)
        return 'This field';
    if (SPECIAL_LABELS[key])
        return SPECIAL_LABELS[key];
    const words = key.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').trim().toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
}
// Turns Zod's technical defaults ("Required", "String must contain at least 2 character(s)")
// into messages a shop owner can act on. Schema-level custom messages still win.
export const friendlyErrorMap = (issue, ctx) => {
    const f = fieldLabel(issue.path);
    switch (issue.code) {
        case 'invalid_type':
            if (issue.received === 'undefined' || issue.received === 'null')
                return { message: `${f} is required` };
            if (issue.expected === 'number')
                return { message: `${f} must be a number` };
            if (issue.expected === 'string')
                return { message: `${f} must be text` };
            if (issue.expected === 'boolean')
                return { message: `${f} must be yes or no` };
            return { message: `${f} is invalid` };
        case 'too_small':
            if (issue.type === 'string') {
                return { message: Number(issue.minimum) <= 1 ? `${f} is required` : `${f} must be at least ${issue.minimum} characters` };
            }
            if (issue.type === 'number') {
                if (!issue.inclusive && Number(issue.minimum) === 0)
                    return { message: `${f} must be greater than 0` };
                return { message: issue.inclusive ? `${f} must be at least ${issue.minimum}` : `${f} must be greater than ${issue.minimum}` };
            }
            if (issue.type === 'array')
                return { message: `Add at least ${issue.minimum} item${Number(issue.minimum) === 1 ? '' : 's'}` };
            return { message: `${f} is too small` };
        case 'too_big':
            if (issue.type === 'string')
                return { message: `${f} must be at most ${issue.maximum} characters` };
            if (issue.type === 'number')
                return { message: `${f} must be at most ${issue.maximum}` };
            if (issue.type === 'array')
                return { message: `Maximum ${issue.maximum} items allowed` };
            return { message: `${f} is too large` };
        case 'invalid_string':
            if (issue.validation === 'email')
                return { message: 'Enter a valid email address' };
            if (issue.validation === 'url')
                return { message: `${f} is required — upload the file first` };
            if (issue.validation === 'datetime')
                return { message: `${f} must be a valid date` };
            if (issue.validation === 'uuid')
                return { message: `${f} is invalid — please select again` };
            return { message: `${f} format is invalid` };
        case 'invalid_enum_value':
            return { message: `${f} has an invalid value` };
        case 'invalid_date':
            return { message: `${f} must be a valid date` };
        case 'unrecognized_keys':
            return { message: `Unexpected field${issue.keys.length > 1 ? 's' : ''}: ${issue.keys.join(', ')}` };
        default:
            return { message: ctx.defaultError };
    }
};
/** Installs the friendly messages on this package's zod instance (schemas are built with it). */
export function applyFriendlyZodMessages() {
    z.setErrorMap(friendlyErrorMap);
}
