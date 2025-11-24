"use client";

import { useEffect, useState } from "react";
import { FilterBar } from "@/components/ui/filter-bar";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { usePagination } from "@/hooks/use-pagination";
import { http } from "@/lib/http";
import { mapDepartmentLabel } from "@/lib/constants";

// Helper: fetch project-level endpoints in limited-size batches to avoid serial long-running loops
async function fetchProjectExpensesInBatches(base: string, depId: string, projects: any[], params: Record<string, any> = {}, batchSize = 5) {
  const allExpenses: any[] = [];
  for (let i = 0; i < projects.length; i += batchSize) {
    const batch = projects.slice(i, i + batchSize).map((p) => {
      const url = `${base}/departments/${depId}/projects/${p.id}/expenses/`;
      return http.get(url, { params }).then((r) => ({ project: p, data: r.data })).catch(() => ({ project: p, data: { results: [] } }));
    });

    const results = await Promise.all(batch);
    results.forEach((res: any) => {
      const expenses = (res.data && (res.data.results || res.data)) || [];
      expenses.forEach((e: any) => {
        allExpenses.push({
          ...e,
          project_name: res.project.project_name,
          project_code: res.project.project_code,
          projectDepartment: res.project.department?.name || "",
          projectCoordinator: res.project.coordinator || "",
        });
      });
    });
  }

  return allExpenses;
}

