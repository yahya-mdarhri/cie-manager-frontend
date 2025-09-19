"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Filter, RotateCcw } from "lucide-react"

interface FilterField {
  type: "date" | "select" | "text"
  key: string
  label: string
  placeholder?: string
  options?: { value: string; label: string }[]
}

interface FilterBarProps {
  fields: FilterField[]
  onFilter: () => void
  onReset: () => void
}

export function FilterBar({ fields, onFilter, onReset }: FilterBarProps) {
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          {fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key} className="text-sm font-medium">
                {field.label}
              </Label>
              {field.type === "date" && <Input id={field.key} type="date" placeholder={field.placeholder} />}
              {field.type === "select" && (
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder={field.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {field.type === "text" && <Input id={field.key} placeholder={field.placeholder} />}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={onFilter} className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtrer
          </Button>
          <Button variant="outline" onClick={onReset} className="flex items-center gap-2 bg-transparent">
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
