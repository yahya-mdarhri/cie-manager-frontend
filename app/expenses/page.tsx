"use client";

import { useEffect, useState } from "react";
import { FilterBar } from "@/components/ui/filter-bar";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { usePagination } from "@/hooks/use-pagination";
import { http } from "@/lib/http";

const filterFields = [
  {
    type: "date" as const,
    key: "startDate",
    label: "Date de début",
    placeholder: "dd/mm/yyyy",
  },
  {
    type: "date" as const,
    key: "endDate",
    label: "Date de fin",
    placeholder: "dd/mm/yyyy",
  },
  {
    type: "select" as const,
    key: "department",
    label: "Département",
    placeholder: "Tous",
    options: [
      { value: "all", label: "Tous" },
      { value: "CIE Direct", label: "CIE Direct" },
      { value: "Tech Center", label: "Tech Center" },
      { value: "TTO", label: "TTO" },
      { value: "Clinique Industrielle", label: "Clinique Industrielle" },
    ],
  },
  {
    type: "select" as const,
    key: "coordinator",
    label: "Coordinateur",
    placeholder: "Tous",
    options: [
      { value: "all", label: "Tous" },
      { value: "Omar Jebbouri", label: "Omar Jebbouri" },
      { value: "Wacim Benyahya", label: "Wacim Benyahya" },
      { value: "Bertrand Denise", label: "Bertrand Denise" },
    ],
  },
  {
    type: "select" as const,
    key: "category",
    label: "Catégorie",
    placeholder: "Toutes",
    options: [
      { value: "all", label: "Toutes" },
      { value: "personnel", label: "Personnel" },
      { value: "equipment", label: "Équipement" },
      { value: "subcontracting", label: "Sous-traitance" },
      { value: "material", label: "Matériel" },
      { value: "consumables", label: "Consommable" },
      { value: "other", label: "Autre" },
    ],
  },
];

const columns = [
  { key: "project", label: "Projet" },
  { key: "code", label: "Code Projet" },
  { key: "date", label: "Date" },
  {
    key: "amount",
    label: "Montant",
    className: "text-right font-medium text-blue-600",
  },
  { key: "category", label: "Catégorie" },
  { key: "supplier", label: "Fournisseur" },
];

