import axios from 'axios';

export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    const serverMsg = error.response?.data?.error;
    if (serverMsg && typeof serverMsg === 'string') return serverMsg;

    switch (error.response?.status) {
      case 400: return 'Invalid information. Please check the form and try again.';
      case 401: return 'Session expired. Please log in again.';
      case 403: return 'You do not have permission to perform this action.';
      case 404: return 'Record not found.';
      case 409: return 'This record already exists.';
      case 422: return 'Information is incomplete or invalid.';
      case 429: return 'Too many attempts. Please wait a moment and try again.';
      case 500: return 'Server error. Please try again later.';
      case 503: return 'Service unavailable. Please try again later.';
    }

    if (!error.response) return 'Network error. Please check your internet connection.';
  }

  return fallback;
}
