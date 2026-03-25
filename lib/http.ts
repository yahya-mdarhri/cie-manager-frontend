import axios from "axios"

export const http = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE || "http://192.168.1.171:12000",
  withCredentials: true,
  // Avoid custom headers that can trigger stricter CORS preflight unless needed
})

export const getResults = <T = any>(data: any): T[] => {
  const payload = data ?? []
  if (Array.isArray(payload)) return payload as T[]
  if (Array.isArray(payload?.results)) return payload.results as T[]
  return []
}


