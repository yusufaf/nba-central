export function getApiErrorMessage(err: any, fallback: string): string {
    const status = err?.response?.status;
    if (typeof status === 'number' && status >= 500) {
        return 'Something went wrong on our end. Please try again later.';
    }
    return err?.response?.data?.error || err?.message || fallback;
}
