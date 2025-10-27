"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Plus, Search, Settings, Eye, Edit, Download } from "lucide-react";
import { DialogTrigger } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewProjectForm } from "@/components/forms/new-project-form"
import EditProjectForm from "@/components/forms/edit-project-form"
import ViewProjectForm from "@/components/forms/project-view"
import { useAuth } from "@/lib/auth-context"
import { usePagination } from "@/hooks/use-pagination"
import { http } from "@/lib/http"
import { exportProjectsServerCSV } from "@/lib/csv-export"

// Columns definition
const columns = [
  { key: "code", label: "Code" },
  { key: "name", label: "Nom du Projet" },
  { key: "department", label: "Département" },
  { key: "coordinator", label: "Coordinateur" },
  { key: "totalBudget", label: "Budget Total", className: "text-right" },
  { key: "remainingBudget", label: "Budget Restant", className: "text-right" },
  { key: "status", label: "Statut" },
  { key: "actions", label: "Actions", className: "text-center" },
];
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
  const { pagination, goToPage, updateFromResponse } = usePagination(10);
  const [projects, setProjects] = useState(initialProjectData);
  const [filteredProjects, setFilteredProjects] = useState(initialProjectData);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [viewingProject, setViewingProject] = useState<any | null>(null);

  async function reload() {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchProjectsForUser(
        user,
        pagination.currentPage,
        pagination.pageSize,
      );
      setProjects(data.projects);
      updateFromResponse(data.pagination);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, [user, pagination.currentPage, pagination.pageSize]);

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

    // Apply department filter
    if (selectedDepartment !== "all") {
      const departmentMap: Record<string, string> = {
        tto: "TTO",
        clinique: "Clinique Industrielle",
        tech: "Tech Center",
        cie: "CIE Direct",
      };
      const departmentName = departmentMap[selectedDepartment];
      if (departmentName) {
        filtered = filtered.filter(
          (project) => project.department === departmentName,
        );
      }
    }

    // Apply status filter
    if (selectedStatus !== "all") {
      filtered = filtered.filter(
        (project) => project.status === selectedStatus,
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
      alert('Erreur lors de l\'export des projets');
    }
  };

  // Add actions column dynamically
  const dataWithActions = filteredProjects.map((project) => ({
    ...project,
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
          onClick={() => setEditingProject(project)}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            if (!user) return;
            if (!confirm("Supprimer ce projet ?")) return;
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
          Suppr.
        </Button>
      </div>
    ),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Gestion des Projets
          </h1>
          <p className="text-muted-foreground">
            Suivi et gestion de tous vos projets
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
              Nouveau Projet
            </Button>
          </NewProjectForm>
          <Button variant="ghost" className="flex items-center gap-2" onClick={handleExportCSV}>
            <Download className="h-4 w-4" />
            Exporter CSV
          </Button>
          <Button variant="ghost" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Paramètres
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rechercher</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Code, nom ou coordinateur..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {user?.role !== "department_manager" && (
              <Select
                value={selectedDepartment}
                onValueChange={setSelectedDepartment}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les départements" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les départements</SelectItem>
                  <SelectItem value="tto">TTO</SelectItem>
                  <SelectItem value="clinique">Clinique Industrielle</SelectItem>
                  <SelectItem value="tech">Tech Center</SelectItem>
                  <SelectItem value="cie">CIE Direct</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="en-cours">En cours</SelectItem>
                <SelectItem value="en-pause">En pause</SelectItem>
                <SelectItem value="termine">Terminé</SelectItem>
                <SelectItem value="annule">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <DataTable
        title="Liste des Projets"
        columns={columns}
        data={dataWithActions}
        loading={loading}
        tableId="projects"
      />

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Affichage de {filteredProjects.length} projet(s) sur{" "}
          {pagination.totalCount} total
          {(searchTerm ||
            selectedDepartment !== "all" ||
            selectedStatus !== "all") && (
            <span className="text-blue-600">
              {" "}
              (filtré de {projects.length} projets)
            </span>
          )}
        </div>
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
        />
      </div>

      {/* Edit modal */}
      {editingProject && (
        <EditProjectForm
          project={editingProject}
          onSave={handleSave}
          onClose={() => setEditingProject(null)}
        />
      )}
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
