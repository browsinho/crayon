# Reinforcement Learning Training Environments

## The Opportunity

Browser AI agents are advancing rapidly, but training them via reinforcement learning remains severely bottlenecked by the lack of suitable environments. Crayon is uniquely positioned to become **the gym for web agents** - providing realistic, resettable, reward-enabled training environments derived from real websites.

## The Current Problem

### Why RL for Web Agents is Hard

1. **Can't train on production sites**
   - Rate limiting, CAPTCHAs, IP bans
   - Risk of real-world consequences (purchases, data mutations)
   - Non-deterministic (content changes, A/B tests, other users)

2. **Toy environments don't transfer**
   - MiniWoB/MiniWoB++ tasks are too simple
   - Synthetic sites lack the complexity of real DOM structures
   - Agents trained on toys fail on real websites

3. **Building simulators is expensive**
   - Creating a faithful replica of one website takes months
   - Needs constant maintenance as the real site evolves
   - Doesn't scale - need different simulator for each target

4. **No standardized interface**
   - Every research team builds their own environment wrapper
   - No common reward definitions
   - Hard to compare approaches

## How Crayon Solves This

Crayon already captures the essential components needed for RL environments:

| RL Requirement | Crayon Capability |
|----------------|-------------------|
| Realistic environments | Generated from real website recordings |
| Fast reset | Checkpoint system (spec 18) |
| State observation | DOM snapshots, screenshots (specs 02, 04) |
| Action space | MCP tools for browser control (spec 19) |
| Reproducibility | Docker containers with deterministic state |
| Variations | Data generator with Faker.js (spec 14) |

### Expert Demonstrations for Free

Every recorded session IS an expert trajectory. When a human records a "login flow" or "checkout process", we capture:
- Sequence of actions (clicks, typing, navigation)
- State at each step (DOM, network, screenshots)
- The goal state (what success looks like)

This enables imitation learning, inverse RL, and reward shaping without additional labeling.

## Proposed RL Features

### 1. Gym-Compatible Environment Interface

```python
import crayon

# Create environment from a Crayon sandbox
env = crayon.make("sandbox-abc123", task="checkout")

# Standard gym interface
obs = env.reset()
for _ in range(max_steps):
    action = agent.act(obs)
    obs, reward, done, info = env.step(action)
    if done:
        break

# Parallel environments for faster training
envs = crayon.make_vec("sandbox-abc123", task="checkout", num_envs=16)
```

### 2. Task Definitions

Define tasks with goal conditions and reward functions:

```yaml
# tasks/checkout.yaml
task: checkout
description: "Complete a purchase flow"

start_state:
  checkpoint: "cart-with-items"
  url_pattern: "/cart"

goal_conditions:
  - type: url_match
    pattern: "/order-confirmation"
  - type: element_exists
    selector: ".order-success-message"
  - type: api_called
    method: POST
    path: "/api/orders"

rewards:
  sparse: # +1 on success, 0 otherwise
    success: 1.0
    failure: 0.0

  shaped: # Intermediate rewards
    - condition: { type: url_match, pattern: "/checkout" }
      reward: 0.2
    - condition: { type: form_field_filled, selector: "#email" }
      reward: 0.1
    - condition: { type: button_clicked, selector: ".place-order" }
      reward: 0.3

max_steps: 50
timeout_seconds: 120
```

### 3. Observation Spaces

Multiple observation modalities for different agent architectures:

```typescript
interface Observation {
  // Visual (for vision-language models)
  screenshot: Buffer;           // PNG image

  // Structured (for DOM-based agents)
  dom: {
    html: string;               // Cleaned HTML
    accessibilityTree: AXNode;  // Accessibility tree
    interactiveElements: Element[]; // Clickable/typeable elements
  };

  // State
  url: string;
  cookies: Cookie[];
  localStorage: Record<string, string>;

  // History (for transformers)
  previousActions: Action[];
  previousObservations: Observation[]; // Last N
}
```

### 4. Action Spaces

