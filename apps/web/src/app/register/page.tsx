"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Braces, Check, FileCode2, GitBranch, Loader2, Network, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ApiRequestError } from "@/lib/api";

export default function RegisterPage() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setIsSubmitting(true);
    try {
      await register(email, password, fullName);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.detail : "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col">
      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight" aria-label="DevMind AI home"><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/10"><Braces className="h-5 w-5 text-emerald-400" /></span>DevMind<span className="-ml-1 text-emerald-400">AI</span></Link>
        <Link href="/" aria-label="Back to home" className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /><span className="hidden sm:inline">Back to home</span></Link>
      </header>
      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-16 px-6 py-10 sm:px-10 lg:grid-cols-[1.1fr_1fr] lg:gap-24 lg:py-12">
        <section className="hidden animate-enter lg:block">
          <p className="eyebrow mb-5">HELLO, NEW POSSIBILITIES</p>
          <h2 className="text-[52px] font-semibold leading-[1.12] tracking-[-0.05em]">Great code starts<br />with <span className="text-emerald-400">clear context.</span></h2>
          <p className="mt-6 max-w-sm text-sm leading-[1.85] text-muted-foreground">Give your ideas a place to take shape. Connect your code, find the answers, and build with a little more confidence.</p>
          <div className="animate-float mt-10 rounded-xl border border-white/10 bg-[#0c1117]/90 p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between font-mono text-[10px]"><span className="tracking-wider text-slate-500">YOUR CONTEXT, CONNECTED</span><span className="text-[9px] text-slate-600">WORKFLOW</span></div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-1 flex-col items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 py-5"><GitBranch className="h-5 w-5 text-sky-400" /><span className="text-[10px] text-slate-400">Your code</span></div>
              <span className="h-px w-6 bg-gradient-to-r from-sky-400/30 to-emerald-400/50" aria-hidden="true" />
              <div className="flex flex-1 flex-col items-center gap-3 rounded-lg border border-emerald-400/25 bg-emerald-400/5 px-2 py-5 shadow-[0_0_30px_-12px_rgba(52,211,153,0.3)]"><Braces className="h-5 w-5 text-emerald-400" /><span className="text-[10px] text-emerald-300">DevMind</span></div>
              <span className="h-px w-6 bg-gradient-to-r from-emerald-400/50 to-purple-400/30" aria-hidden="true" />
              <div className="flex flex-1 flex-col items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 py-5"><Sparkles className="h-5 w-5 text-purple-400" /><span className="text-[10px] text-slate-400">Clear answers</span></div>
            </div>
            <div className="mt-6 flex justify-center gap-5 border-t border-white/[0.06] pt-4 text-[10px] text-slate-500"><span className="flex items-center gap-1.5"><FileCode2 className="h-3 w-3" /> Source citations</span><span className="flex items-center gap-1.5"><Network className="h-3 w-3" /> Specialist agents</span></div>
          </div>
          <p className="mt-8 flex items-center gap-2 text-xs text-slate-500"><Check className="h-3.5 w-3.5 text-emerald-400" /> Your personal workspace is created automatically.</p>
        </section>

        <section className="animate-enter stagger-1 mx-auto w-full max-w-md rounded-2xl border border-white/[0.08] bg-card/80 p-7 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-9" aria-labelledby="register-heading">
          <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025]"><Sparkles className="h-5 w-5 text-emerald-400" /></span>
          <p className="mb-2 font-mono text-[10px] tracking-[0.16em] text-slate-500">MAKE ROOM FOR YOUR NEXT IDEA</p>
          <h1 id="register-heading" className="text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your new workspace starts here.</p>
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div className="space-y-2"><Label htmlFor="fullName" className="text-xs text-slate-300">Full name</Label><Input id="fullName" required autoComplete="name" placeholder="Your name" className="h-11 bg-background/70" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="email" className="text-xs text-slate-300">Email address</Label><Input id="email" type="email" required autoComplete="email" placeholder="you@example.com" className="h-11 bg-background/70" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="password" className="text-xs text-slate-300">Password</Label><Input id="password" type="password" required minLength={8} autoComplete="new-password" aria-describedby="password-hint" placeholder="Create a password" className="h-11 bg-background/70" value={password} onChange={(e) => setPassword(e.target.value)} /><p id="password-hint" className="text-[10px] text-slate-500">Use at least 8 characters.</p></div>
            {error ? <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">{error}</p> : null}
            <Button type="submit" className="!mt-6 h-11 w-full" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{isSubmitting ? "Creating your workspace…" : "Create account"}{!isSubmitting ? <ArrowRight className="ml-auto h-4 w-4" /> : null}</Button>
          </form>
          <div className="mt-6 border-t border-white/[0.07] pt-6"><p className="text-center text-xs text-muted-foreground">Already part of the flow? <Link href="/login" className="ml-1 font-medium text-emerald-400 transition-colors hover:text-emerald-300">Log in</Link></p></div>
        </section>
      </div>
      <footer className="relative z-10 flex justify-between px-6 py-6 font-mono text-[10px] text-slate-600 sm:px-10"><span>DEVMIND AI / DEVELOPER WORKSPACE</span><span className="hidden sm:inline">LESS FRICTION. MORE FLOW.</span></footer>
    </main>
  );
}
