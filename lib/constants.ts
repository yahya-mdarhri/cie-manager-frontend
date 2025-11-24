export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"
export const MGMT_API = `${API_BASE}/api/management`
export const ACCOUNTS_API = `${API_BASE}/api/accounts`

// Friendly display aliases for departments used in filter dropdowns.
// Key = stored backend name, value = UI label.
export const DEPARTMENT_ALIASES: Record<string, string> = {
	'Technology transfer office': 'TTO',
	'Clinique industriel': 'Clinique Industrielle',
	'Incubation & Entrepreneuriat': 'Incubation & Entrepreneuriat',
	'Tech Center': 'Tech Center',
	'CIE Direct': 'CIE Direct', // Will display if/when department is created.
};

export function mapDepartmentLabel(name: string): string {
	if (!name) return '';
	return DEPARTMENT_ALIASES[name] || name;
}


