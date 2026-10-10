"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Braces, Check, GitBranch, Loader2, LockKeyhole, Terminal } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ApiRequestError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.detail : "Failed to log in.");
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
      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-16 px-6 py-10 sm:px-10 lg:grid-cols-[1.1fr_1fr] lg:gap-24 lg:py-16">
        <section className="hidden animate-enter lg:block">
          <p className="eyebrow mb-5">PICK UP WHERE YOU LEFT OFF</p>
          <h2 className="text-[52px] font-semibold leading-[1.12] tracking-[-0.05em]">Back in your flow.<br /><span className="text-emerald-400">Back to building.</span></h2>
          <p className="mt-6 max-w-sm text-sm leading-[1.85] text-muted-foreground">Your repositories, conversations, and next big idea. All in one workspace that speaks your language.</p>
          <div className="animate-float mt-10 overflow-hidden rounded-xl border border-white/10 bg-[#0c1117]/90 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3 font-mono text-[10px] text-slate-500"><Terminal className="h-3.5 w-3.5" /> workspace.ts <span className="ml-auto text-[9px] text-slate-600">EXAMPLE</span></div>
            <div className="space-y-2 px-6 py-6 font-mono text-xs leading-relaxed">
              <p className="text-slate-600">{"// Your context. Always connected."}</p>
              <p><span className="text-purple-300">const </span><span className="text-slate-300">workspace = </span><span className="text-sky-300">DevMind</span><span className="text-slate-400">.connect({"{"}</span></p>
              <p className="pl-5"><span className="text-slate-400">code: </span><span className="text-emerald-300">&quot;your repositories&quot;</span><span className="text-slate-500">,</span></p>
              <p className="pl-5"><span className="text-slate-400">context: </span><span className="text-emerald-300">&quot;the bigger picture&quot;</span><span className="text-slate-500">,</span></p>
              <p className="pl-5"><span className="text-slate-400">next: </span><span className="text-emerald-300">&quot;something great&quot;</span></p>
              <p className="text-slate-400">{"});"}</p>
            </div>
            <div className="flex items-center gap-2 border-t border-white/[0.06] bg-emerald-400/[0.03] px-5 py-3 font-mono text-[10px] text-emerald-400/80"><GitBranch className="h-3 w-3" /> one workspace. every connection.</div>
          </div>
          <div className="mt-8 flex gap-5 text-[10px] text-slate-500"><span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-400" /> Code-aware answers</span><span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-400" /> Source citations</span></div>
        </section>

        <section className="animate-enter stagger-1 mx-auto w-full max-w-md rounded-2xl border border-white/[0.08] bg-card/80 p-7 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-9" aria-labelledby="login-heading">
          <span className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025]"><Terminal className="h-5 w-5 text-emerald-400" /></span>
          <p className="mb-2 font-mono text-[10px] tracking-[0.16em] text-slate-500">YOUR WORKSPACE IS WAITING</p>
          <h1 id="login-heading" className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Log in and get back to your code.</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2"><Label htmlFor="email" className="text-xs text-slate-300">Email address</Label><Input id="email" type="email" required autoComplete="email" placeholder="you@example.com" className="h-11 bg-background/70" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="password" className="text-xs text-slate-300">Password</Label><Input id="password" type="password" required autoComplete="current-password" placeholder="Enter your password" className="h-11 bg-background/70" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {error ? <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">{error}</p> : null}
            <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{isSubmitting ? "Opening workspace…" : "Log in"}{!isSubmitting ? <ArrowRight className="ml-auto h-4 w-4" /> : null}</Button>
          </form>
          <div className="mt-7 border-t border-white/[0.07] pt-6"><p className="text-center text-xs text-muted-foreground">New to DevMind? <Link href="/register" className="ml-1 font-medium text-emerald-400 transition-colors hover:text-emerald-300">Create an account</Link></p></div>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-slate-500"><LockKeyhole className="h-3 w-3" /> Your workspace is protected by your account.</p>
        </section>
      </div>
      <footer className="relative z-10 flex justify-between px-6 py-6 font-mono text-[10px] text-slate-600 sm:px-10"><span>DEVMIND AI / DEVELOPER WORKSPACE</span><span className="hidden sm:inline">LESS FRICTION. MORE FLOW.</span></footer>
    </main>
  );
}
