import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Navigation } from 'lucide-react';

// Shared between VerificationQueuePage (address verification proof) and the
// staff attendance clock-in/out widget — both need a live browser GPS lock
// captured at the moment of a field action.
export type GpsState =
  | { status: 'acquiring' }
  | { status: 'acquired'; lat: number; lng: number; accuracy: number }
  | { status: 'denied'; reason: string };

export function useGps() {
  const [gps, setGps] = useState<GpsState>({ status: 'acquiring' });
  useEffect(() => {
    if (!navigator.geolocation) {
      setGps({ status: 'denied', reason: 'GPS not supported on this device' });
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => setGps({ status: 'acquired', lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => setGps({ status: 'denied', reason: err.message }),
      { enableHighAccuracy: true, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  return gps;
}

export function GpsBadge({ gps }: { gps: GpsState }) {
  if (gps.status === 'acquiring') return (
    <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
      <Loader2 size={13} className="animate-spin" />
      <span className="text-xs font-medium">Acquiring GPS…</span>
    </div>
  );
  if (gps.status === 'denied') return (
    <div className="flex items-center gap-1.5 text-red-600 bg-red-50 rounded-xl px-3 py-2">
      <AlertCircle size={13} />
      <span className="text-xs font-medium">GPS denied — {gps.reason}</span>
    </div>
  );
  return (
    <div className="flex items-center gap-1.5 text-green-700 bg-green-50 rounded-xl px-3 py-2">
      <Navigation size={13} className="fill-green-600" />
      <span className="text-xs font-medium">GPS locked · ±{Math.round(gps.accuracy)}m</span>
      <a href={`https://maps.google.com/?q=${gps.lat},${gps.lng}`} target="_blank" rel="noreferrer"
        className="text-[10px] text-green-600 underline ml-1">View</a>
    </div>
  );
}
