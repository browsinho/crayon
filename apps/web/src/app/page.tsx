import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Database,
  Github,
  MousePointerClick,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const REPO_URL = "https://github.com/browsinho/crayon.git";

const pillars = [
  {
    title: "Record Real Sessions",
    description:
      "Capture DOM snapshots, network traffic, screenshots, and user interactions from real browser flows.",
  },
  {
    title: "Generate Production-Like Sandboxes",
    description:
      "Transform recordings into runnable frontend and backend replicas with realistic seeded data.",
  },
  {
    title: "Ship MCP-Native Workflows",
    description:
      "Give AI agents structured tools to inspect, test, and control generated environments with confidence.",
  },
];

const workflow = [
  {
    step: "01",
    title: "Record app behavior",
    description:
      "Start from a real URL and capture real user journeys with DOM, network, and screenshot context.",
    bullets: ["Live browser recording", "Interaction timeline", "Network request capture"],
  },
  {
    step: "02",
    title: "Generate a runnable replica",
    description:
      "Crayon analyzes the recording and synthesizes a realistic frontend, backend, and data model.",
    bullets: ["Frontend + backend generation", "Seeded data and schemas", "Production-like test environment"],
  },
  {
    step: "03",
    title: "Run agents against sandboxes",
    description:
      "Use MCP tools to let agents inspect, act, and evaluate behavior in deterministic environments.",
    bullets: ["MCP-native controls", "Repeatable evaluation loops", "Safer experimentation"],
  },
];

function WorkflowMock({ step }: { step: string }) {
  if (step === "01") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-medium text-zinc-500">Live Recording</div>
          <div className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-600">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            REC
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-16 rounded-md border border-zinc-200 bg-zinc-50" />
          <div className="flex items-center gap-2 rounded-md border border-zinc-200 p-2">
            <MousePointerClick className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-xs text-zinc-600">Clicked &quot;Sign in&quot; button</span>
          </div>
          <div className="h-2 w-2/3 rounded-full bg-zinc-200" />
        </div>
      </div>
    );
  }

  if (step === "02") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-xs font-medium text-zinc-500">Generation Pipeline</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-xs">
            <span className="text-zinc-700">Frontend</span>
            <span className="text-green-600">Ready</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-xs">
            <span className="text-zinc-700">Backend</span>
            <span className="text-green-600">Ready</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-xs">
            <span className="text-zinc-700">Data</span>
            <span className="text-zinc-600">Seeding...</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full w-2/3 rounded-full gradient-bg-sharp" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-xs font-medium text-zinc-500">Agent + MCP Runtime</div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-md border border-zinc-200 p-2 text-xs text-zinc-700">
          <Bot className="h-3.5 w-3.5 text-zinc-500" />
          Agent asks: &quot;Validate checkout flow&quot;
        </div>
        <div className="flex items-center gap-2 rounded-md border border-zinc-200 p-2 text-xs text-zinc-700">
          <Database className="h-3.5 w-3.5 text-zinc-500" />
          MCP tool returns sandbox state + logs
        </div>
        <div className="flex items-center gap-2 rounded-md border border-zinc-200 p-2 text-xs text-zinc-700">
          <WandSparkles className="h-3.5 w-3.5 text-zinc-500" />
          Evaluation result: pass / fail
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="relative min-h-full overflow-hidden bg-white text-zinc-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-500/12 blur-3xl" />
      </div>

      <section className="relative mx-auto flex w-full max-w-5xl flex-col px-6 pb-20 pt-20 md:px-10">
       

        <div className="mt-10 max-w-4xl">
          <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-zinc-200 bg-white px-3 py-2 shadow-sm">
            <div className="h-8 w-8 rounded-full gradient-bg-sharp" />
            <span className="text-lg font-semibold tracking-tight text-zinc-900">
              Crayon
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl md:text-6xl">
            Open-source browser-agent sandboxes, built from real-world sessions.
          </h1>
          <p className="mt-5 max-w-3xl text-base text-zinc-600 sm:text-lg">
            Crayon records how apps actually behave, analyzes flows, and generates
            functional environments that AI agents can use for repeatable testing,
            debugging, and training.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            asChild
            className="gradient-bg border-0 text-white font-semibold shadow-md hover:opacity-95"
          >
            <Link href={REPO_URL} target="_blank" rel="noreferrer">
              <Github className="h-4 w-4" />
              View on GitHub
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {pillars.map((pillar) => (
            <div
              key={pillar.title}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-base font-semibold text-zinc-900">{pillar.title}</h2>
              <p className="mt-2 text-sm text-zinc-600">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-14 space-y-4">
          <p className="text-sm uppercase tracking-widest text-zinc-500">
            How Crayon works
          </p>
          {workflow.map((item) => (
            <div
              key={item.step}
              className="grid gap-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-2 md:p-6"
            >
              <div>
                <p className="text-xs font-semibold tracking-widest text-zinc-500">
                  STEP {item.step}
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-zinc-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                  {item.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.bullets.map((bullet) => (
                    <span
                      key={bullet}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700"
                    >
                      {bullet}
                    </span>
                  ))}
                </div>
              </div>
              <div className="self-center">
                <WorkflowMock step={item.step} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm uppercase tracking-widest text-zinc-500">
            Why teams use Crayon
          </p>
          <p className="mt-3 max-w-3xl text-lg font-medium leading-relaxed text-zinc-900">
            Replace brittle mocks with environments grounded in real browser behavior.
            Iterate faster on agent prompts, tools, and evaluation loops with reproducible
            sandboxes that feel like production.
          </p>
          <div className="mt-6">
            <Link
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 underline-offset-4 hover:underline"
            >
              Explore source code, docs, and examples
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
