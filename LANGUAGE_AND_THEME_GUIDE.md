# 🌍 Language & Theme System - Complete Guide

## Overview

Your platform uses a **professional i18n system** with:
- **📁 JSON-based translations**: Organized in `locales/fr.json` and `locales/en.json`
- **🌍 Multi-language support**: French (default) and English
- **🌓 Theme modes**: Light, Dark, and System (auto)
- **💾 Persistent preferences**: Saved in localStorage
- **🔄 Dynamic variable substitution**: Support for `{{variable}}` in translations

## Quick Start

### Using Translations

```tsx
import { useLanguage } from "@/lib/language-context"

export function MyComponent() {
  const { t } = useLanguage()
  
  return (
    <div>
      {/* Simple translation */}
      <h1>{t("projects.title")}</h1>
      
      {/* With variables */}
      <p>{t("form.project.successDesc", { name: "My Project", count: 3 })}</p>
      
      {/* Nested keys */}
      <Label>{t("form.project.name")}</Label>
    </div>
  )
}
```

### Translation Structure

Access translations using **dot notation**:
- `projects.title` → `locales/fr.json` → `{ "projects": { "title": "..." } }`
- `form.project.name` → `{ "form": { "project": { "name": "..." } } }`

### Variable Substitution

Use `{{variableName}}` in your JSON translations:

**locales/fr.json:**
```json
{
  "form": {
    "project": {
      "successDesc": "Le projet \"{{name}}\" a été créé avec {{count}} jalon(s)."
    }
  }
}
```

**Usage:**
```tsx
t("form.project.successDesc", { name: "Test", count: 5 })
// Output: Le projet "Test" a été créé avec 5 jalon(s).
```

## Translation Files

### File Structure
```
locales/
  ├── fr.json  (French - Default)
  └── en.json  (English)
```

### JSON Organization
```json
{
  "nav": { },          // Navigation menu
  "header": { },       // Header component
  "projects": { },     // Projects page
  "form": {
    "project": { }     // Project forms
  },
  "admin": { },        // Admin page
  "expenses": { },     // Expenses page
  "revenues": { },     // Revenues page
  "common": { },       // Common UI elements
  "messages": { },     // Toast/alert messages
  "status": { },       // Status labels
  "roles": { }         // User roles
}
```

## Complete Translation Reference

### Navigation (`nav.*`)
```json
{
  "dashboard": "Tableau de bord / Dashboard",
  "projects": "Projets / Projects",
  "revenues": "Revenus / Revenues",
  "expenses": "Dépenses / Expenses",
  "admin": "Administration"
}
```

### Projects (`projects.*`)
All project-related translations including columns, buttons, messages.

### Forms (`form.project.*`)
Complete form translations with 50+ keys covering:
- Field labels
- Placeholders
- Validation messages
- Success/error messages
- Button labels

### Common (`common.*`)
Reusable UI elements: buttons, actions, states.

## Adding New Translations

### Step 1: Edit JSON Files

**locales/fr.json:**
```json
{
  "myFeature": {
    "title": "Mon Titre",
    "description": "Description avec {{variable}}"
  }
}
```

**locales/en.json:**
```json
{
  "myFeature": {
    "title": "My Title",
    "description": "Description with {{variable}}"
  }
}
```

### Step 2: Use in Component

```tsx
import { useLanguage } from "@/lib/language-context"

export function MyFeature() {
  const { t } = useLanguage()
  
  return (
    <>
      <h1>{t("myFeature.title")}</h1>
      <p>{t("myFeature.description", { variable: "value" })}</p>
    </>
  )
}
```

## Theme System

### Using Theme

```tsx
import { useTheme } from "next-themes"

export function MyComponent() {
  const { theme, setTheme } = useTheme()
  
  return (
    <Button onClick={() => setTheme("dark")}>
      Switch to Dark
    </Button>
  )
}
```

### Available Themes
- `light` - Light mode
- `dark` - Dark mode
- `system` - Follow OS preference

## Language API

### useLanguage Hook

