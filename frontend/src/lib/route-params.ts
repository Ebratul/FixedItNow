/**
 * Shape checks for dynamic route segments that are spliced into API paths. A value that cannot be an id
 * (for example `..%2Fadmin` or `x?y=1`) renders the normal 404 page instead of reaching the API client.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Backend `newReference`: "FIN" + 24 upper-case hex characters. */
const PAYMENT_REFERENCE = /^FIN[0-9A-F]{24}$/;

export const isUuid = (value: string) => UUID.test(value);
export const isPaymentReference = (value: string) => PAYMENT_REFERENCE.test(value);
