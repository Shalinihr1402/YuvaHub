import React, { useState, useEffect } from 'react';
import { 
  Bot, User, Send, Check, Calendar, Clock, Video, Download, 
  ExternalLink, CheckCircle, XCircle, Clock3, AlertCircle, Plus, X, Sparkles, Building2, Award, Shield
} from 'lucide-react';
import { ChatMessage } from '../../types';
import { chatWithAIMentorBackend } from '../../services/apiClient';
import {
  fetchMentors,
  fetchMentorAvailability,
  bookMentorshipSession,
  fetchMySessions,
  updateSessionStatus,
  type MentorProfile,
  type AvailabilitySlot,
  type MentorshipSession,
} from '../../services/mentorshipApi';
import { EmptyState, ErrorState, LoadingState } from '../ui/states';
import { useAppContext } from '../../context/AppContext';

export default function Mentorship() {
  const { user, setActiveTab } = useAppContext();
  const [view, setView] = useState<'ai' | 'human' | 'bookings'>('human');

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-8 font-sans pb-16 px-2 sm:px-4">
      {/* Top Banner Navigation Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-[#e8ded1] dark:border-slate-800 shadow-2xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#603620] text-[#f3e4bd] text-xs font-bold uppercase tracking-wider mb-2">
            <User className="w-3.5 h-3.5 text-[#f3e4bd]" />
            <span>1-on-1 Guidance & Advisory</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#231f20] dark:text-white tracking-tight">
            Mentorship <span className="text-[#b56b37] italic">Scheduler</span>
          </h1>
          <p className="text-xs text-[#603620] dark:text-slate-400 font-medium mt-1">
            Book interactive 1-on-1 sessions with verified industry engineers, manage availability, and export to Google Calendar.
          </p>
        </div>
        
        <div className="flex bg-[#fcf9f2] dark:bg-slate-800 p-1.5 rounded-2xl border border-[#e8ded1] dark:border-slate-700 shrink-0">
          <button 
            onClick={() => setView('human')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              view === 'human' 
                ? 'bg-[#b56b37] text-white shadow-xs' 
                : 'text-[#603620] dark:text-slate-300 hover:bg-[#f6efe2]'
            }`}
          >
            <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Industry Mentors</span>
          </button>
          <button 
            onClick={() => setView('bookings')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              view === 'bookings' 
                ? 'bg-[#b56b37] text-white shadow-xs' 
                : 'text-[#603620] dark:text-slate-300 hover:bg-[#f6efe2]'
            }`}
          >
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> My Bookings</span>
          </button>
          <button 
            onClick={() => setView('ai')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              view === 'ai' 
                ? 'bg-[#b56b37] text-white shadow-xs' 
                : 'text-[#603620] dark:text-slate-300 hover:bg-[#f6efe2]'
            }`}
          >
            <span className="flex items-center gap-1.5"><Bot className="w-3.5 h-3.5" /> AI Mentor</span>
          </button>
        </div>
      </header>

      {view === 'ai' && <AIMain user={user} />}
      {view === 'human' && <HumanMain user={user} onBookingCreated={() => setView('bookings')} />}
      {view === 'bookings' && <MyBookingsMain user={user} />}
    </div>
  );
}

function HumanMain({ user, onBookingCreated }: { user: any; onBookingCreated: () => void }) {
  const [showApply, setShowApply] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState<MentorProfile | null>(null);
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [loadingMentors, setLoadingMentors] = useState(true);
  const [mentorSlots, setMentorSlots] = useState<AvailabilitySlot[]>([]);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadMentors = async () => {
      try {
        setLoadingMentors(true);
        const { mentors: fetchedMentors } = await fetchMentors({ limit: 20 });
        if (mounted) setMentors(fetchedMentors || []);
      } catch (error: any) {
        if (mounted) {
          setMentors([]);
          setBookingError(error.message || 'Failed to load mentors');
        }
      } finally {
        if (mounted) setLoadingMentors(false);
      }
    };

    void loadMentors();
    return () => { mounted = false; };
  }, []);

  const openMentorBooking = async (mentor: MentorProfile) => {
    setSelectedMentor(mentor);
    try {
      const slots = await fetchMentorAvailability(mentor.mentorUid);
      setMentorSlots(slots || []);
      setBookingError(null);
    } catch (error: any) {
      setMentorSlots([]);
      setBookingError(error.message || 'Failed to load availability');
    }
  };

  if (loadingMentors) {
    return <LoadingState title="Loading mentors" description="Fetching verified mentors and their availability." />;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {bookingError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          {bookingError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {mentors.length === 0 ? (
          <div className="md:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-[#e8ded1] dark:border-slate-800 text-center text-xs text-[#603620] dark:text-slate-300">
            No mentors are currently available. Please check back later.
          </div>
        ) : mentors.map((m) => {
          const skills = Array.isArray(m.skills) ? m.skills.slice(0, 4) : [];
          return (
            <div key={m.mentorUid} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-[#e8ded1] dark:border-slate-800 shadow-2xs flex flex-col justify-between h-full hover:border-[#b56b37] transition-all">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3">
                     <div className="w-12 h-12 rounded-2xl bg-[#603620] text-[#f3e4bd] flex items-center justify-center font-serif font-bold text-lg shadow-2xs">
                        {(m.name || 'M').charAt(0).toUpperCase()}
                     </div>
                     <div>
                       <h3 className="text-base font-serif font-bold text-[#231f20] dark:text-white leading-tight">{m.name}</h3>
                       <p className="text-xs font-bold text-[#b56b37] mt-0.5">{m.company || m.role || 'Mentor'}</p>
                     </div>
                  </div>
                  <span className="px-2.5 py-1 bg-[#63703d]/15 text-[#63703d] text-[10px] font-extrabold rounded-lg border border-[#63703d]/30">{m.experienceYears || 0} Yrs Exp</span>
                </div>
                <p className="text-xs text-[#603620] dark:text-slate-300 font-medium mb-4">{m.headline || m.bio || 'Career advice, resume review, and mock interviews.'}</p>
                
                <div className="flex flex-wrap gap-1.5 mt-4">
                   {skills.length > 0 ? skills.map((skill) => (
                     <span key={skill} className="px-2.5 py-1 bg-[#f6efe2] dark:bg-slate-800 text-[#603620] dark:text-slate-300 text-[10px] font-bold rounded-lg border border-[#e8ded1] dark:border-slate-700">
                       #{skill}
                     </span>
                   )) : (
                     <span className="px-2.5 py-1 bg-[#f6efe2] dark:bg-slate-800 text-[#603620] dark:text-slate-300 text-[10px] font-bold rounded-lg border border-[#e8ded1] dark:border-slate-700">
                       #Career Guidance
                     </span>
                   )}
                </div>
              </div>
              
              <button 
                onClick={() => void openMentorBooking(m)}
                className="w-full py-3 mt-6 bg-[#b56b37] hover:bg-[#96552a] text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" /> Schedule 1-on-1 Session
              </button>
            </div>
          );
        })}
      </div>

      {selectedMentor && (
        <BookingModal 
          mentor={selectedMentor}
          availableSlots={mentorSlots}
          user={user}
          onClose={() => setSelectedMentor(null)} 
          onSuccess={() => {
            setSelectedMentor(null);
            onBookingCreated();
          }}
        />
      )}

      <div className="relative overflow-hidden bg-gradient-to-r from-[#603620] via-[#482817] to-[#231f20] text-white rounded-3xl p-8 md:p-10 text-center flex flex-col items-center shadow-md border border-[#e8ded1]">
         <div className="relative z-10 max-w-xl space-y-3">
           <h3 className="text-2xl font-serif font-bold text-[#f3e4bd]">Want to guide the next generation?</h3>
           <p className="text-xs text-[#e8ded1] font-medium">Share your engineering expertise and mentor ambitious student developers on YuvaHub.</p>
           {!showApply ? (
             <button onClick={() => setShowApply(true)} className="bg-[#b56b37] hover:bg-[#96552a] text-white px-6 py-3 rounded-xl font-bold text-xs transition-all shadow-md mt-2 inline-block cursor-pointer">
               Apply to Become a Mentor
             </button>
           ) : (
             <MentorApplyForm user={user} onClose={() => setShowApply(false)} />
           )}
         </div>
      </div>
    </div>
  );
}

function BookingModal({ mentor, availableSlots, user, onClose, onSuccess }: { mentor: MentorProfile; availableSlots: AvailabilitySlot[]; user: any; onClose: () => void; onSuccess: () => void }) {
  const [selectedSlotId, setSelectedSlotId] = useState<string>(availableSlots[0]?.id || availableSlots[0]?._id || '');
  const [topic, setTopic] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSlotId(availableSlots[0]?.id || availableSlots[0]?._id || '');
  }, [availableSlots]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !selectedSlotId) {
      setBookingError('Please choose an available time slot before booking.');
      return;
    }

    setSubmitting(true);
    setBookingError(null);

    try {
      await bookMentorshipSession({
        mentorUid: mentor.mentorUid,
        slotId: selectedSlotId,
        topic: topic.trim() || 'Resume & Career Growth Strategy',
        agenda: 'Career guidance session',
        studentName: user?.displayName || user?.name || 'Student',
      });

      onSuccess();
    } catch (err: any) {
      setBookingError(err.message || 'Failed to book session');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full border border-[#e8ded1] dark:border-slate-800 shadow-2xl space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-[#e8ded1] dark:border-slate-800">
          <div>
            <h3 className="font-serif font-bold text-base text-[#231f20] dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#b56b37]" /> Book Session with {mentor.name}
            </h3>
            <p className="text-[11px] text-[#603620] dark:text-slate-400 font-semibold">{mentor.company || mentor.role || 'Verified Mentor'}</p>
          </div>
          <button onClick={onClose} className="text-[#8c7569] hover:text-[#231f20] p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {bookingError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            {bookingError}
          </div>
        )}

        {availableSlots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e8ded1] p-4 text-center text-xs text-[#603620] dark:text-slate-300">
            This mentor does not have open slots right now. Please check again later.
          </div>
        ) : (
          <form onSubmit={handleBook} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-[#603620] uppercase block mb-1.5">Available Slots</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {availableSlots.map((slot) => {
                  const slotKey = slot.id || slot._id || `${slot.date}-${slot.startTime}`;
                  const isSelected = selectedSlotId === slotKey;
                  return (
                    <button
                      key={slotKey}
                      type="button"
                      onClick={() => setSelectedSlotId(slotKey)}
                      className={`text-left rounded-xl border p-3 transition-all ${
                        isSelected
                          ? 'border-[#b56b37] bg-[#f8efe7] text-[#231f20]'
                          : 'border-[#e8ded1] bg-[#fcf9f2] text-[#603620] hover:bg-[#f6efe2]'
                      }`}
                    >
                      <div className="font-bold text-[11px]">{slot.date}</div>
                      <div className="mt-1 text-[10px] font-medium">{slot.startTime} - {slot.endTime}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="font-bold text-[#603620] uppercase block mb-1">Session Topic</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. GSoC proposal review, mock system design interview..."
                className="w-full bg-[#fcf9f2] dark:bg-slate-800 border border-[#e8ded1] dark:border-slate-700 rounded-xl p-3 text-xs text-[#231f20] dark:text-white outline-none resize-none h-20"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold text-[#603620] bg-[#f6efe2] rounded-xl hover:bg-[#e8ded1]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedSlotId}
                className="px-5 py-2.5 text-xs font-bold text-white bg-[#b56b37] hover:bg-[#96552a] rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Booking...' : 'Confirm Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function MentorApplyForm({ user, onClose }: { user: any; onClose: () => void }) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [formData, setFormData] = useState({ name: user?.displayName || '', company: '', role: '', exp: '3', bio: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setTimeout(() => {
      setStatus('success');
    }, 600);
  };

  if (status === 'success') {
    return (
      <div className="bg-white text-[#231f20] p-6 rounded-2xl border border-[#e8ded1] text-center space-y-3 animate-scale-up">
        <CheckCircle className="w-8 h-8 text-[#63703d] mx-auto" />
        <h4 className="font-serif font-bold text-base">Application Submitted!</h4>
        <p className="text-xs text-[#603620] font-medium">Our team will verify your credentials and reach out via email.</p>
        <button onClick={onClose} className="px-4 py-2 bg-[#b56b37] text-white text-xs font-bold rounded-xl">Close</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white text-[#231f20] p-6 rounded-2xl border border-[#e8ded1] space-y-3 text-left w-full text-xs">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-bold text-[#603620] uppercase block mb-1">Company / Org</label>
          <input required type="text" placeholder="e.g. Google" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} className="w-full bg-[#fcf9f2] border border-[#e8ded1] p-2.5 rounded-xl text-xs" />
        </div>
        <div>
          <label className="font-bold text-[#603620] uppercase block mb-1">Role Title</label>
          <input required type="text" placeholder="e.g. Staff Engineer" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-[#fcf9f2] border border-[#e8ded1] p-2.5 rounded-xl text-xs" />
        </div>
      </div>
      <div>
        <label className="font-bold text-[#603620] uppercase block mb-1">Brief Bio & Expertise</label>
        <textarea required rows={2} placeholder="Explain what topics you can guide students on..." value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="w-full bg-[#fcf9f2] border border-[#e8ded1] p-2.5 rounded-xl text-xs resize-none" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-bold text-[#603620] bg-[#f6efe2] rounded-xl">Cancel</button>
        <button type="submit" disabled={status === 'submitting'} className="px-5 py-2 text-xs font-bold text-white bg-[#b56b37] rounded-xl">Submit Application</button>
      </div>
    </form>
  );
}

function MyBookingsMain({ user }: { user: any }) {
  const [sessions, setSessions] = useState<MentorshipSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    setError(null);
    try {
      const data = await fetchMySessions();
      setSessions(data.sessions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load your bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSessions();
  }, [user]);

  if (loading) return <LoadingState title="Loading bookings" description="Fetching your mentorship appointments." />;
  if (error) return <ErrorState title="Unable to load bookings" description={error} onRetry={() => void fetchSessions()} />;

  if (sessions.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-[#e8ded1] dark:border-slate-800 rounded-3xl p-10 text-center space-y-4">
        <Calendar className="w-10 h-10 text-[#b56b37] mx-auto" />
        <h3 className="font-serif font-bold text-lg text-[#231f20] dark:text-white">No Upcoming Sessions</h3>
        <p className="text-xs text-[#603620] font-medium max-w-sm mx-auto">Explore industry mentors to schedule your first 1-on-1 advisory call.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map(s => (
        <div key={s.sessionId} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-[#e8ded1] dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase text-[#63703d] bg-[#63703d]/15 px-2.5 py-0.5 rounded-md border border-[#63703d]/30">{s.status}</span>
            <h3 className="font-serif font-bold text-base text-[#231f20] dark:text-white mt-1">{s.topic}</h3>
            <p className="text-xs text-[#603620] font-semibold mt-0.5">Mentor: {s.mentorName} • {s.slotDateTime}</p>
          </div>
          {s.meetingUrl ? (
            <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#b56b37] text-white text-xs font-bold rounded-xl flex items-center gap-2">
              <Video className="w-3.5 h-3.5" /> Join Video Call
            </a>
          ) : (
            <span className="px-4 py-2 bg-[#f6efe2] text-[#603620] text-xs font-bold rounded-xl">Awaiting link</span>
          )}
        </div>
      ))}
    </div>
  );
}

interface LocalAIMessage {
  sender: 'ai' | 'user';
  text: string;
}

function AIMain({ user }: { user: any }) {
  const [messages, setMessages] = useState<LocalAIMessage[]>([
    { sender: 'ai', text: 'Hello! I am your YuvaHub AI Mentor. How can I help with your GSoC application, resume, or career roadmap today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const response: any = await chatWithAIMentorBackend([], userMsg);
      const reply = typeof response === 'string' ? response : (response?.text || 'I am processing your query. Please try again.');
      setMessages(prev => [...prev, { sender: 'ai', text: reply }]);
    } catch {
      setMessages(prev => [...prev, { sender: 'ai', text: 'AI assistant service temporarily offline. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-[#e8ded1] dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xs">
      <div className="border-b border-[#e8ded1] pb-4 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#603620] text-[#f3e4bd]">
          <Bot className="w-5 h-5 text-[#f3e4bd]" />
        </div>
        <div>
          <h3 className="font-serif font-bold text-base text-[#231f20] dark:text-white">YuvaHub AI Career Advisor</h3>
          <p className="text-xs text-[#603620] font-medium">Instant guidance on resume review, GSoC proposals, and system design.</p>
        </div>
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto p-2">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-lg p-4 rounded-2xl text-xs font-medium leading-relaxed ${
              m.sender === 'user' 
                ? 'bg-[#b56b37] text-white shadow-xs' 
                : 'bg-[#fcf9f2] text-[#231f20] border border-[#e8ded1]'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && <div className="text-xs text-[#603620] font-bold animate-pulse">AI is typing...</div>}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 pt-2 border-t border-[#e8ded1]">
        <input
          type="text"
          placeholder="Ask AI Mentor anything..."
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 bg-[#fcf9f2] border border-[#e8ded1] rounded-xl px-4 py-3 text-xs text-[#231f20] outline-none"
        />
        <button type="submit" disabled={loading} className="px-5 py-3 bg-[#b56b37] hover:bg-[#96552a] text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer">
          <Send className="w-4 h-4" /> Send
        </button>
      </form>
    </div>
  );
}