```typescript
type Action =
  | { type: "click"; selector: string }
  | { type: "click_coords"; x: number; y: number }
  | { type: "type"; selector: string; text: string }
  | { type: "press_key"; key: string }
  | { type: "scroll"; direction: "up" | "down"; amount: number }
  | { type: "navigate"; url: string }
  | { type: "wait"; milliseconds: number }
  | { type: "select"; selector: string; value: string };

// Discrete action space for simpler RL
type DiscreteAction = {
  elementIndex: number;  // Which interactive element
  actionType: "click" | "type" | "select";
  textIndex?: number;    // Index into common text snippets
};
```

### 5. Environment Variations (Domain Randomization)

Generate diverse training environments from a single recording:

```typescript
interface EnvironmentVariation {
  // Data variations
  dataVariations: {
    userProfiles: number;      // Generate N different users
    productCatalogs: number;   // N different product sets
    randomizePrices: boolean;
    randomizeInventory: boolean;
  };

  // Visual variations
  visualVariations: {
    colorSchemes: string[];    // Different themes
    fontScaling: [0.8, 1.2];   // Random font size multiplier
    layoutShift: boolean;      // Minor CSS variations
  };

  // Behavioral variations
  behaviorVariations: {
    apiLatency: [100, 2000];   // Random API response delay
    errorRate: 0.05;           // 5% chance of API errors
    validationRules: "random"; // Different form validation
  };
}
```

### 6. Curriculum Learning Support

Progressively harder task variations:

```typescript
interface Curriculum {
  levels: CurriculumLevel[];
}

interface CurriculumLevel {
  name: string;
  unlockCondition: {
    successRate: number;       // e.g., 0.8 = 80% success
    minEpisodes: number;
  };
  variations: {
    // Level 1: Pre-filled forms, no errors
    prefillForms: true;
    apiErrors: false;
    distractorElements: 0;

    // Level 5: Empty forms, random errors, many distractors
    prefillForms: false;
    apiErrors: true;
    distractorElements: 20;
  };
}
```

### 7. Parallel Environment Execution

Run many environments simultaneously for sample-efficient training:

```
┌─────────────────────────────────────────────────────────────────┐
│                     TRAINING ORCHESTRATOR                        │
│                                                                  │
│   Agent Policy ──────────────────────────────────────────────   │
│        │                                                         │
│        ├──▶ Env 1 (Docker) ──▶ obs, reward ──┐                  │
│        ├──▶ Env 2 (Docker) ──▶ obs, reward ──┤                  │
│        ├──▶ Env 3 (Docker) ──▶ obs, reward ──┼──▶ Batch Update  │
│        ├──▶ ...             ──▶ obs, reward ──┤                  │
│        └──▶ Env N (Docker) ──▶ obs, reward ──┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

Implementation via Kubernetes or Docker Swarm for scaling to hundreds of parallel environments.

### 8. Metrics and Logging

Integration with standard RL tooling:

```python
# Weights & Biases integration
env = crayon.make("sandbox-abc123", task="checkout")
env = crayon.wrappers.WandbLogger(env, project="web-agent-training")

# Metrics automatically logged:
# - Episode reward
# - Episode length
# - Success rate
# - Action distribution
# - State visitation heatmap
# - Trajectory videos
```

### 9. Benchmark Suite

Standardized tasks for comparing web agents:

```
crayon-bench/
├── navigation/
│   ├── simple-nav          # Click 3 links to reach target
│   ├── search-and-click    # Use search, click result
│   └── menu-traversal      # Navigate nested menus
├── forms/
│   ├── simple-login        # Username + password
│   ├── registration        # Multi-field form
│   └── checkout            # Address, payment, confirmation
├── data-entry/
│   ├── copy-paste          # Copy data between fields
│   ├── table-editing       # Edit cells in a table
│   └── bulk-operations     # Select multiple, batch action
└── complex/
    ├── email-workflow      # Compose, attach, send
    ├── calendar-booking    # Find slot, book meeting
    └── shopping-cart       # Browse, add items, checkout