async function fetchExpensesForUser(
  user: { role: string; department?: string | number | null },
  page: number = 1,
  pageSize: number = 10,
) {
  const base = "/api/management";
  const allowedDepartments = new Set([
    "CIE Direct",
    "Tech Center",
    "TTO",
    "Clinique Industrielle",
  ]);

  const formatMoney = (n: number) =>
    Number(n || 0).toLocaleString("fr-FR", {
      style: "currency",
      currency: "MAD",
    });
  const categoryBadge = (c?: string) => {
    const v = (c || "").toLowerCase();
    if (v.includes("personnel"))
      return <Badge variant="secondary">Personnel</Badge>;
    if (v.includes("equipment") || v.includes("équipement"))
      return <Badge variant="outline">Équipement</Badge>;
    if (v.includes("subcontract"))
      return <Badge variant="outline">Sous-traitance</Badge>;
    return <Badge variant="default">Autre</Badge>;
  };

  // For directors, use the all expenses endpoint for proper pagination
  if (user.role === "director") {
    const { data: raw } = await http.get(`${base}/all/expenses/`, { params: { page, size: pageSize } });
    const expenses = raw.results || raw;

    const records = expenses.map((e: any) => ({
      project: e.project?.project_name || "N/A",
      code: e.project?.project_code || "N/A",
      date: e.expense_date,
      amount: formatMoney(e.amount),
      amountValue: Number(e.amount || 0),
      category: categoryBadge(e.category),
      supplier: e.supplier || "-",
      // Additional fields for filtering
      projectDepartment: e.project?.department?.name || "",
      projectCoordinator: e.project?.coordinator || "",
      categoryText: e.category || "",
    }));

    return { records, pagination: raw };
  }

  // For department managers, fetch from their department's projects
  if (user.role === "department_manager" && user.department) {
    const depId =
      typeof user.department === "object"
        ? String((user.department as any)?.id ?? (user.department as any)?.pk ?? "")
        : String(user.department ?? "");

    if (!depId) return { records: [], pagination: {} };

    // First get all projects for the department
    const { data: projectsRaw } = await http.get(`${base}/departments/${depId}/projects/`, { params: { page: 1, size: 100 } });
    const projects = projectsRaw.results || projectsRaw;

    // Collect all expenses from all projects
    const allExpenses: any[] = [];
    for (const p of projects) {
      const { data: raw } = await http.get(`${base}/departments/${depId}/projects/${p.id}/expenses/`, { params: { page: 1, size: 100 } });
      {
        const expenses = raw.results || raw;
        expenses.forEach((e: any) => {
          allExpenses.push({
            ...e,
            project_name: p.project_name,
            project_code: p.project_code,
            projectDepartment: p.department?.name || "",
            projectCoordinator: p.coordinator || "",
          });
        });
      }
    }

    // Implement frontend pagination for department managers
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedExpenses = allExpenses.slice(startIndex, endIndex);

    const records = paginatedExpenses.map((e: any) => ({
      project: e.project_name,
      code: e.project_code,
      date: e.expense_date,
      amount: formatMoney(e.amount),
      amountValue: Number(e.amount || 0),
      category: categoryBadge(e.category),
      supplier: e.supplier || "-",
      // Additional fields for filtering
      projectDepartment: e.projectDepartment || "",
      projectCoordinator: e.projectCoordinator || "",
      categoryText: e.category || "",
    }));

    return {
      records,
      pagination: {
        page,
        total: Math.ceil(allExpenses.length / pageSize),
        count: allExpenses.length,
      },
    };
  }

  return { records: [], pagination: {} };
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const { pagination, goToPage, updateFromResponse } = usePagination(10);
  const [rows, setRows] = useState<any[]>([]);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const applyFilters = (
    data: any[],
    currentFilters: Record<string, string>,
  ) => {
    return data.filter((row) => {
      // Date range filter - normalize dates to avoid timezone issues
      if (currentFilters.startDate) {
        const rowDate = new Date(row.date);
        const startDate = new Date(currentFilters.startDate);
        // Set time to start of day for accurate comparison
        rowDate.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);
        if (rowDate < startDate) return false;
      }
      if (currentFilters.endDate) {
        const rowDate = new Date(row.date);
        const endDate = new Date(currentFilters.endDate);
        // Set time to end of day for end date
        rowDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        if (rowDate > endDate) return false;
      }

      // Department filter - exact match after normalization
      if (currentFilters.department && currentFilters.department !== "all") {
        const projectDepartment = (row.projectDepartment || "").trim();
        const filterDepartment = currentFilters.department.trim();
        if (projectDepartment.toLowerCase() !== filterDepartment.toLowerCase())
          return false;
      }

      // Coordinator filter - exact match after normalization
      if (currentFilters.coordinator && currentFilters.coordinator !== "all") {
        const projectCoordinator = (row.projectCoordinator || "").trim();
        const filterCoordinator = currentFilters.coordinator.trim();
        if (
          projectCoordinator.toLowerCase() !== filterCoordinator.toLowerCase()
        )
          return false;
      }

      // Category filter - more precise matching
      if (currentFilters.category && currentFilters.category !== "all") {
        const categoryText = (row.categoryText || "").trim().toLowerCase();
        const filterCategory = currentFilters.category.toLowerCase();

        // Map filter values to actual category values
        const categoryMap: Record<string, string[]> = {
          personnel: ["personnel", "personal"],
          equipment: ["equipment", "équipement"],
          subcontracting: ["subcontract", "sous-traitance", "subcontracting"],
          material: ["material", "matériel"],
          consumables: ["consumable", "consommable"],
          other: ["autre", "other"],
        };

        const matchingCategories = categoryMap[filterCategory] || [
          filterCategory,
        ];
        if (!matchingCategories.some((cat) => categoryText.includes(cat)))
          return false;
      }

      return true;
    });
  };

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const data = await fetchExpensesForUser(user, 1, 1000); // Load more data for filtering
        setAllRows(data.records);
        // Apply initial filters if any
        const filteredData = applyFilters(data.records, filters);
        const totalPages = Math.max(
          1,
          Math.ceil(filteredData.length / pagination.pageSize),
        );
        setRows(filteredData.slice(0, pagination.pageSize));
        updateFromResponse({
          page: 1,
          total: totalPages,
          count: filteredData.length,
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    if (allRows.length === 0) return;

    const filteredData = applyFilters(allRows, filters);
    const totalPages = Math.max(
      1,
      Math.ceil(filteredData.length / pagination.pageSize),
    );
    const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;

    setRows(filteredData.slice(startIndex, endIndex));
    updateFromResponse({
      page: pagination.currentPage,
      total: totalPages,
      count: filteredData.length,
    });
  }, [filters, pagination.currentPage, allRows, pagination.pageSize]);

  const handlePageChange = (page: number) => {
    goToPage(page);
  };

  const handleFilter = (newFilters: Record<string, string>) => {
    setFilters(newFilters);
    goToPage(1); // Reset to first page when filtering
  };

  const handleReset = () => {
    setFilters({});
    goToPage(1);
  };

  const totalAmount = rows.reduce(
    (sum, r: any) => sum + Number(r.amountValue || 0),
    0,
  );
  const totalAmountStr = Number(totalAmount).toLocaleString("fr-FR", {
    style: "currency",
    currency: "MAD",
  });
  const summary = [
    { label: "Total Dépenses", value: String(rows.length) },
    { label: "Montant Total", value: totalAmountStr },
    {
      label: "Projets Impliqués",
      value: String(new Set(rows.map((r) => r.code)).size),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Gestion des Dépenses
        </h1>
        <p className="text-muted-foreground">
          Suivi et analyse des dépenses par projet
        </p>
      </div>

      {/* Hide department filter for department managers (they only see their own dept) */}
      <FilterBar
        fields={user?.role === "department_manager" ? filterFields.filter(f => f.key !== "department") : filterFields}
        onFilter={handleFilter}
        onReset={handleReset}
        initialFilters={filters}
      />

      <DataTable
        title="Liste des Dépenses"
        columns={columns}
        data={rows}
        summary={summary}
        loading={loading}
        tableId="expenses"
      />

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Affichage de {rows.length} dépense(s) sur {pagination.totalCount}{" "}
          total
          {Object.keys(filters).some(
            (key) => filters[key] && filters[key] !== "all",
          ) && (
            <span className="text-blue-600 ml-2">
              (filtré de {allRows.length} dépenses)
            </span>
          )}
        </div>
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
