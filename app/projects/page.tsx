"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Plus, Search, Settings, Eye, Download } from "lucide-react";
import { DialogTrigger } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewProjectForm } from "@/components/forms/new-project-form"
import ViewProjectForm from "@/components/forms/project-view"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { usePagination } from "@/hooks/use-pagination"
import { http } from "@/lib/http"
import { exportProjectsServerCSV } from "@/lib/csv-export"
async function fetchProjectsForUser(
  user: { role: string; department?: string | number | null },
  page: number = 1,
  pageSize: number = 10,
): Promise<{ projects: any[]; pagination: any }> {
  const base = "/api/management"; // resolved by http baseURL

  const allowedDepartments = new Set([
    "CIE Direct",
    "Tech Center",
    "TTO",
    "Clinique Industrielle",
  ]);

  const mapProjects = (projects: any[]) =>
    projects.map((p: any) => ({
      id: p.id,
      departmentId: p.department?.id ?? undefined,
      code: p.project_code,
      name: p.project_name,
      department: p.department?.name ?? "",
      coordinator: p.coordinator,
      totalBudget: Number(p.total_budget).toLocaleString("fr-FR", {
        style: "currency",
        currency: "MAD",
      }),
      remainingBudget: Number(p.remaining_budget).toLocaleString("fr-FR", {
        style: "currency",
        currency: "MAD",
      }),
      status: p.status,
      client: p.client_name,
      startDate: p.signature_date || p.needs_expression_date || "",
      endDate: p.end_date,
    }));

  if (user.role === "director") {
    const { data: raw } = await http.get(`${base}/all/projects/`, {
      params: { page, size: pageSize },
    });
    // Handle paginated response
    const projects = raw.results || raw;
    return {
      projects: mapProjects(Array.isArray(projects) ? projects : []),
      pagination: raw,
    };
  }

  if (user.role === "department_manager" && user.department) {
    const depId =
      typeof user.department === "object"
        ? String((user.department as any)?.id ?? (user.department as any)?.pk ?? "")
        : String(user.department ?? "")
    if (!depId) return { projects: [], pagination: {} }

    const { data: raw } = await http.get(
      `${base}/departments/${depId}/projects/`,
      { params: { page, size: pageSize } },
    );
    // Handle paginated response
    const projects = raw.results || raw;
    return {
      projects: mapProjects(Array.isArray(projects) ? projects : []),
      pagination: raw,
    };
  }

  return { projects: [], pagination: {} };
}

const initialProjectData: any[] = [];

// base API path used throughout this component
const base = "/api/management";

