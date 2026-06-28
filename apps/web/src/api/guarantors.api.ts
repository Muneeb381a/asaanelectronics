import { api } from './client.ts';

export interface GuarantorCustomer {
  id:                string;
  name:              string;
  phone:             string;
  installmentStatus: string | null;
}

export interface Guarantor {
  phone:          string;
  name:           string | null;
  relation:       string | null;
  customerCount:  number;
  activeCount:    number;
  defaultedCount: number;
  customers:      GuarantorCustomer[];
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const guarantorsApi = {
  list: (search?: string) => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return api.get<{ data: Guarantor[] }>(`/customers/guarantors${q}`).then(unwrap<Guarantor[]>);
  },
};
