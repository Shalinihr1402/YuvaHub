import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';

// Simple helper to format ISO date to YYYY-MM-DD
const formatDate = (date: Date) => date.toISOString().split('T')[0];

export default function CalendarPage() {
  const [status, setStatus] = useState<{ providers: string[] } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [slots, setSlots] = useState<Array<{ start: string; end: string }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  // Fetch connection status on mount
  useEffect(() => {
    fetch('/v1/calendar/me')
      .then(res => res.json())
      .then(data => {
        setStatus(data);
        setLoadingStatus(false);
      })
      .catch(() => {
        setStatus({ providers: [] });
        setLoadingStatus(false);
      });
  }, []);

  // Fetch availability when date changes and a provider is linked
  useEffect(() => {
    if (status?.providers?.length) {
      setLoadingSlots(true);
      fetch(`/v1/calendar/availability?date=${selectedDate}`)
        .then(res => res.json())
        .then(data => {
          setSlots(data.slots || []);
          setLoadingSlots(false);
        })
        .catch(() => {
          setSlots([]);
          setLoadingSlots(false);
        });
    }
  }, [selectedDate, status]);

  const startOAuth = (provider: 'google' | 'outlook') => {
    fetch(`/v1/calendar/${provider}/auth`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          window.open(data.url, '_blank');
        } else {
          setMessage('Failed to obtain auth URL');
        }
      })
      .catch(() => setMessage('OAuth request failed'));
  };

  const bookSlot = () => {
    if (!selectedSlot) return;
    const [start, end] = selectedSlot.split('|');
    fetch('/v1/calendar/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: selectedDate, start, end })
    })
      .then(res => res.json())
      .then(data => {
        setMessage(data.message || 'Booked successfully');
        // refresh slots
        setSelectedSlot('');
        setLoadingSlots(true);
        fetch(`/v1/calendar/availability?date=${selectedDate}`)
          .then(r => r.json())
          .then(d => { setSlots(d.slots || []); setLoadingSlots(false); })
          .catch(() => setLoadingSlots(false));
      })
      .catch(() => setMessage('Booking failed'));
  };

  const disconnect = (provider: string) => {
    fetch(`/v1/calendar/${provider}`, { method: 'DELETE' })
      .then(() => {
        setStatus({ providers: [] });
        setMessage(`Disconnected ${provider}`);
      })
      .catch(() => setMessage('Disconnect failed'));
  };

  if (loadingStatus) {
    return <div className="p-4">Loading calendar status...</div>;
  }

  const hasProvider = status?.providers?.length > 0;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold flex items-center gap-2 mb-4">
        <CalendarIcon className="w-6 h-6" /> Calendar Integration
      </h2>

      {message && <div className="mb-4 p-2 bg-gray-100 rounded">{message}</div>}

      {!hasProvider && (
        <div className="space-y-4">
          <p>No calendar provider linked. Connect one to view availability.</p>
          <button
            onClick={() => startOAuth('google')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Connect Google Calendar
          </button>
          <button
            onClick={() => startOAuth('outlook')}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Connect Outlook Calendar
          </button>
        </div>
      )}

      {hasProvider && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">Connected: {status?.providers?.join(', ')}</p>
            {status?.providers?.map(p => (
              <button
                key={p}
                onClick={() => disconnect(p)}
                className="px-2 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
              >
                Disconnect {p}
              </button>
            ))}
          </div>

          <label className="block mb-2">Select date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border p-2 rounded"
          />

          {loadingSlots ? (
            <p>Loading slots...</p>
          ) : slots.length ? (
            <div className="space-y-2">
              <p>Select a free slot:</p>
              <select
                value={selectedSlot}
                onChange={e => setSelectedSlot(e.target.value)}
                className="border p-2 rounded w-full"
              >
                <option value="">-- Choose slot --</option>
                {slots.map((s, i) => (
                  <option key={i} value={`${s.start}|${s.end}`}>
                    {s.start} – {s.end}
                  </option>
                ))}
              </select>
              <button
                onClick={bookSlot}
                disabled={!selectedSlot}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                Book Interview
              </button>
            </div>
          ) : (
            <p>No free slots for the selected date.</p>
          )}
        </div>
      )}
    </div>
  );
}
