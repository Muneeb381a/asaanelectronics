import { api } from './client.ts';

export interface CustomerNote {
  id: string;
  note: string;
  createdAt: string;
  userId: string | null;
  authorName: string | null;
}

export interface NotesPage {
  data: CustomerNote[];
  total: number;
  page: number;
  limit: number;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const customerNotesApi = {
  list: (customerId: string, page = 1, limit = 10) =>
    api.get<{ data: NotesPage }>(`/customers/${customerId}/notes`, { params: { page, limit } }).then(unwrap<NotesPage>),

  add: (customerId: string, note: string) =>
    api.post<{ data: CustomerNote }>(`/customers/${customerId}/notes`, { note }).then(unwrap<CustomerNote>),

  remove: (customerId: string, noteId: string) =>
    api.delete(`/customers/${customerId}/notes/${noteId}`),
};