```tsx
const { language, setLanguage, t } = useLanguage()

// Current language
console.log(language) // "fr" or "en"

// Change language
setLanguage("en")

// Translate
const text = t("common.save")

// Translate with variables
const message = t("form.project.successDesc", { name: "Project", count: 3 })
```

## Migration Examples

### Before (Hardcoded)
```tsx
<DialogTitle>Nouveau Projet</DialogTitle>
<Label htmlFor="code">Code Projet*</Label>
<Button>Enregistrer le projet</Button>
<p>Budget Total (MAD)*</p>
```

### After (Translated)
```tsx
import { useLanguage } from "@/lib/language-context"

function MyForm() {
  const { t } = useLanguage()
  
  return (
    <>
      <DialogTitle>{t("form.project.title")}</DialogTitle>
      <Label htmlFor="code">{t("form.project.code")}</Label>
      <Button>{t("form.project.save")}</Button>
      <p>{t("form.project.totalBudget")}</p>
    </>
  )
}
```

## Best Practices

### ✅ DO
- Use nested keys: `form.project.title`
- Add to BOTH `fr.json` AND `en.json`
- Use variables for dynamic content: `{{name}}`
- Test in both languages
- Keep JSON files properly formatted

### ❌ DON'T
- Hardcode text in French or English
- Nest `t()` calls: `t(t("key"))` ❌
- Forget to add translations to both files
- Use invalid JSON syntax
- Create deeply nested keys (max 3 levels)

## Common Patterns

### Toast Notifications
```tsx
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/lib/language-context"

const { toast } = useToast()
const { t } = useLanguage()

toast({
  title: t("form.project.successTitle"),
  description: t("form.project.successDesc", { 
    name: projectName, 
    count: milestoneCount 
  })
})
```

### Form Labels
```tsx
<Label htmlFor="name">{t("form.project.name")}</Label>
<Input id="name" placeholder={t("form.project.namePlaceholder")} />
```

### Select Options
```tsx
<SelectItem value="fr">
  {t("language.french")}
</SelectItem>
```

## Troubleshooting

### Translation Not Found
**Symptom**: Seeing the key instead of translated text
**Solution**:
1. Check key exists in both JSON files
2. Verify exact key path (case-sensitive)
3. Check JSON syntax is valid
4. Hard refresh browser

### JSON Parse Error
**Symptom**: App crashes or blank page
**Solution**:
1. Validate JSON at jsonlint.com
2. Check for missing commas
3. Ensure proper quotes around keys/values
4. No trailing commas in objects

### Language Not Switching
**Symptom**: UI stays in same language
**Solution**:
1. Check LanguageProvider wraps app
2. Clear localStorage
3. Hard refresh (Cmd+Shift+R)

## File Reference

```
business-management-dashboard (3)/
├── locales/
│   ├── fr.json                    # French translations
│   └── en.json                    # English translations
│
├── lib/
│   └── language-context.tsx       # Language provider & hook
│
├── components/
│   ├── theme-provider.tsx         # Theme provider
│   └── ui/
│       ├── theme-toggle.tsx       # ☀️/🌙 toggle
│       └── language-toggle.tsx    # 🇫🇷/🇬🇧 toggle
│
└── app/
    └── layout.tsx                 # Root with providers
```

## Testing Checklist

- [ ] Language toggle works (🌍 icon in header)
- [ ] Theme toggle works (☀️/🌙 icon in header)
- [ ] Preferences persist after refresh
- [ ] All text changes when switching language
- [ ] No hardcoded French/English text remains
- [ ] Toast notifications are translated
- [ ] Form validation messages are translated
- [ ] Both JSON files have same keys

## Resources

- **Translation Files**: `/locales/fr.json`, `/locales/en.json`
- **Language Hook**: `/lib/language-context.tsx`
- **Theme Docs**: [next-themes](https://github.com/pacocoursey/next-themes)
- **i18n Guide**: [Next.js Internationalization](https://nextjs.org/docs/app/building-your-application/routing/internationalization)

---

**Need help?** Check the translation keys in the JSON files or refer to existing components for examples.