export default function ProjectsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { pagination, goToPage, updateFromResponse } = usePagination(10);
  const [projects, setProjects] = useState(initialProjectData);
  const [filteredProjects, setFilteredProjects] = useState(initialProjectData);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([])
  const [departmentsLoading, setDepartmentsLoading] = useState(false)

  // Map backend status values to localized labels
  const statusLabel = (s?: string) => {
    switch (s) {
      case "In Progress":
        return t("status.inProgress");
      case "Paused":
        return t("status.paused");
      case "Completed":
        return t("status.completed");
      case "Cancelled":
      case "Canceled":
        return t("status.cancelled");
      default:
        return s || "-";
    }
  };

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [viewingProject, setViewingProject] = useState<any | null>(null);
  
  // Columns definition with translations
  const columns = [
    { key: "code", label: t("projects.code") },
    { key: "name", label: t("projects.name") },
    { key: "department", label: t("projects.department") },
    { key: "coordinator", label: t("projects.coordinator") },
    { key: "totalBudget", label: t("projects.totalBudget"), className: "text-right" },
    { key: "remainingBudget", label: t("projects.remainingBudget"), className: "text-right" },
    { key: "status", label: t("projects.status") },
    { key: "actions", label: t("projects.actions"), className: "text-center" },
  ];

  async function reload() {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchProjectsForUser(
        user,
        pagination.currentPage,
        pagination.pageSize,
      );
      // Keep a separate code for status filtering and presentation mapping later
      const withCodes = (data.projects || []).map((p: any) => ({
        ...p,
        statusCode: p.status,
      }));
      setProjects(withCodes);
      updateFromResponse(data.pagination);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, [user, pagination.currentPage, pagination.pageSize]);

  // Load departments from backend for the filter
  useEffect(() => {
    const loadDeps = async () => {
      if (!user) return
      setDepartmentsLoading(true)
      try {
        const allowed = new Set(["CIE Direct", "Tech Center", "TTO", "Clinique Industrielle"]) // keep same policy as elsewhere
        // Directors can see all departments
        const { data: raw } = await http.get(`/api/management/departments/`)
        const arr = Array.isArray((raw as any)?.results || raw) ? (raw as any).results || raw : []
        const list = user.role === "director" ? arr : arr.filter((d: any) => allowed.has(d.name))
        setDepartments(list.map((d: any) => ({ id: Number(d.id), name: String(d.name) })))
      } catch (e) {
        // leave departments empty on error
        setDepartments([])
      } finally {
        setDepartmentsLoading(false)
      }
    }
    loadDeps()
  }, [user])

  // Apply filters whenever projects or filter criteria change
  useEffect(() => {
    let filtered = projects;

    // Apply search term filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (project) =>
          project.code.toLowerCase().includes(term) ||
          project.name.toLowerCase().includes(term) ||
          project.coordinator.toLowerCase().includes(term),
      );
    }

    // Apply department filter (from backend list)
    if (selectedDepartment !== "all") {
      const depId = Number(selectedDepartment)
      filtered = filtered.filter((project: any) => Number(project.departmentId) === depId)
    }

    // Apply status filter
    if (selectedStatus !== "all") {
      filtered = filtered.filter(
        (project: any) => project.statusCode === selectedStatus,
      );
    }

    setFilteredProjects(filtered);
  }, [projects, searchTerm, selectedDepartment, selectedStatus]);

  const handlePageChange = (page: number) => {
    goToPage(page);
  };

  // Update logic
  const handleSave = (updatedProject: any) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.code === updatedProject.code ? { ...p, ...updatedProject } : p,
      ),
    );
    void reload();
  };

  const handleExportCSV = async () => {
    if (!user) return;
    try {
      await exportProjectsServerCSV();
    } catch (error) {
      console.error('Export failed:', error);
      alert(t("messages.error"));
    }
  };

  // Add actions column dynamically
  const dataWithActions = filteredProjects.map((project) => ({
    ...project,
    // Present a localized status label in the table while keeping statusCode for filters
    status: statusLabel((project as any).statusCode ?? (project as any).status),
    actions: (
      <div className="flex items-center justify-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setViewingProject(project)}
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            if (!user) return;
            if (!confirm(t("messages.confirmDelete"))) return;
            try {
              const depId = project.departmentId;
              const projId = project.id;
              if (depId && projId) {
                await http.delete(
                  `${base}/departments/${depId}/projects/${projId}/`,
                );
                await reload();
              }
            } catch {
              // ignore
            }
          }}
        >
          {t("common.delete")}
        </Button>
      </div>
    ),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {t("projects.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("projects.all")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NewProjectForm
            onCreated={async () => {
              if (!user) return;
              const data = await fetchProjectsForUser(
                user,
                pagination.currentPage,
                pagination.pageSize,
              );
              setProjects(data.projects);
              updateFromResponse(data.pagination);
            }}
          >
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t("projects.new")}
            </Button>
          </NewProjectForm>
          <Button variant="ghost" className="flex items-center gap-2" onClick={handleExportCSV}>
            <Download className="h-4 w-4" />
            {t("projects.export")}
          </Button>
          <Button variant="ghost" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t("header.settings")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("common.search")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("projects.search")}
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {user?.role !== "department_manager" && (
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.allDepartments")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.allDepartments")}</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder={t("common.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allStatuses")}</SelectItem>
                <SelectItem value="In Progress">{t("status.inProgress")}</SelectItem>
                <SelectItem value="Paused">{t("status.paused")}</SelectItem>
                <SelectItem value="Completed">{t("status.completed")}</SelectItem>
                <SelectItem value="Cancelled">{t("status.cancelled")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <DataTable
        title={t("projects.title")}
        columns={columns}
        data={dataWithActions}
        loading={loading}
        tableId="projects"
      />

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {t("common.showing")} {filteredProjects.length} {t("common.projects")} {t("common.of")}{" "}
          {pagination.totalCount} {t("common.total")}
          {(searchTerm ||
            selectedDepartment !== "all" ||
            selectedStatus !== "all") && (
            <span className="text-blue-600">
              {" "}
              ({t("common.filteredFrom")} {projects.length} {t("common.projects")})
            </span>
          )}
        </div>
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
        />
      </div>

      {/* View modal */}
      {viewingProject && (
        <ViewProjectForm
          project={viewingProject}
          onClose={() => setViewingProject(null)}
        />
      )}
    </div>
  );
}
