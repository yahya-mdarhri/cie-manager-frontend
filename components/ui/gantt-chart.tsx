"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Circle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

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

interface GanttChartProps {
  jalons: Jalon[]
  className?: string
}

export function GanttChart({ jalons, className }: GanttChartProps) {
  if (!jalons || jalons.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Aucun jalon à afficher</p>
      </div>
    )
  }

  // Calculate date range for the timeline
  const allDates = jalons.flatMap(jalon => [
    new Date(jalon.start_date),
    new Date(jalon.end_date)
  ])
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))
  
  // Add padding to the timeline
  const timelinePadding = 7 // days
  const timelineStart = new Date(minDate.getTime() - (timelinePadding * 24 * 60 * 60 * 1000))
  const timelineEnd = new Date(maxDate.getTime() + (timelinePadding * 24 * 60 * 60 * 1000))
  const totalDays = Math.ceil((timelineEnd.getTime() - timelineStart.getTime()) / (24 * 60 * 60 * 1000))

  // Helper function to calculate position and width
  const getBarStyle = (jalon: Jalon) => {
    const startDate = new Date(jalon.start_date)
    const endDate = new Date(jalon.end_date)
    
    const startOffset = Math.ceil((startDate.getTime() - timelineStart.getTime()) / (24 * 60 * 60 * 1000))
    const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1
    
    const leftPercent = (startOffset / totalDays) * 100
    const widthPercent = (duration / totalDays) * 100
    
    return {
      left: `${leftPercent}%`,
      width: `${Math.max(widthPercent, 2)}%` // Minimum 2% width for visibility
    }
  }

  // Helper function to format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short'
    })
  }

  // Generate month markers
  const generateMonthMarkers = () => {
    const markers = []
    const currentDate = new Date(timelineStart)
    currentDate.setDate(1) // Start of month
    
    while (currentDate <= timelineEnd) {
      const position = ((currentDate.getTime() - timelineStart.getTime()) / (timelineEnd.getTime() - timelineStart.getTime())) * 100
      markers.push({
        position: `${position}%`,
        label: currentDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
      })
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1)
    }
    
    return markers
  }

  const monthMarkers = generateMonthMarkers()

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Clock className="h-5 w-5" />
          Diagramme de Gantt - Jalons du Projet
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="space-y-6">
          {/* Timeline header with month markers */}
          <div className="relative h-8 sm:h-10 border-b border-gray-200 mb-2">
            {monthMarkers.map((marker, index) => (
              <div
                key={index}
                className="absolute top-0 text-xs sm:text-sm text-muted-foreground transform -translate-x-1/2"
                style={{ left: marker.position }}
              >
                <div className="border-l border-gray-300 h-4 sm:h-6 mb-1"></div>
                <span className="whitespace-nowrap hidden sm:inline">{marker.label}</span>
                <span className="whitespace-nowrap sm:hidden">
                  {marker.label.split(' ')[0]} {/* Show only month on mobile */}
                </span>
              </div>
            ))}
          </div>

          {/* Gantt bars */}
          <div className="space-y-4">
            {jalons
              .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
              .map((jalon, index) => {
                const barStyle = getBarStyle(jalon)
                
                return (
                  <div key={jalon.id} className="relative">
                    {/* Jalon info */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {jalon.is_completed ? (
                          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        )}
                        <span className="font-medium truncate text-sm sm:text-base">{jalon.name}</span>
                        <Badge variant={jalon.is_completed ? "default" : "secondary"} className="text-xs">
                          {jalon.is_completed ? "Terminé" : "En cours"}
                        </Badge>
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground flex-shrink-0">
                        {formatDate(jalon.start_date)} - {formatDate(jalon.end_date)}
                      </div>
                    </div>

                    {/* Gantt bar */}
                    <div className="relative h-6 sm:h-8 bg-gray-100 rounded-md overflow-hidden">
                      <div
                        className={cn(
                          "absolute top-0 h-full rounded-md transition-all duration-300 cursor-pointer",
                          jalon.is_completed 
                            ? "bg-gradient-to-r from-green-500 to-green-600 shadow-sm hover:shadow-md" 
                            : "bg-gradient-to-r from-blue-500 to-blue-600 shadow-sm hover:shadow-md",
                          "group"
                        )}
                        style={barStyle}
                        title={`${jalon.name}: ${formatDate(jalon.start_date)} - ${formatDate(jalon.end_date)}`}
                      >
                        <div className="flex items-center justify-center h-full px-1 sm:px-2">
                          <span className="text-white text-xs font-medium truncate hidden sm:inline">
                            {jalon.name}
                          </span>
                          <span className="text-white text-xs font-medium sm:hidden">
                            {jalon.name.substring(0, 10)}{jalon.name.length > 10 ? '...' : ''}
                          </span>
                        </div>
                      </div>
                      
                      {/* Today marker */}
                      {(() => {
                        const today = new Date()
                        if (today >= timelineStart && today <= timelineEnd) {
                          const todayPosition = ((today.getTime() - timelineStart.getTime()) / (timelineEnd.getTime() - timelineStart.getTime())) * 100
                          return (
                            <div
                              className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
                              style={{ left: `${todayPosition}%` }}
                            >
                              <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full"></div>
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>

                    {/* Description tooltip on hover - only on larger screens */}
                    {jalon.description && (
                      <div className="hidden sm:block opacity-0 hover:opacity-100 absolute left-0 top-full mt-1 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-20 max-w-sm transition-opacity pointer-events-none">
                        <div className="font-medium mb-1">{jalon.name}</div>
                        <div>{jalon.description}</div>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded"></div>
              <span>En cours</span>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-r from-green-500 to-green-600 rounded"></div>
              <span>Terminé</span>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <div className="w-0.5 h-3 sm:h-4 bg-red-500"></div>
              <span>Aujourd'hui</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}