```

Each task includes:
- Multiple difficulty levels
- Held-out test variations (different data, visual themes)
- Human baseline performance
- Leaderboard

## Technical Implementation

### New Specs Required

| Spec | Description |
|------|-------------|
| 42 | Gym Environment Wrapper - Python interface |
| 43 | Task Definition Schema - YAML format for tasks |
| 44 | Reward Calculator - Compute rewards from state |
| 45 | Parallel Environment Manager - Orchestrate many envs |
| 46 | Trajectory Logger - Record episodes for analysis |
| 47 | Benchmark Suite - Standardized evaluation tasks |

### Architecture Changes

1. **Faster checkpoint restore**
   - Current: Filesystem copy (~500ms)
   - Needed: Copy-on-write or memory snapshots (~10ms)
   - Consider: CRIU for container checkpointing

2. **Lightweight container mode**
   - Current: Full Node.js + Vite per sandbox
   - Needed: Pre-warmed container pool
   - Consider: Firecracker microVMs for faster boot

3. **Headless screenshot optimization**
   - Current: Full Chrome rendering
   - Needed: GPU-accelerated headless rendering
   - Consider: Batched screenshot capture

4. **gRPC interface for Python**
   - Current: HTTP/JSON API
   - Needed: Low-latency gRPC for tight training loops
   - Consider: Shared memory for observations

### Performance Targets

| Metric | Current | Target |
|--------|---------|--------|
| Environment reset | ~2s | <100ms |
| Step latency | ~500ms | <50ms |
| Screenshot capture | ~200ms | <20ms |
| Parallel envs (single machine) | ~4 | 32+ |
| Parallel envs (cluster) | N/A | 1000+ |

## Research Opportunities

### 1. Reward Learning from Demonstrations
Use recorded human sessions to learn reward functions via inverse RL. No manual reward engineering needed.

### 2. Pre-training on Diverse Websites
Record 1000 different websites → train foundation model that transfers to new sites with minimal fine-tuning.

### 3. Sim-to-Real Transfer
Train in Crayon sandboxes → deploy to real websites. Study the gap and techniques to close it.

### 4. Multi-task Web Agents
Single agent that can handle any task defined in Crayon's task schema. Generalization across websites and workflows.

### 5. Safe Exploration
Crayon sandboxes are safe to explore. Study curiosity-driven and intrinsic motivation approaches without real-world risk.

## Competitive Landscape

| Solution | Realism | Reset Speed | Customizable | RL-Ready |
|----------|---------|-------------|--------------|----------|
| MiniWoB++ | Low | Fast | No | Yes |
| WebArena | Medium | Slow | Limited | Partial |
| Real websites | High | N/A | No | No |
| **Crayon** | High | Fast | Yes | **Goal** |

## Roadmap

### Phase 1: Core RL Interface (MVP)
- Gym-compatible Python wrapper
- Basic task definitions (URL match, element exists)
- Single-environment training
- Checkpoint-based reset

### Phase 2: Scale & Speed
- Parallel environment execution
- Faster checkpoint restore
- Pre-warmed container pools
- gRPC interface

### Phase 3: Benchmark & Community
- Standardized benchmark suite
- Public leaderboard
- Integration with popular RL frameworks (SB3, RLlib, CleanRL)
- Academic partnerships

### Phase 4: Advanced Features
- Automatic reward learning from demonstrations
- Curriculum generation
- Domain randomization
- Multi-agent environments (e.g., customer + support agent)

## Conclusion

Crayon's recording-to-sandbox pipeline creates exactly what RL researchers need: realistic, resettable, customizable web environments. By adding a proper RL interface, we can become the standard platform for training web agents.

The moat is data: every website recording becomes a training environment. As users record more sites, the platform becomes more valuable for RL research. This creates a flywheel between the sandbox product and the RL training platform.

The browser is the universal interface to software. Whoever builds the gym for web agents will shape how AI learns to use the internet.
