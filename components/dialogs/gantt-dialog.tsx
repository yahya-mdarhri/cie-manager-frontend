"use client"

import React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useLanguage } from "@/lib/language-context"
import { GanttChart } from "@/components/ui/gantt-chart"
import { Calendar, BarChart3 } from "lucide-react"

interface Jalon {
  id: number
  name: string
  description?: string
  start_date: string
  end_date: string
  is_completed: boolean
  completion_date?: string
  proof_document?: string
  comments?: string
}

interface Project {
  id: number
  project_name: string
  description?: string
}

interface GanttDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  jalons: Jalon[]
}

export function GanttDialog({ open, onOpenChange, project, jalons }: GanttDialogProps) {
  const { t } = useLanguage()
  const completedJalons = jalons.filter(j => j.is_completed).length
  const totalJalons = jalons.length
  const progressPercentage = totalJalons > 0 ? Math.round((completedJalons / totalJalons) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col mx-2 sm:mx-auto">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t('gantt.title', { name: project.project_name })}
          </DialogTitle>
          {project.description && (
            <p className="text-sm text-muted-foreground mt-2">
              {project.description}
            </p>
          )}
        </DialogHeader>

        {/* Project Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted rounded-lg mb-4 flex-shrink-0">
          <div className="flex flex-col items-center text-center">
            <Calendar className="h-4 w-4 text-primary mb-1" />
            <span className="text-xs font-medium text-muted-foreground">{t('gantt.total')}</span>
            <span className="text-lg font-bold">{totalJalons}</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="w-4 h-4 bg-green-500 rounded-full mb-1"></div>
            <span className="text-xs font-medium text-muted-foreground">{t('gantt.completed')}</span>
            <span className="text-lg font-bold text-green-600">{completedJalons}</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="w-4 h-4 bg-primary rounded-full mb-1"></div>
            <span className="text-xs font-medium text-muted-foreground">{t('gantt.inProgress')}</span>
            <span className="text-lg font-bold text-blue-600">{totalJalons - completedJalons}</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="w-8 h-2 bg-muted rounded-full overflow-hidden mb-1">
              <div 
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            <span className="text-xs font-medium text-muted-foreground">{t('gantt.progress')}</span>
            <span className="text-lg font-bold text-green-600">{progressPercentage}%</span>
          </div>
        </div>

        {/* Gantt Chart - Scrollable */}
        <div className="flex-1 overflow-auto">
          <GanttChart jalons={jalons} />
        </div>

        {/* Quick Tips */}
        {jalons.length > 0 && (
          <div className="flex-shrink-0 mt-4 p-3 bg-muted border border-border rounded-lg">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">💡 {t('gantt.tip')}:</span>
              <span className="hidden sm:inline"> {t('gantt.tipHover')}</span>
              <span className="sm:hidden"> {t('gantt.tipTap')}</span>
              {" "} {t('gantt.todayLine')}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default GanttDialog