import { http } from './http'

interface ProjectData {
  id: number
  project_code: string
  project_name: string
  coordinator: string
  project_nature: string
  department: {
    id: number
    name: string
  }
  end_date: string
  total_budget: number
  committed_budget: number
  remaining_budget: number
  status: string
  client_name: string
  description: string
  objective: string
  signature_date?: string
  needs_expression_date?: string
  client_po_date?: string
  created_at: string
  updated_at: string
}

interface ExpenseData {
  id: number
  amount: number
  expense_date: string
  category: string
  supplier?: string
  invoice_reference?: string
  description?: string
  payment_date?: string
  project?: {
    project_code: string
    project_name: string
  }
}

interface PaymentData {
  id: number
  amount: number
  payment_received_date: string
  payment_type: string
  payment_reference?: string
  description?: string
  project?: {
    project_code: string
    project_name: string
  }
}

interface JalonData {
  id: number
  name: string
  description?: string
  start_date: string
  end_date: string
  execution_status: boolean
  execution_comments?: string
  created_at: string
  project?: {
    project_code: string
    project_name: string
  }
}

// Utility function to convert array of objects to CSV
function arrayToCSV(data: any[], headers: string[]): string {
  const csvHeaders = headers.join(',')
  
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = getNestedValue(row, header)
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (value !== null && value !== undefined) {
        const stringValue = String(value)
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      }
      return ''
    }).join(',')
  )
  
  return [csvHeaders, ...csvRows].join('\n')
}

// Get nested object property by dot notation
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

// Download CSV file
function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

// Export projects data
export async function exportProjectsCSV(user: any): Promise<void> {
  try {
    let projects: ProjectData[] = []
    const base = "/api/management"

    if (user.role === "director") {
      const { data: raw } = await http.get(`${base}/all/projects/`, { params: { page: 1, size: 10000 } })
      projects = (raw?.results || raw) ?? []
    } else if (user.role === "department_manager" && user.department) {
      const { data: raw } = await http.get(`${base}/departments/${user.department}/projects/`, { params: { page: 1, size: 10000 } })
      projects = (raw?.results || raw) ?? []
    }

    const headers = [
      'project_code',
      'project_name', 
      'coordinator',
      'project_nature',
      'department.name',
      'client_name',
      'status',
      'end_date',
      'total_budget',
      'committed_budget',
      'remaining_budget',
      'description',
      'objective',
      'signature_date',
      'needs_expression_date',
      'client_po_date',
      'created_at'
    ]

    const csvContent = arrayToCSV(projects, headers)
    const today = new Date().toISOString().split('T')[0]
    downloadCSV(csvContent, `projets_${today}.csv`)
  } catch (error) {
    console.error('Error exporting projects:', error)
    throw new Error('Erreur lors de l\'export des projets')
  }
}

// Export expenses data
export async function exportExpensesCSV(user: any): Promise<void> {
  try {
    let expenses: ExpenseData[] = []
    const base = "/api/management"

    if (user.role === "director") {
      const { data: raw } = await http.get(`${base}/all/expenses/`, { params: { page: 1, size: 10000 } })
      expenses = (raw?.results || raw) ?? []
    } else if (user.role === "department_manager" && user.department) {
      // For department managers, we need to get expenses from all their projects
      const { data: projectsRaw } = await http.get(`${base}/departments/${user.department}/projects/`, { params: { page: 1, size: 1000 } })
      const projects = (projectsRaw?.results || projectsRaw) ?? []
      
      for (const project of projects) {
        try {
          const { data: expensesRaw } = await http.get(`${base}/departments/${user.department}/projects/${project.id}/expenses/`, { params: { page: 1, size: 1000 } })
          const projectExpenses = (expensesRaw?.results || expensesRaw) ?? []
          expenses = [...expenses, ...projectExpenses]
        } catch (e) {
          console.warn(`Failed to fetch expenses for project ${project.id}:`, e)
        }
      }
    }

    const headers = [
      'project.project_code',
      'project.project_name',
      'amount',
      'expense_date',
      'category',
      'supplier',
      'invoice_reference',
      'description',
      'payment_date'
    ]

    const csvContent = arrayToCSV(expenses, headers)
    const today = new Date().toISOString().split('T')[0]
    downloadCSV(csvContent, `depenses_${today}.csv`)
  } catch (error) {
    console.error('Error exporting expenses:', error)
    throw new Error('Erreur lors de l\'export des dépenses')
  }
}

// Export payments data
export async function exportPaymentsCSV(user: any): Promise<void> {
  try {
    let payments: PaymentData[] = []
    const base = "/api/management"

    if (user.role === "director") {
      const { data: raw } = await http.get(`${base}/all/payments/`, { params: { page: 1, size: 10000 } })
      payments = (raw?.results || raw) ?? []
    } else if (user.role === "department_manager" && user.department) {
      // For department managers, we need to get payments from all their projects
      const { data: projectsRaw } = await http.get(`${base}/departments/${user.department}/projects/`, { params: { page: 1, size: 1000 } })
      const projects = (projectsRaw?.results || projectsRaw) ?? []
      
      for (const project of projects) {
        try {
          const { data: paymentsRaw } = await http.get(`${base}/departments/${user.department}/projects/${project.id}/payments/`, { params: { page: 1, size: 1000 } })
          const projectPayments = (paymentsRaw?.results || paymentsRaw) ?? []
          payments = [...payments, ...projectPayments]
        } catch (e) {
          console.warn(`Failed to fetch payments for project ${project.id}:`, e)
        }
      }
    }

    const headers = [
      'project.project_code',
      'project.project_name',
      'amount',
      'payment_received_date',
      'payment_type',
      'payment_reference',
      'description'
    ]

    const csvContent = arrayToCSV(payments, headers)
    const today = new Date().toISOString().split('T')[0]
    downloadCSV(csvContent, `encaissements_${today}.csv`)
  } catch (error) {
    console.error('Error exporting payments:', error)
    throw new Error('Erreur lors de l\'export des encaissements')
  }
}

