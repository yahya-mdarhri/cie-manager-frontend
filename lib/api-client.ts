// API client utilities for making requests
export class ApiClient {
  private static baseUrl = "/api"

  static async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`)
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`)
    }
    return response.json()
  }

  static async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`)
    }
    return response.json()
  }

  static async put<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`)
    }
    return response.json()
  }

  static async delete(endpoint: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`)
    }
  }
}

// Specific API functions
export const projectsApi = {
  getAll: () => ApiClient.get<any[]>("/projects"),
  getById: (id: string) => ApiClient.get<any>(`/projects/${id}`),
  create: (data: any) => ApiClient.post<any>("/projects", data),
  update: (id: string, data: any) => ApiClient.put<any>(`/projects/${id}`, data),
  delete: (id: string) => ApiClient.delete(`/projects/${id}`),
}

export const expensesApi = {
  getAll: () => ApiClient.get<any[]>("/expenses"),
  create: (data: any) => ApiClient.post<any>("/expenses", data),
}

export const revenuesApi = {
  getAll: () => ApiClient.get<any[]>("/revenues"),
  create: (data: any) => ApiClient.post<any>("/revenues", data),
}

export const usersApi = {
  getAll: () => ApiClient.get<any[]>("/users"),
  getById: (id: string) => ApiClient.get<any>(`/users/${id}`),
  create: (data: any) => ApiClient.post<any>("/users", data),
  update: (id: string, data: any) => ApiClient.put<any>(`/users/${id}`, data),
  delete: (id: string) => ApiClient.delete(`/users/${id}`),
}
