export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://192.168.1.171:12000"
export const MGMT_API = `${API_BASE}/api/management`
export const ACCOUNTS_API = `${API_BASE}/api/accounts`

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