// Export jalons data
export async function exportJalonsCSV(user: any): Promise<void> {
  try {
    let jalons: JalonData[] = []
    const base = "/api/management"

    // Get all projects first
    let projects: ProjectData[] = []
    if (user.role === "director") {
      const { data: raw } = await http.get(`${base}/all/projects/`, { params: { page: 1, size: 10000 } })
      projects = (raw?.results || raw) ?? []
    } else if (user.role === "department_manager" && user.department) {
      const { data: raw } = await http.get(`${base}/departments/${user.department}/projects/`, { params: { page: 1, size: 1000 } })
      projects = (raw?.results || raw) ?? []
    }

    // Get jalons for each project
    for (const project of projects) {
      try {
        const departmentId = project.department?.id || user.department
        const { data: jalonsRaw } = await http.get(`${base}/departments/${departmentId}/projects/${project.id}/steps/`, { params: { page: 1, size: 1000 } })
        const projectJalons = (jalonsRaw?.results || jalonsRaw) ?? []
        
        // Add project info to each jalon
        const jalonsWithProject = projectJalons.map((jalon: any) => ({
          ...jalon,
          project: {
            project_code: project.project_code,
            project_name: project.project_name
          }
        }))
        
        jalons = [...jalons, ...jalonsWithProject]
      } catch (e) {
        console.warn(`Failed to fetch jalons for project ${project.id}:`, e)
      }
    }

    const headers = [
      'project.project_code',
      'project.project_name',
      'name',
      'description',
      'start_date',
      'end_date',
      'execution_status',
      'execution_comments',
      'created_at'
    ]

    const csvContent = arrayToCSV(jalons, headers)
    const today = new Date().toISOString().split('T')[0]
    downloadCSV(csvContent, `jalons_${today}.csv`)
  } catch (error) {
    console.error('Error exporting jalons:', error)
    throw new Error('Erreur lors de l\'export des jalons')
  }
}

// Export using server-side endpoints (more efficient for large datasets)
export async function exportProjectsServerCSV(): Promise<void> {
  try {
    const response = await http.get('/api/management/export/projects/', { 
      responseType: 'blob' 
    })
    
    const blob = new Blob([response.data], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `projets_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error exporting projects from server:', error)
    throw new Error('Erreur lors de l\'export des projets depuis le serveur')
  }
}

export async function exportExpensesServerCSV(): Promise<void> {
  try {
    const response = await http.get('/api/management/export/expenses/', { 
      responseType: 'blob' 
    })
    
    const blob = new Blob([response.data], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `depenses_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error exporting expenses from server:', error)
    throw new Error('Erreur lors de l\'export des dépenses depuis le serveur')
  }
}

export async function exportPaymentsServerCSV(): Promise<void> {
  try {
    const response = await http.get('/api/management/export/payments/', { 
      responseType: 'blob' 
    })
    
    const blob = new Blob([response.data], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `encaissements_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error exporting payments from server:', error)
    throw new Error('Erreur lors de l\'export des encaissements depuis le serveur')
  }
}

export async function exportJalonsServerCSV(): Promise<void> {
  try {
    const response = await http.get('/api/management/export/jalons/', { 
      responseType: 'blob' 
    })
    
    const blob = new Blob([response.data], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `jalons_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error exporting jalons from server:', error)
    throw new Error('Erreur lors de l\'export des jalons depuis le serveur')
  }
}

export async function exportDashboardSummaryCSV(): Promise<void> {
  try {
    const response = await http.get('/api/management/export/dashboard-summary/', { 
      responseType: 'blob' 
    })
    
    const blob = new Blob([response.data], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `resume_dashboard_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error exporting dashboard summary from server:', error)
    throw new Error('Erreur lors de l\'export du résumé dashboard depuis le serveur')
  }
}

// Export complete dashboard data
export async function exportCompleteDataCSV(user: any): Promise<void> {
  try {
    await Promise.all([
      exportProjectsCSV(user),
      exportExpensesCSV(user),
      exportPaymentsCSV(user),
      exportJalonsCSV(user)
    ])
  } catch (error) {
    console.error('Error exporting complete data:', error)
    throw new Error('Erreur lors de l\'export complet des données')
  }
}

// Export complete data using server endpoints (more efficient)
export async function exportCompleteDataServerCSV(): Promise<void> {
  try {
    await Promise.all([
      exportProjectsServerCSV(),
      exportExpensesServerCSV(),
      exportPaymentsServerCSV(),
      exportJalonsServerCSV(),
      exportDashboardSummaryCSV()
    ])
  } catch (error) {
    console.error('Error exporting complete data from server:', error)
    throw new Error('Erreur lors de l\'export complet des données depuis le serveur')
  }
}