async function fetchExpensesForUser(
  user: { role: string; department?: string | number | null },
  page: number = 1,
  pageSize: number = 10,
  filters: Record<string, string> = {},
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
    // Build params from pagination + active filters. Skip empty or 'all' values.
    const params: Record<string, any> = { page, size: pageSize };
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (!v) return;
      if (v === "all") return;
      params[k] = v;
    });

    const { data: raw } = await http.get(`${base}/all/expenses/`, { params });
    const expenses = raw.results || raw;

    const records = expenses.map((e: any) => ({
      project: e.project?.project_name || "N/A",
      code: e.project?.project_code || "N/A",
      date: e.expense_date,
      amount: formatMoney(e.amount),
      amountValue: Number(e.amount || 0),
      category: categoryBadge(e.category),
      supplier: e.supplier_display || e.supplier || "-",
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
    let projects = projectsRaw.results || projectsRaw;

    // If coordinator filter applied, pre-filter projects to reduce downstream requests
    if (filters.coordinator && filters.coordinator !== 'all') {
      const coordFilter = filters.coordinator.trim().toLowerCase();
      projects = projects.filter((p: any) => (p.coordinator || '').trim().toLowerCase() === coordFilter);
    }

    // Collect all expenses from all projects using batched parallel requests to avoid long serial waits
    const paramsForProjects: Record<string, any> = { page: 1, size: 100 };
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (!v || v === 'all') return;
      // Only pass filters that project-level expense endpoint supports
      if (['startDate', 'endDate', 'category'].includes(k)) {
        paramsForProjects[k] = v;
      }
    });

    const allExpenses: any[] = await fetchProjectExpensesInBatches(base, depId, projects, paramsForProjects, 5);

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
      supplier: e.supplier_display || e.supplier || "-",
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
  const { t } = useLanguage();
  const { pagination, goToPage, updateFromResponse } = usePagination(10);
  const [rows, setRows] = useState<any[]>([]);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filterOptions, setFilterOptions] = useState<any>({ departments: [], coordinators: [], categories: [] });

  // Define filterFields and columns here with translations
  const filterFields = [
    {
      type: "date" as const,
            key: "startDate",
            label: t("expenses.startDate"),
            placeholder: "dd/mm/yyyy",
    },
    {
      type: "date" as const,
      key: "endDate",
      label: t("expenses.endDate"),
      placeholder: "dd/mm/yyyy",
    },
    {
      type: "select" as const,
      key: "department",
      label: t("expenses.department"),
      placeholder: t("expenses.all"),
      options: [
        { value: "all", label: t("expenses.all") },
        ...filterOptions.departments.map((d: string) => ({ value: d, label: mapDepartmentLabel(d) })),
      ],
    },
    {
      type: "select" as const,
      key: "coordinator",
      label: t("expenses.coordinator"),
      placeholder: t("expenses.all"),
      options: [
        { value: "all", label: t("expenses.all") },
        ...filterOptions.coordinators.map((c: string) => ({ value: c, label: c })),
      ],
    },
    {
      type: "select" as const,
      key: "category",
      label: t("expenses.category"),
      placeholder: t("expenses.allCategories"),
      options: [
        { value: "all", label: t("expenses.allCategories") },
        ...filterOptions.categories.map((c: string) => ({ value: c, label: c })),
      ],
    },
  ];

  const columns = [
    { key: "project", label: t("expenses.project") },
    { key: "code", label: t("expenses.projectCode") },
    { key: "date", label: t("expenses.date") },
    {
      key: "amount",
      label: t("expenses.amount"),
      className: "text-right font-medium text-blue-600",
    },
    { key: "category", label: t("expenses.category") },
    { key: "supplier", label: t("expenses.supplier") },
  ];

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
        if (!projectDepartment || projectDepartment.toLowerCase() !== filterDepartment.toLowerCase()) return false;
      }

      // Coordinator filter - exact match after normalization
      if (currentFilters.coordinator && currentFilters.coordinator !== "all") {
        const projectCoordinator = (row.projectCoordinator || "").trim();
        const filterCoordinator = currentFilters.coordinator.trim();
        if (!projectCoordinator || projectCoordinator.toLowerCase() !== filterCoordinator.toLowerCase()) return false;
      }

      // Category filter - more precise matching
      if (currentFilters.category && currentFilters.category !== "all") {
        const categoryText = (row.categoryText || "").trim().toLowerCase();
        const filterCategory = currentFilters.category.toLowerCase();

        // Map filter values to actual category values
        const categoryMap: Record<string, string[]> = {
          personnel: ["personnel"],
          equipment: ["equipment", "équipement"],
          subcontracting: ["subcontract", "sous-traitance", "subcontracting"],
          material: ["material", "matériel"],
          consumables: ["consumables", "consommable"],
          other: ["autre", "other"],
        };

        const matchingCategories = categoryMap[filterCategory] || [filterCategory];
        if (!matchingCategories.some((cat) => categoryText === cat || categoryText.includes(cat))) return false;
      }

      return true;
    });
  };

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        let globalLoaded = false;
        // Load global filter options so managers get the full lists
        try {
          const { data: globalFilters } = await http.get('/api/management/all/filters/');
          const sanitize = (arr: any[]) => Array.from(new Set((arr || []).map(a => (a || '').trim()))).filter(Boolean).sort((a,b)=>a.localeCompare(b));
          setFilterOptions({
            departments: sanitize(globalFilters.departments || []),
            coordinators: sanitize(globalFilters.coordinators || []),
            categories: sanitize(globalFilters.expense_categories || []),
          });
          globalLoaded = true;
        } catch (e) {
          // ignore - we'll fallback to deriving options from returned records below if request fails
        }
        // For directors, request server-side filtered/paginated data
        if (user.role === "director") {
          const { records, pagination: pag } = await fetchExpensesForUser(user, 1, pagination.pageSize, filters);
          setRows(records);
          setAllRows(records);
          // Only derive if global lists not loaded (fallback)
          if (!globalLoaded) {
            const sanitize = (arr: any[]) => Array.from(new Set(arr.map(a => (a || '').trim()))).filter(Boolean).sort((a,b)=>a.localeCompare(b));
            const deps = sanitize(records.map((r: any) => r.projectDepartment).filter(Boolean));
            const coords = sanitize(records.map((r: any) => r.projectCoordinator).filter(Boolean));
            const cats = sanitize(records.map((r: any) => r.categoryText).filter(Boolean));
            setFilterOptions({ departments: deps, coordinators: coords, categories: cats });
          }
          updateFromResponse({ page: pag.page || 1, total: pag.total || 1, count: pag.count || 0 });
        } else {
          // department_manager or others: keep previous approach but pass filters to project-level calls
          const data = await fetchExpensesForUser(user, 1, 1000, filters);
          setAllRows(data.records);
          const filteredData = applyFilters(data.records, filters);
          const totalPages = Math.max(1, Math.ceil(filteredData.length / pagination.pageSize));
          setRows(filteredData.slice(0, pagination.pageSize));
          updateFromResponse({ page: 1, total: totalPages, count: filteredData.length });
          const deps = Array.from(new Set(data.records.map((r: any) => r.projectDepartment).filter(Boolean)));
          const coords = Array.from(new Set(data.records.map((r: any) => r.projectCoordinator).filter(Boolean)));
          const cats = Array.from(new Set(data.records.map((r: any) => r.categoryText).filter(Boolean)));
          // Fallback only if global filter endpoint failed
          if (!globalLoaded) {
            const sanitize = (arr: any[]) => Array.from(new Set(arr.map(a => (a || '').trim()))).filter(Boolean).sort((a,b)=>a.localeCompare(b));
            setFilterOptions({ departments: sanitize(deps), coordinators: sanitize(coords), categories: sanitize(cats) });
          }
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    // When filters or page change: director => server-side fetch; department managers => client-side filter/pagination
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        if (user.role === "director") {
          const { records, pagination: pag } = await fetchExpensesForUser(user, pagination.currentPage, pagination.pageSize, filters);
          setRows(records);
          // avoid resetting allRows here to prevent triggering this effect again
          updateFromResponse({ page: pag.page || pagination.currentPage, total: pag.total || 1, count: pag.count || 0 });
        } else {
          const filteredData = applyFilters(allRows, filters);
          const totalPages = Math.max(1, Math.ceil(filteredData.length / pagination.pageSize));
          const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
          const endIndex = startIndex + pagination.pageSize;
          setRows(filteredData.slice(startIndex, endIndex));
          updateFromResponse({ page: pagination.currentPage, total: totalPages, count: filteredData.length });
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filters, pagination.currentPage, pagination.pageSize]);

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
    { label: t("expenses.totalExpenses"), value: String(rows.length) },
    { label: t("expenses.totalAmount"), value: totalAmountStr },
    {
      label: t("expenses.projectsInvolved"),
      value: String(new Set(rows.map((r) => r.code)).size),
    },
  ];

  // Project-level aggregation (totals per project for current filtered page data)
  const projectAggregates = (() => {
    const map: Record<string, { project: string; code: string; total: number; count: number }> = {};
    rows.forEach((r: any) => {
      const key = r.code || r.project;
      if (!map[key]) {
        map[key] = { project: r.project, code: r.code, total: 0, count: 0 };
      }
      map[key].total += Number(r.amountValue || 0);
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => a.project.localeCompare(b.project));
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {t("expenses.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("expenses.subtitle")}
        </p>
      </div>

      {/* Hide department filter for department managers (they only see their own dept) */}
      <FilterBar
        fields={user?.role === "department_manager" ? filterFields.filter((f: any) => f.key !== "department") : filterFields}
        onFilter={handleFilter}
        onReset={handleReset}
        initialFilters={filters}
      />

      <DataTable
        title={t("expenses.list")}
        columns={columns}
        data={rows}
        summary={summary}
        loading={loading}
        tableId="expenses"
      />

      {/* Empty state when filtering by department yields no results */}
      {!loading && rows.length === 0 && filters.department && filters.department !== 'all' && (
        <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3">
          {t('expenses.noDepartmentResults') || 'Aucune dépense trouvée pour le département sélectionné.'}
        </div>
      )}

      {/* Project aggregate row table */}
      {!loading && projectAggregates.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">{t('expenses.projectTotals') || 'Totaux par projet (page filtrée)'}</h2>
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">{t('expenses.project') || 'Projet'}</th>
                  <th className="text-left p-2">{t('expenses.projectCode') || 'Code'}</th>
                  <th className="text-right p-2">{t('expenses.totalAmount') || 'Montant total'}</th>
                  <th className="text-right p-2">{t('expenses.expenseCount') || 'Nombre dépenses'}</th>
                </tr>
              </thead>
              <tbody>
                {projectAggregates.map(agg => (
                  <tr key={agg.code} className="border-t">
                    <td className="p-2">{agg.project}</td>
                    <td className="p-2">{agg.code}</td>
                    <td className="p-2 text-right font-medium text-blue-600">{agg.total.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })}</td>
                    <td className="p-2 text-right">{agg.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {t("common.showing")} {rows.length} {t("expenses.expenseCount")} {t("common.of")} {pagination.totalCount}{" "}
          {t("common.total")}
          {Object.keys(filters).some(
            (key) => filters[key] && filters[key] !== "all",
          ) && (
            <span className="text-blue-600 ml-2">
              ({t("common.filteredFrom")} {allRows.length} {t("expenses.expenseCount")})
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
