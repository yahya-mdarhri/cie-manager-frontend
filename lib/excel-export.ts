import * as XLSX from 'xlsx';

export const exportProjectsToExcel = (projects: any[], filename: string = 'projects_export.xlsx') => {
  // Map projects to a flat structure suitable for Excel
  const data = projects.map(p => ({
    "Code": p.code,
    "Name": p.name,
    "Department": p.department,
    "Coordinator": p.coordinator,
    "Client": p.client,
    "Total Budget": p.totalBudget,
    "Remaining Budget": p.remainingBudget,
    "Status": p.status,
    "Start Date": p.startDate,
    "End Date": p.endDate
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Projects");
  
  // Generate buffer
  XLSX.writeFile(workbook, filename);
};
