# Project Manager Page

Home page displaying all projects with CRUD operations.

## Acceptance Criteria

- [ ] Grid/list view of all projects
- [ ] Project cards with thumbnail, name, status
- [ ] Create new project (→ recording page)
- [ ] Delete project with confirmation
- [ ] Search and filter projects
- [ ] Sort by date, name, status
- [ ] Project status badges
- [ ] Click project → project detail page

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Projects                              [Search...] [+ Record]   │
├─────────────────────────────────────────────────────────────────┤
│  Filter: [All ▼]  Sort: [Recent ▼]  View: [Grid] [List]        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │          │
│  │ │screenshot│ │  │ │screenshot│ │  │ │screenshot│ │          │
│  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │          │
│  │              │  │              │  │              │          │
│  │ E-commerce   │  │ Dashboard    │  │ Blog CMS     │          │
│  │ example.com  │  │ app.io       │  │ blog.dev     │          │
│  │ ● Ready      │  │ ◐ Generating │  │ ○ Recorded   │          │
│  │ 2 hours ago  │  │ 5 min ago    │  │ Yesterday    │          │
│  │ ┌───┬───┬───┐│  │              │  │              │          │
│  │ │ ▶ │ ✎ │ 🗑│ │  │              │  │              │          │
│  │ └───┴───┴───┘│  │              │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────┐                                               │
│  │              │                                               │
│  │      +       │                                               │
│  │  New Recording│                                              │
│  │              │                                               │
│  └──────────────┘                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Page Structure

```typescript
// src/app/page.tsx
import { Suspense } from 'react';
import { listProjects } from '@/lib/actions/projects';
import { ProjectGrid } from './components/project-grid';
import { ProjectFilters } from './components/project-filters';
import { NewProjectCard } from './components/new-project-card';

export default async function HomePage() {
  const projects = await listProjects();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <NewRecordingButton />
      </div>

      <ProjectFilters />

      <Suspense fallback={<ProjectGridSkeleton />}>
        <ProjectGrid projects={projects} />
      </Suspense>
    </div>
  );
}
```

## Components

```typescript
// Project grid view
interface ProjectGridProps {
  projects: Project[];
}

function ProjectGrid({ projects }: ProjectGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
      <NewProjectCard />
    </div>
  );
}

// Individual project card
interface ProjectCardProps {
  project: Project;
}

function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/project/${project.id}`}>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="p-0">
          <img
            src={project.thumbnail || '/placeholder.png'}
            alt={project.name}
            className="w-full h-32 object-cover rounded-t-lg"
          />
        </CardHeader>
        <CardContent className="p-4">
          <h3 className="font-semibold">{project.name}</h3>
          <p className="text-sm text-muted-foreground">{project.sourceUrl}</p>
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge status={project.status} />
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(project.updatedAt)}
            </span>
          </div>
        </CardContent>
        <CardFooter className="p-2 border-t">
          <ProjectActions project={project} />
        </CardFooter>
      </Card>
    </Link>
  );
}

// Status badge
function StatusBadge({ status }: { status: ProjectStatus }) {
  const config = {
    draft: { color: 'gray', label: 'Draft' },
    recording: { color: 'red', label: 'Recording', pulse: true },
    recorded: { color: 'yellow', label: 'Recorded' },
    analyzing: { color: 'blue', label: 'Analyzing' },
    generating: { color: 'blue', label: 'Generating', pulse: true },
    ready: { color: 'green', label: 'Ready' },
    error: { color: 'red', label: 'Error' },
  };
  // ...
}

// Project quick actions
function ProjectActions({ project }: { project: Project }) {
  return (
    <div className="flex gap-1">
      {project.status === 'ready' && (
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/project/${project.id}/sandbox`}>
            <PlayIcon /> Launch
          </Link>
        </Button>
      )}
      {project.status === 'recorded' && (
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/project/${project.id}/generate`}>
            <WandIcon /> Generate
          </Link>
        </Button>
      )}
      <DeleteProjectButton project={project} />
    </div>
  );
}

// Filters and search
function ProjectFilters() {
  return (
    <div className="flex items-center gap-4">
      <Input placeholder="Search projects..." className="max-w-xs" />
      <Select defaultValue="all">
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Filter" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="ready">Ready</SelectItem>
          <SelectItem value="recorded">Recorded</SelectItem>
          <SelectItem value="generating">Generating</SelectItem>
        </SelectContent>
      </Select>
      <Select defaultValue="recent">
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recent">Recent</SelectItem>
          <SelectItem value="name">Name</SelectItem>
          <SelectItem value="status">Status</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// Delete confirmation dialog
function DeleteProjectButton({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    await deleteProject(project.id);
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <TrashIcon />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete project?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete "{project.name}" and all associated data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

## Server Actions

```typescript
// src/lib/actions/projects.ts
'use server'

import { getCrayonService } from '@/lib/crayon';
import { revalidatePath } from 'next/cache';

export async function listProjects(filters?: ProjectFilters) {
  const service = getCrayonService();
  return service.listProjects(filters);
}

export async function getProject(id: string) {
  const service = getCrayonService();
  return service.getProject(id);
}

export async function deleteProject(id: string) {
  const service = getCrayonService();
  await service.deleteProject(id);
  revalidatePath('/');
}

export async function updateProject(id: string, data: Partial<Project>) {
  const service = getCrayonService();
  const updated = await service.updateProject(id, data);
  revalidatePath('/');
  revalidatePath(`/project/${id}`);
  return updated;
}
```

## Testing Requirements

### Unit Tests
- Test project card rendering
- Test status badge colors
- Test delete confirmation flow
- Test filter/sort client state

### Integration Tests
- Projects list loads from server
- Delete removes from list
- Navigation to project detail works

## Definition of Done

- [ ] Projects display in grid
- [ ] Status badges show correct state
- [ ] Search filters projects
- [ ] Sort changes order
- [ ] Delete with confirmation works
- [ ] Click navigates to project
- [ ] "New Recording" goes to /record
- [ ] Responsive grid layout
