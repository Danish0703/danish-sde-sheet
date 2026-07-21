"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { Award, BookOpenCheck, CalendarClock, Check, Cloud, Flame, LogIn, LogOut, Sparkles, Target } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { dateLabel, isDue, scheduleReview, type ProgressRecord, type RecallGrade } from "@/features/revision/schedule";

type SheetMessage = { source: "danish-sde-sheet"; type: "progress"; id: string; title: string; solved: boolean };

const grades: { grade: RecallGrade; label: string; hint: string; className: string }[] = [
  { grade: "again", label: "Again", hint: "Bring it back tomorrow", className: "again" },
  { grade: "hard", label: "Hard", hint: "Keep the gap short", className: "hard" },
  { grade: "good", label: "Good", hint: "Advance one step", className: "good" },
  { grade: "easy", label: "Easy", hint: "Make a bigger jump", className: "easy" },
];

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function CloudStudyWorkspace() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const [email, setEmail] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const hydrateTracker = useCallback((items: ProgressRecord[]) => {
    frame.current?.contentWindow?.postMessage({ source: "danish-sde-app", type: "hydrate", solved: items.filter((item) => item.status === "solved").map((item) => item.question_id) }, window.location.origin);
  }, []);

  const loadProgress = useCallback(async (activeSession: Session | null) => {
    if (!activeSession || !isSupabaseConfigured) {
      setRecords([]);
      setLoading(false);
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data, error } = await supabase.from("question_progress").select("question_id, question_title, status, interval_days, review_count, next_review_at, last_review_at").order("updated_at", { ascending: false });
    if (error) setMessage(`Cloud sync needs the database schema: ${error.message}`);
    const next = (data ?? []) as ProgressRecord[];
    setRecords(next);
    hydrateTracker(next);
    setLoading(false);
  }, [hydrateTracker]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setSession(data.session);
      void loadProgress(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
      setSession(nextSession);
      void loadProgress(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, [loadProgress]);

  useEffect(() => {
    const callbackError = new URLSearchParams(window.location.search).get("auth_error");
    if (callbackError) setMessage(`Sign-in could not complete: ${callbackError}`);
  }, []);

  const syncProgress = useCallback(async (item: SheetMessage) => {
    if (!session || !isSupabaseConfigured) {
      setMessage("Saved on this device. Sign in to keep it safely in the cloud.");
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const now = new Date();
    const firstReview = new Date(now);
    firstReview.setDate(firstReview.getDate() + 1);
    const existing = records.find((record) => record.question_id === item.id);
    const payload = item.solved
      ? { user_id: session.user.id, question_id: item.id, question_title: item.title, status: "solved", solved_at: existing?.status === "solved" ? undefined : now.toISOString(), interval_days: existing?.interval_days || 1, next_review_at: existing?.next_review_at ?? firstReview.toISOString(), updated_at: now.toISOString() }
      : { user_id: session.user.id, question_id: item.id, question_title: item.title, status: "unsolved", interval_days: 0, next_review_at: null, updated_at: now.toISOString() };
    const { error } = await supabase.from("question_progress").upsert(payload, { onConflict: "user_id,question_id" });
    if (error) {
      setMessage(`Could not sync that change: ${error.message}`);
      return;
    }
    const row: ProgressRecord = {
      question_id: item.id,
      question_title: item.title,
      status: item.solved ? "solved" : "unsolved",
      interval_days: item.solved ? (existing?.interval_days || 1) : 0,
      review_count: existing?.review_count || 0,
      next_review_at: item.solved ? (existing?.next_review_at ?? firstReview.toISOString()) : null,
      last_review_at: existing?.last_review_at ?? null,
    };
    setRecords((current) => [row, ...current.filter((record) => record.question_id !== item.id)]);
    setMessage(item.solved ? "Solved — first active-recall check is scheduled for tomorrow." : "Marked unsolved and updated in cloud.");
  }, [records, session]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<SheetMessage>) => {
      if (event.origin !== window.location.origin || event.data?.source !== "danish-sde-sheet" || event.data.type !== "progress") return;
      void syncProgress(event.data);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [syncProgress]);

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !email.trim()) return;
    setAuthMessage("Sending your secure sign-in link…");
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, "");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${appUrl}/auth/callback?next=/sheet` } });
    if (error) setAuthMessage(error.message);
    else {
      setMessage("Check your inbox — the magic link will securely sign you in.");
      setAuthMessage("Email sent. Open the magic link in this browser to finish signing in.");
    }
  }

  async function signOut() {
    await getSupabaseClient()?.auth.signOut();
    setMessage("Signed out. Your already-synced study history remains safe in your account.");
  }

  async function review(record: ProgressRecord, grade: RecallGrade) {
    if (!session) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const scheduled = scheduleReview(record.interval_days, grade);
    const now = new Date().toISOString();
    const { error } = await supabase.from("question_progress").update({ interval_days: scheduled.intervalDays, review_count: record.review_count + 1, next_review_at: scheduled.nextReviewAt, last_review_at: now, updated_at: now }).eq("question_id", record.question_id);
    if (error) return setMessage(error.message);
    await supabase.from("review_events").insert({ user_id: session.user.id, question_id: record.question_id, question_title: record.question_title, grade, interval_days: scheduled.intervalDays });
    setRecords((items) => items.map((item) => item.question_id === record.question_id ? { ...item, interval_days: scheduled.intervalDays, review_count: item.review_count + 1, next_review_at: scheduled.nextReviewAt, last_review_at: now } : item));
    setMessage(`${grade === "again" ? "No shame —" : "Nice recall —"} ${record.question_title} is now scheduled ${dateLabel(scheduled.nextReviewAt).toLowerCase()}.`);
  }

  const stats = useMemo(() => {
    const solved = records.filter((record) => record.status === "solved");
    const byNextReview = (left: ProgressRecord, right: ProgressRecord) => new Date(left.next_review_at ?? 0).getTime() - new Date(right.next_review_at ?? 0).getTime();
    const due = [...solved.filter((record) => isDue(record.next_review_at))].sort(byNextReview);
    const upcoming = [...solved.filter((record) => !isDue(record.next_review_at))].sort(byNextReview);
    const reviewed = solved.reduce((sum, record) => sum + record.review_count, 0);
    const todaySolved = solved.filter((record) => record.last_review_at && new Date(record.last_review_at) >= startOfToday()).length;
    return { solved: solved.length, due, upcoming, reviewed, xp: solved.length * 25 + reviewed * 10, todaySolved };
  }, [records]);

  const nextReview = stats.due[0] ?? stats.upcoming[0];
  const completion = Math.min(100, Math.round((stats.solved / 191) * 100));

  return <main className="study-shell">
    <header className="study-nav">
      <a className="brand" href="/"><span className="mark">DS</span> Danish SDE</a>
      <div className="nav-actions">
        <span className={`sync-state ${session ? "synced" : "local"}`}><Cloud size={15} /> {session ? "Cloud synced" : "On this device"}</span>
        {session ? <button className="text-button" onClick={signOut}><LogOut size={15} /> Sign out</button> : <button className="button compact" onClick={() => setAuthOpen(true)}><LogIn size={15} /> Sign in to sync</button>}
      </div>
    </header>

    <section className="study-hero">
      <div><p className="eyebrow"><Sparkles size={14} /> Recall-first interview prep</p><h1>Build recall that survives interview day.</h1><p className="hero-copy">Solve inside the complete RB-patterned Striver sheet. Every solved problem starts an adaptive active-recall schedule, and your progress follows you across devices.</p><div className="hero-actions"><a href="#tracker" className="button">Open the full sheet <BookOpenCheck size={16} /></a><button className="text-button" onClick={() => setAuthOpen(true)}>{session ? "Account settings" : "Protect your progress"}</button></div></div>
      <aside className="xp-card"><div className="xp-top"><span>Study XP</span><Award size={19} /></div><strong>{stats.xp}</strong><p>{stats.solved ? `${stats.solved} problems banked` : "Solve your first problem to earn 25 XP"}</p><div className="xp-track"><i style={{ width: `${Math.min(100, (stats.xp % 500) / 5)}%` }} /></div><small>{500 - (stats.xp % 500 || 500)} XP to the next level</small></aside>
    </section>

    <section className="mission-grid">
      <article className="mission-card review-card"><div className="card-icon"><CalendarClock size={20} /></div><div><p className="card-label">Active recall queue</p><h2>{stats.due.length} due {stats.due.length === 1 ? "review" : "reviews"}</h2><p>{nextReview ? `${nextReview.question_title} · ${dateLabel(nextReview.next_review_at)}` : "Your first solve creates tomorrow’s quick recall check."}</p></div>{stats.due.length > 0 && session ? <a href="#review" className="small-button">Review all</a> : <a href="#tracker" className="small-button">Solve one</a>}</article>
      <article className="mission-card"><div className="card-icon orange"><Flame size={20} /></div><div><p className="card-label">Daily quest</p><h2>{Math.min(stats.todaySolved, 3)} / 3 recall reps</h2><p>{Math.max(0, 3 - stats.todaySolved)} more to complete today’s quest.</p></div><div className="quest-dots">{[0, 1, 2].map((i) => <i className={i < stats.todaySolved ? "done" : ""} key={i}><Check size={11} /></i>)}</div></article>
      <article className="mission-card"><div className="card-icon purple"><Target size={20} /></div><div><p className="card-label">SDE sheet progress</p><h2>{stats.solved} / 191 solved</h2><p>{completion}% complete · RB pattern order intact.</p></div><div className="progress-orb" style={{ "--progress": `${completion * 3.6}deg` } as React.CSSProperties}><span>{completion}%</span></div></article>
    </section>

    {message && <p className="study-message" role="status">{message}</p>}
    {!isSupabaseConfigured && <section className="setup-banner"><Cloud size={19} /><div><strong>Cloud sync is ready to connect.</strong><span>Add your Supabase Project URL and publishable key to <code>.env.local</code>, run the included schema, then restart the app.</span></div></section>}

    {session && <section id="review" className="recall-panel"><div className="recall-heading"><div><p className="eyebrow">Memory gym</p><h2>Recall before you reveal the solution.</h2><p>Try to state the pattern, complexity, and key edge case out loud. Then grade the retrieval honestly.</p></div><span>{stats.due.length} due</span></div>{stats.due.length > 0 ? <div className="recall-list">{stats.due.map((record) => <article className="recall-item" key={record.question_id}><div><span className="review-kicker">{record.interval_days || 1}-day interval · {record.review_count} completed recalls</span><h3>{record.question_title}</h3><p>Can you explain the approach without opening notes?</p></div><div className="grade-buttons">{grades.map(({ grade, label, hint, className }) => <button key={grade} className={className} onClick={() => review(record, grade)}><b>{label}</b><small>{hint}</small></button>)}</div></article>)}</div> : <div className="empty-recall">No review is due right now.{nextReview ? ` Your next recall is ${dateLabel(nextReview.next_review_at).toLowerCase()} — ${nextReview.question_title}.` : " Solve a question below; it will come back tomorrow for its first memory check."}</div>}</section>}

    <section id="tracker" className="tracker-section"><div className="tracker-heading"><div><p className="eyebrow">Complete practice library</p><h2>All 191 Striver questions, mapped into the RB pattern vocabulary.</h2></div><span>{loading ? "Loading progress…" : session ? "Changes sync automatically" : "Works offline; sign in to sync"}</span></div><iframe ref={frame} onLoad={() => hydrateTracker(records)} className="cloud-sheet" title="Danish SDE complete tracker" src="/tracker?embed=1" /></section>

    {authOpen && <div className="auth-backdrop" role="presentation" onMouseDown={() => setAuthOpen(false)}><section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(event) => event.stopPropagation()}><div className="auth-logo"><Cloud size={18} /></div><p className="eyebrow">Cloud study profile</p><h2 id="auth-title">Keep your progress forever.</h2><p>Use a passwordless magic link. Your solves, review intervals, XP, and streak data stay attached to your own account.</p>{isSupabaseConfigured ? <form onSubmit={sendMagicLink}><label>Email address<input value={email} onChange={(event) => { setEmail(event.target.value); setAuthMessage(""); }} type="email" placeholder="you@example.com" required autoFocus /></label><button className="button" type="submit">Email me a secure link</button>{authMessage && <p className="auth-status" role="status">{authMessage}</p>}</form> : <p className="config-note">This app still needs its Supabase Project URL in <code>.env.local</code> before sign-in can be enabled.</p>}<button className="dialog-close" onClick={() => setAuthOpen(false)}>Maybe later</button></section></div>}
  </main>;
}
