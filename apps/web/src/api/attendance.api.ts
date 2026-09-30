import { api } from './client.ts';

export interface AttendanceStatus {
  date: string;
  isClockedIn: boolean;
  clockIn:  string | null;
  clockOut: string | null;
  notes:    string | null;
  clockInLat:  number | null;
  clockInLng:  number | null;
  clockOutLat: number | null;
  clockOutLng: number | null;
}

export interface AttendanceRecord {
  id:       string;
  userId:   string;
  userName: string;
  date:     string;
  clockIn:  string;
  clockOut: string | null;
  notes:    string | null;
  clockInLat:  number | null;
  clockInLng:  number | null;
  clockOutLat: number | null;
  clockOutLng: number | null;
  durationMin: number | null;
}

export interface AttendanceSummary {
  userId:         string;
  userName:       string;
  daysPresent:    number;
  workingDays:    number;
  attendancePct:  number;
  totalHours:     number;
  totalMinutes:   number;
  avgHoursPerDay: number;
}

export const attendanceApi = {
  clockIn:   (coords?: { lat: number; lng: number }) =>
    api.post('/attendance/clock-in', coords ?? {}).then((r) => r.data.data as AttendanceRecord),
  clockOut:  (notes?: string, coords?: { lat: number; lng: number }) =>
    api.post('/attendance/clock-out', { notes, ...coords }).then((r) => r.data.data as AttendanceRecord),
  getStatus: () => api.get('/attendance/status').then((r) => r.data.data as AttendanceStatus),
  getByMonth: (year: number, month: number) =>
    api.get<{ data: AttendanceRecord[] }>(`/attendance/monthly?year=${year}&month=${month}`).then((r) => r.data.data),
  getSummary: (year: number, month: number) =>
    api.get<{ data: AttendanceSummary[] }>(`/attendance/summary?year=${year}&month=${month}`).then((r) => r.data.data),
};
