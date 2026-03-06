import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Project, ProjectStatus } from "@crayon/types";
import {
  ProjectList,
  StatusBadge,
  ProjectCard,
  ProjectListItem,
  ProjectFilters,
  ProjectGrid,
  DeleteProjectDialog,
  NewProjectCard,
  ProjectActions,
} from "./project-list";

// Mock the deleteProject action
vi.mock("@/lib/actions/projects", () => ({
  deleteProject: vi.fn(),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="project-image" />
  ),
}));

function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "test-id-1",
    name: "Test Project",
    description: "Test description",
    thumbnail: null,
    status: "draft",
    sourceUrl: "https://example.com",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    recording: null,
    sandbox: null,
    tags: [],
    ...overrides,
  };
}

describe("StatusBadge", () => {
  it.each<[ProjectStatus, string]>([
    ["draft", "Draft"],
    ["recording", "Recording"],
    ["recorded", "Recorded"],
    ["analyzing", "Analyzing"],
    ["generating", "Generating"],
    ["ready", "Ready"],
    ["error", "Error"],
  ])("should render %s status with correct label", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("should show pulse animation for recording status", () => {
    const { container } = render(<StatusBadge status="recording" />);
    expect(container.querySelector(".animate-ping")).toBeInTheDocument();
  });

  it("should show pulse animation for generating status", () => {
    const { container } = render(<StatusBadge status="generating" />);
    expect(container.querySelector(".animate-ping")).toBeInTheDocument();
  });

  it("should show pulse animation for analyzing status", () => {
    const { container } = render(<StatusBadge status="analyzing" />);
    expect(container.querySelector(".animate-ping")).toBeInTheDocument();
  });

  it("should not show pulse for draft status", () => {
    const { container } = render(<StatusBadge status="draft" />);
    expect(container.querySelector(".animate-ping")).not.toBeInTheDocument();
  });

  it("should apply correct color classes for ready status", () => {
    render(<StatusBadge status="ready" />);
    const badge = screen.getByText("Ready");
    expect(badge).toHaveClass("bg-green-100", "text-green-700");
  });

  it("should apply correct color classes for error status", () => {
    render(<StatusBadge status="error" />);
    const badge = screen.getByText("Error");
    expect(badge).toHaveClass("bg-red-100", "text-red-700");
  });
});

describe("DeleteProjectDialog", () => {
  const mockProject = createMockProject({ name: "Project to Delete" });
  const mockOnOpenChange = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when open is false", () => {
    render(
      <DeleteProjectDialog
        project={mockProject}
        open={false}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
        isPending={false}
      />
    );
    expect(screen.queryByText("Delete project?")).not.toBeInTheDocument();
  });

  it("should render dialog content when open", () => {
    render(
      <DeleteProjectDialog
        project={mockProject}
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
        isPending={false}
      />
    );
    expect(screen.getByText("Delete project?")).toBeInTheDocument();
    expect(screen.getByText(/Project to Delete/)).toBeInTheDocument();
  });

  it("should call onConfirm when delete button is clicked", async () => {
    render(
      <DeleteProjectDialog
        project={mockProject}
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
        isPending={false}
      />
    );
    fireEvent.click(screen.getByText("Delete"));
    expect(mockOnConfirm).toHaveBeenCalled();
  });

  it("should call onOpenChange when cancel button is clicked", async () => {
    render(
      <DeleteProjectDialog
        project={mockProject}
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
        isPending={false}
      />
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("should show loading state when isPending", () => {
    render(
      <DeleteProjectDialog
        project={mockProject}
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
        isPending={true}
      />
    );
    expect(screen.getByText("Deleting...")).toBeInTheDocument();
  });

  it("should close on backdrop click", async () => {
    render(
      <DeleteProjectDialog
        project={mockProject}
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
        isPending={false}
      />
    );
    const backdrop = screen.getByLabelText("Close dialog");
    fireEvent.click(backdrop);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("ProjectActions", () => {
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show Launch button for ready projects", () => {
    const project = createMockProject({ status: "ready" });
    render(<ProjectActions project={project} onDelete={mockOnDelete} />);
    expect(screen.getByText("Launch")).toBeInTheDocument();
  });

  it("should show Generate button for recorded projects", () => {
    const project = createMockProject({ status: "recorded" });
    render(<ProjectActions project={project} onDelete={mockOnDelete} />);
    expect(screen.getByText("Generate")).toBeInTheDocument();
  });

  it("should not show Launch button for draft projects", () => {
    const project = createMockProject({ status: "draft" });
    render(<ProjectActions project={project} onDelete={mockOnDelete} />);
    expect(screen.queryByText("Launch")).not.toBeInTheDocument();
  });

  it("should call onDelete when delete button is clicked", async () => {
    const project = createMockProject();
    render(<ProjectActions project={project} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByTitle("Delete project"));
    expect(mockOnDelete).toHaveBeenCalled();
  });
});

describe("ProjectCard", () => {
  const mockOnDelete = vi.fn();

  it("should render project name and URL", () => {
    const project = createMockProject({
      name: "My Project",
      sourceUrl: "https://myproject.com",
    });
    render(<ProjectCard project={project} onDelete={mockOnDelete} />);
    expect(screen.getByText("My Project")).toBeInTheDocument();
    expect(screen.getByText("https://myproject.com")).toBeInTheDocument();
  });

  it("should render status badge", () => {
    const project = createMockProject({ status: "ready" });
    render(<ProjectCard project={project} onDelete={mockOnDelete} />);
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("should render thumbnail when available", () => {
    const project = createMockProject({ thumbnail: "/test-image.png" });
    render(<ProjectCard project={project} onDelete={mockOnDelete} />);
    const img = screen.getByAltText(project.name);
    expect(img).toHaveAttribute("src", "/test-image.png");
  });

  it("should link to project detail page", () => {
    const project = createMockProject({ id: "project-123" });
    render(<ProjectCard project={project} onDelete={mockOnDelete} />);
    const link = screen.getByRole("link", { name: /Test Project/ });
    expect(link).toHaveAttribute("href", "/project/project-123");
  });
});

describe("ProjectListItem", () => {
  const mockOnDelete = vi.fn();

  it("should render project info in list format", () => {
    const project = createMockProject({
      name: "List Project",
      sourceUrl: "https://list.com",
    });
    render(<ProjectListItem project={project} onDelete={mockOnDelete} />);
    expect(screen.getByText("List Project")).toBeInTheDocument();
    expect(screen.getByText("https://list.com")).toBeInTheDocument();
  });
});

describe("NewProjectCard", () => {
  it("should render grid card with link to record page", () => {
    render(<NewProjectCard viewMode="grid" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/record");
    expect(screen.getByText("New Recording")).toBeInTheDocument();
  });

  it("should render list item with link to record page", () => {
    render(<NewProjectCard viewMode="list" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/record");
    expect(screen.getByText("New Recording")).toBeInTheDocument();
  });
});

describe("ProjectFilters", () => {
  const defaultProps = {
    search: "",
    onSearchChange: vi.fn(),
    statusFilter: "all",
    onStatusFilterChange: vi.fn(),
    sortOption: "updatedAt-desc",
    onSortChange: vi.fn(),
    viewMode: "grid" as const,
    onViewModeChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render search input", () => {
    render(<ProjectFilters {...defaultProps} />);
    expect(
      screen.getByPlaceholderText("Search projects...")
    ).toBeInTheDocument();
  });

  it("should call onSearchChange when typing in search", () => {
    render(<ProjectFilters {...defaultProps} />);
    const input = screen.getByPlaceholderText("Search projects...");
    fireEvent.change(input, { target: { value: "test" } });
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith("test");
  });

  it("should call onStatusFilterChange when selecting status", async () => {
    render(<ProjectFilters {...defaultProps} />);
    const select = screen.getByDisplayValue("All");
    fireEvent.change(select, { target: { value: "ready" } });
    expect(defaultProps.onStatusFilterChange).toHaveBeenCalledWith("ready");
  });

  it("should call onViewModeChange when clicking grid button", async () => {
    render(<ProjectFilters {...defaultProps} viewMode="list" />);
    fireEvent.click(screen.getByTitle("Grid view"));
    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith("grid");
  });

  it("should call onViewModeChange when clicking list button", async () => {
    render(<ProjectFilters {...defaultProps} viewMode="grid" />);
    fireEvent.click(screen.getByTitle("List view"));
    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith("list");
  });
});

describe("ProjectGrid", () => {
  const mockOnDeleteProject = vi.fn();

  it("should render empty state when no projects", () => {
    render(
      <ProjectGrid
        projects={[]}
        viewMode="grid"
        onDeleteProject={mockOnDeleteProject}
      />
    );
    expect(screen.getByText("No projects found")).toBeInTheDocument();
  });

  it("should render projects in grid view", () => {
    const projects = [
      createMockProject({ id: "1", name: "Project 1" }),
      createMockProject({ id: "2", name: "Project 2" }),
    ];
    render(
      <ProjectGrid
        projects={projects}
        viewMode="grid"
        onDeleteProject={mockOnDeleteProject}
      />
    );
    expect(screen.getByText("Project 1")).toBeInTheDocument();
    expect(screen.getByText("Project 2")).toBeInTheDocument();
  });

  it("should render projects in list view", () => {
    const projects = [
      createMockProject({ id: "1", name: "Project A" }),
      createMockProject({ id: "2", name: "Project B" }),
    ];
    render(
      <ProjectGrid
        projects={projects}
        viewMode="list"
        onDeleteProject={mockOnDeleteProject}
      />
    );
    expect(screen.getByText("Project A")).toBeInTheDocument();
    expect(screen.getByText("Project B")).toBeInTheDocument();
  });

  it("should include new project card", () => {
    const projects = [createMockProject()];
    render(
      <ProjectGrid
        projects={projects}
        viewMode="grid"
        onDeleteProject={mockOnDeleteProject}
      />
    );
    expect(screen.getByText("New Recording")).toBeInTheDocument();
  });
});

describe("ProjectList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render all initial projects", () => {
    const projects = [
      createMockProject({ id: "1", name: "Alpha" }),
      createMockProject({ id: "2", name: "Beta" }),
      createMockProject({ id: "3", name: "Gamma" }),
    ];
    render(<ProjectList initialProjects={projects} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("should filter projects by search", () => {
    const projects = [
      createMockProject({ id: "1", name: "Alpha Project" }),
      createMockProject({ id: "2", name: "Beta Project" }),
    ];
    render(<ProjectList initialProjects={projects} />);

    const searchInput = screen.getByPlaceholderText("Search projects...");
    fireEvent.change(searchInput, { target: { value: "Alpha" } });

    expect(screen.getByText("Alpha Project")).toBeInTheDocument();
    expect(screen.queryByText("Beta Project")).not.toBeInTheDocument();
  });

  it("should filter projects by status", async () => {
    const projects = [
      createMockProject({ id: "1", name: "Ready Project", status: "ready" }),
      createMockProject({ id: "2", name: "Draft Project", status: "draft" }),
    ];
    render(<ProjectList initialProjects={projects} />);

    const statusSelect = screen.getByDisplayValue("All");
    fireEvent.change(statusSelect, { target: { value: "ready" } });

    expect(screen.getByText("Ready Project")).toBeInTheDocument();
    expect(screen.queryByText("Draft Project")).not.toBeInTheDocument();
  });

  it("should sort projects by name", async () => {
    const projects = [
      createMockProject({ id: "1", name: "Zebra" }),
      createMockProject({ id: "2", name: "Apple" }),
    ];
    render(<ProjectList initialProjects={projects} />);

    const sortSelect = screen.getByDisplayValue("Recent");
    fireEvent.change(sortSelect, { target: { value: "name-asc" } });

    const projectNames = screen.getAllByRole("heading", { level: 3 });
    expect(projectNames[0]).toHaveTextContent("Apple");
    expect(projectNames[1]).toHaveTextContent("Zebra");
  });

  it("should toggle between grid and list view", async () => {
    const projects = [createMockProject()];
    const { container } = render(<ProjectList initialProjects={projects} />);

    // Should start in grid view
    expect(container.querySelector(".grid")).toBeInTheDocument();

    // Switch to list view
    fireEvent.click(screen.getByTitle("List view"));
    expect(container.querySelector(".flex.flex-col.gap-2")).toBeInTheDocument();

    // Switch back to grid view
    fireEvent.click(screen.getByTitle("Grid view"));
    expect(container.querySelector(".grid")).toBeInTheDocument();
  });

  it("should open delete dialog when delete button clicked", async () => {
    const projects = [createMockProject({ name: "Project To Delete" })];
    render(<ProjectList initialProjects={projects} />);

    fireEvent.click(screen.getByTitle("Delete project"));

    expect(screen.getByText("Delete project?")).toBeInTheDocument();
    expect(screen.getAllByText(/Project To Delete/).length).toBeGreaterThan(1);
  });

  it("should close delete dialog when cancel is clicked", async () => {
    const projects = [createMockProject({ name: "My Project" })];
    render(<ProjectList initialProjects={projects} />);

    fireEvent.click(screen.getByTitle("Delete project"));
    expect(screen.getByText("Delete project?")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Delete project?")).not.toBeInTheDocument();
  });

  it("should search by source URL", () => {
    const projects = [
      createMockProject({
        id: "1",
        name: "Project One",
        sourceUrl: "https://example.com",
      }),
      createMockProject({
        id: "2",
        name: "Project Two",
        sourceUrl: "https://different.com",
      }),
    ];
    render(<ProjectList initialProjects={projects} />);

    const searchInput = screen.getByPlaceholderText("Search projects...");
    fireEvent.change(searchInput, { target: { value: "example.com" } });

    expect(screen.getByText("Project One")).toBeInTheDocument();
    expect(screen.queryByText("Project Two")).not.toBeInTheDocument();
  });

  it("should search by description", () => {
    const projects = [
      createMockProject({
        id: "1",
        name: "Project A",
        description: "E-commerce site",
      }),
      createMockProject({
        id: "2",
        name: "Project B",
        description: "Blog platform",
      }),
    ];
    render(<ProjectList initialProjects={projects} />);

    const searchInput = screen.getByPlaceholderText("Search projects...");
    fireEvent.change(searchInput, { target: { value: "commerce" } });

    expect(screen.getByText("Project A")).toBeInTheDocument();
    expect(screen.queryByText("Project B")).not.toBeInTheDocument();
  });
});
