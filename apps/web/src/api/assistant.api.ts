import { api } from './client.ts';

export const assistantApi = {
  ask: (message: string) =>
    api.post<{ data: { reply: string } }>('/assistant/ask', { message }).then((r) => r.data.data),
};
