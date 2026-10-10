import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Braces,
  Check,
  CheckCheck,
  ChevronRight,
  Code2,
  FileCode2,
  GitBranch,
  Network,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    number: "01",
    icon: Code2,
    title: "Your code. In context.",
    description:
      "Connect repositories and documentation. Find the functions, decisions, and dependencies behind every answer.",
    detail: "CODE + DOCUMENT INTELLIGENCE",
  },
  {
    number: "02",
    icon: Network,
    title: "A team of specialists.",
    description:
      "Code, architecture, and debugging agents work together to turn a complex question into a clear next step.",
    detail: "MULTI-AGENT REASONING",
  },
  {
    number: "03",
    icon: ShieldCheck,
    title: "Evidence you can open.",
    description:
      "Follow citations back to the source. Review the files, inspect the agent run, and understand how the answer was built.",
    detail: "SOURCE-GROUNDED ANSWERS",
  },
];

function EditorPreview() {
  return (
    <div className="relative min-w-0 animate-enter stagger-2">
      <div className="absolute -inset-8 -z-10 rounded-full bg-emerald-500/[0.06] blur-3xl" aria-hidden="true" />
      <div className="overflow-hidden rounded-xl border border-white/[0.12] bg-[#0c1015] shadow-[0_35px_100px_-30px_rgba(0,0,0,0.8)]">
        <div className="flex h-11 items-center justify-between border-b border-white/[0.07] bg-white/[0.025] px-4">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#fa726a]/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ebbe4f]/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#57c690]/80" />
          </div>
          <span className="font-mono text-[10px] text-slate-500">devmind / workspace</span>
          <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">PREVIEW</span>
        </div>
        <div className="flex min-h-[425px]">
          <div className="hidden w-11 shrink-0 flex-col items-center gap-6 border-r border-white/[0.06] py-5 text-slate-600 sm:flex" aria-hidden="true">
            <Braces className="h-4 w-4 text-emerald-400" />
            <GitBranch className="h-4 w-4" />
            <BookOpen className="h-4 w-4" />
            <Network className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3 font-mono text-[10px] text-slate-400">
              <FileCode2 className="h-3 w-3 text-emerald-400" />
              auth/middleware.ts
              <span className="ml-auto text-slate-600">TypeScript</span>
            </div>
            <div className="overflow-x-auto px-4 py-5 font-mono text-[11px] leading-[1.9] sm:text-xs" aria-label="Example authentication code">
              <div className="flex gap-4"><span className="select-none text-slate-700">01</span><code><span className="text-purple-300">export async function</span> <span className="text-sky-300">authenticate</span><span className="text-slate-300">(req) {"{"}</span></code></div>
              <div className="flex gap-4"><span className="select-none text-slate-700">02</span><code className="whitespace-pre">  <span className="text-purple-300">const</span> <span className="text-slate-300">token = req.headers.authorization;</span></code></div>
              <div className="-mx-4 my-1 flex gap-4 border-l-2 border-emerald-400 bg-emerald-400/[0.06] px-3.5"><span className="select-none text-emerald-500/60">03</span><code className="whitespace-pre">  <span className="text-purple-300">const</span> <span className="text-slate-300">user = </span><span className="text-purple-300">await</span> <span className="text-sky-300">verifyToken</span><span className="text-slate-300">(token);</span></code></div>
              <div className="flex gap-4"><span className="select-none text-slate-700">04</span><code className="whitespace-pre">  <span className="text-purple-300">return</span> <span className="text-slate-300">user;</span></code></div>
              <div className="flex gap-4"><span className="select-none text-slate-700">05</span><code className="text-slate-300">{"}"}</code></div>
            </div>
            <div className="border-t border-white/[0.07] bg-[#10151b] px-4 pb-5 pt-4 sm:px-5">
              <div className="mb-4 flex items-center gap-2 text-[10px] font-medium tracking-widest text-slate-400"><Sparkles className="h-3.5 w-3.5 text-emerald-400" /> DEVMIND ASSISTANT</div>
              <div className="mb-4 flex justify-end"><p className="max-w-[90%] rounded-lg rounded-br-sm border border-white/[0.06] bg-white/[0.04] px-3 py-2.5 text-xs text-slate-200">Where does our API validate a user&apos;s token?</p></div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-400/10"><Braces className="h-3.5 w-3.5 text-emerald-400" /></div>
                <div>
                  <p className="text-xs leading-relaxed text-slate-400">Token validation happens in <span className="text-slate-200">authenticate()</span>. It reads the authorization header and passes the token to <span className="text-emerald-300">verifyToken()</span>.</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded border border-emerald-400/15 bg-emerald-400/5 px-2 py-1 font-mono text-[10px] text-emerald-400"><FileCode2 className="h-3 w-3" /> middleware.ts:1–5 <ChevronRight className="h-3 w-3" /></span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.07] bg-emerald-400/[0.04] px-4 py-2 font-mono text-[9px] text-slate-500 sm:text-[10px]">
          <span className="flex items-center gap-1.5"><GitBranch className="h-3 w-3" /> main</span>
          <span className="flex items-center gap-1.5 text-emerald-400/80"><CheckCheck className="h-3 w-3" /> Example answer with source citation</span>
        </div>
      </div>
      <div className="animate-float absolute -bottom-6 -left-4 hidden items-center gap-3 rounded-xl border border-white/10 bg-[#141b22] px-4 py-3 shadow-xl sm:flex">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10"><ShieldCheck className="h-4 w-4 text-emerald-400" /></span>
        <div><p className="text-xs font-medium text-slate-200">Grounded in your code</p><p className="mt-0.5 font-mono text-[10px] text-slate-500">retrieve → reason → review</p></div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <header className="relative z-20 border-b border-white/[0.06] bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight" aria-label="DevMind AI home">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/10"><Braces className="h-5 w-5 text-emerald-400" /></span>
            <span className="hidden min-[380px]:inline">DevMind <span className="text-emerald-400">AI</span></span>
          </Link>
          <nav className="hidden items-center gap-8 text-xs text-muted-foreground md:flex" aria-label="Main navigation">
            <Link href="#capabilities" className="transition-colors hover:text-foreground">Capabilities</Link>
            <Link href="#workflow" className="transition-colors hover:text-foreground">How it works</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-3 sm:gap-5">
            <Link href="/login" className="whitespace-nowrap text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">Log in</Link>
            <Button asChild size="sm" className="h-9 text-xs"><Link href="/register">Get started <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-14 px-6 pb-24 pt-16 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:px-10 lg:pb-32 lg:pt-24">
          <div className="min-w-0 animate-enter">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 font-mono text-[10px] tracking-wider text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> YOUR CODEBASE, CONNECTED
            </div>
            <h1 className="max-w-xl text-[44px] font-semibold leading-[1.09] tracking-[-0.055em] sm:text-[58px] lg:text-[62px]">
              Less searching.<br />More <span className="text-emerald-400">building.</span>
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-[1.85] text-muted-foreground">Meet the AI workspace that understands your code. Explore repositories, untangle bugs, and plan your next move—with answers grounded in your source.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 px-5 text-sm shadow-[0_0_30px_-10px_rgba(52,211,153,0.35)]"><Link href="/register">Open your workspace <ArrowRight className="h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" size="lg" className="h-12 border-white/10 px-5 text-sm"><Link href="#workflow">Explore the workflow <ArrowDown className="h-3.5 w-3.5" /></Link></Button>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-400/70" /> GitHub + documentation</span>
              <span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-400/70" /> Cited, reviewed answers</span>
            </div>
          </div>
          <EditorPreview />
        </section>

        <section className="border-y border-white/[0.06] bg-white/[0.015]">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-8 gap-y-5 px-6 py-6 lg:px-10">
            <p className="font-mono text-[10px] tracking-widest text-slate-500">BUILT FOR THE WAY YOU THINK</p>
            <div className="flex flex-wrap gap-6 text-xs text-slate-400 sm:gap-10">
              <span className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-slate-500" /> Repository aware</span>
              <span className="flex items-center gap-2"><Terminal className="h-4 w-4 text-slate-500" /> Developer first</span>
              <span className="flex items-center gap-2"><Network className="h-4 w-4 text-slate-500" /> Multi-agent intelligence</span>
            </div>
          </div>
        </section>

        <section id="capabilities" className="mx-auto max-w-[1240px] scroll-mt-8 px-6 py-24 lg:px-10">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div><p className="eyebrow mb-3">BUILT FOR BUILDERS</p><h2 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Go from unfamiliar to understood.</h2></div>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">Everything you need to find your footing in a codebase. And keep moving.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <article key={feature.number} className="group rounded-xl border border-white/[0.07] bg-card/60 p-7 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/20 hover:bg-card">
                <div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-emerald-400"><feature.icon className="h-5 w-5" /></span><span className="font-mono text-xs text-slate-600">/{feature.number}</span></div>
                <h3 className="mt-7 text-lg font-medium tracking-tight">{feature.title}</h3>
                <p className="mt-3 text-sm leading-[1.8] text-muted-foreground">{feature.description}</p>
                <p className="mt-7 border-t border-white/[0.06] pt-5 font-mono text-[9px] tracking-widest text-slate-500 transition-colors group-hover:text-emerald-400/80">{feature.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-[1240px] scroll-mt-8 px-6 pb-24 lg:px-10">
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-card/70 p-7 sm:p-10 lg:p-12">
            <div className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full bg-emerald-500/[0.05] blur-3xl" aria-hidden="true" />
            <div className="relative grid grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1fr] lg:gap-20">
              <div className="min-w-0"><p className="eyebrow mb-3">FROM QUESTION TO CLARITY</p><h2 className="text-3xl font-semibold leading-tight tracking-[-0.035em]">Your next breakthrough<br />starts with a question.</h2><p className="mt-5 max-w-sm text-sm leading-[1.8] text-muted-foreground">Bring your code and your curiosity. DevMind connects the dots, so you can focus on what comes next.</p><Button asChild className="mt-7 h-auto min-h-9 max-w-full whitespace-normal px-3 text-xs sm:px-4 sm:text-sm" variant="outline"><Link href="/register">Create your workspace <ArrowRight className="h-4 w-4 shrink-0" /></Link></Button></div>
              <ol className="space-y-7">
                {[
                  ["Connect your code", "Create a project, add a GitHub repository, and upload your docs."],
                  ["Ask anything about it", "Trace a request, investigate a bug, or map out a new feature."],
                  ["Follow the evidence", "Get a reviewed answer with sources and a transparent agent trace."],
                ].map(([title, description], index) => (
                  <li key={title} className="relative flex gap-5">
                    {index < 2 ? <span className="absolute left-[17px] top-10 h-12 border-l border-dashed border-white/10" aria-hidden="true" /> : null}
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/5 font-mono text-xs text-emerald-400">0{index + 1}</span>
                    <div className="pt-1"><h3 className="text-sm font-medium">{title}</h3><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </main>
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-4 px-6 py-7 text-xs text-slate-500 sm:flex-row lg:px-10"><span className="flex items-center gap-2 font-medium text-slate-400"><Braces className="h-4 w-4 text-emerald-400" /> DevMind AI</span><p>A little less friction. A lot more flow.</p><span className="font-mono text-[10px]">BUILT FOR YOUR NEXT COMMIT</span></div>
      </footer>
    </div>
  );
}
