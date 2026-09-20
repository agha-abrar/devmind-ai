import Link from "next/link";
import {
  GitBranch,
  FileText,
  Network,
  Bug,
  ClipboardList,
  ShieldCheck,
  ArrowRight,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: GitBranch,
    title: "Repository ingestion",
    description:
      "Connect a GitHub repository and DevMind AI indexes it with structure-aware chunking — functions, classes, and modules, not arbitrary text slices.",
  },
  {
    icon: FileText,
    title: "Documentation knowledge",
    description:
      "Upload READMEs, PDFs, and Word docs. They're chunked by heading/section and embedded alongside your code.",
  },
  {
    icon: Network,
    title: "Hybrid retrieval",
    description:
      "Vector similarity and PostgreSQL full-text search are fused with reciprocal rank fusion, then reranked before reaching any agent.",
  },
  {
    icon: Bug,
    title: "Debugging agent",
    description:
      "Separates retrieved evidence from hypotheses when reasoning about an error, instead of confidently guessing.",
  },
  {
    icon: ClipboardList,
    title: "Implementation planning",
    description:
      "Ask what it would take to add a feature and get a plan grounded in the files that actually exist in your repo.",
  },
  {
    icon: ShieldCheck,
    title: "Evidence review",
    description:
      "A reviewer agent checks every claim against retrieved evidence before you see an answer, and retries retrieval when evidence is thin.",
  },
];

const STEPS = [
  {
    title: "Connect your knowledge",
    description: "Link a GitHub repository and upload supporting documentation to a project.",
  },
  {
    title: "Ask a real question",
    description:
      "\"Where is JWT validation implemented?\" or \"What would it take to add rate limiting?\"",
  },
  {
    title: "A supervisor routes the work",
    description:
      "Only the specialist agents the question actually needs are invoked — code retrieval, docs, debugging, architecture, or planning.",
  },
  {
    title: "Get a cited, reviewed answer",
    description:
      "A reviewer agent checks the answer against evidence before it streams to you, with clickable citations to exact files and lines.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <Brain className="h-5 w-5 text-primary" />
            DevMind AI
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Log in
            </Link>
            <Button asChild size="sm">
              <Link href="/register">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Understand your codebase with AI agents
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          DevMind AI indexes your repositories and documentation, then answers questions with a
          multi-agent workflow that retrieves real evidence, reasons over it, and cites exactly
          where every claim comes from.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/register">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">I already have an account</Link>
          </Button>
        </div>
      </section>

      <section className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-semibold">Built for how engineers actually work</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-lg border border-border bg-card p-6">
                <feature.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-semibold">How it works</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            RAG plus multi-agent orchestration, not a single prompt wrapped around your repo.
          </p>
          <ol className="mt-12 space-y-8">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-2xl font-semibold">Ready to index your codebase?</h2>
          <p className="mt-3 text-muted-foreground">
            Create a project, connect a repository, and ask your first grounded question.
          </p>
          <div className="mt-6">
            <Button asChild size="lg">
              <Link href="/register">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            DevMind AI
          </div>
          <p>Multi-agent code intelligence workspace for software teams.</p>
        </div>
      </footer>
    </div>
  );
}
