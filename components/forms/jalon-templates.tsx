"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Lightbulb, Plus, Clock, CheckCircle, AlertTriangle } from "lucide-react"

interface JalonTemplate {
  name: string
  description: string
  durationDays: number
  priority: "Low" | "Medium" | "High" | "Critical"
  category: "Design" | "Development" | "Testing" | "Deployment" | "Management"
}

interface JalonTemplatesProps {
  onSelectTemplates: (templates: JalonTemplate[]) => void
  children?: React.ReactNode
}

const predefinedTemplates: Record<string, JalonTemplate[]> = {
  "Projet Logiciel": [
    {
      name: "Analyse et spécifications",
      description: "Collecte des exigences, analyse fonctionnelle et rédaction des spécifications techniques",
      durationDays: 14,
      priority: "High",
      category: "Management"
    },
    {
      name: "Conception et maquettes",
      description: "Création des maquettes UI/UX, architecture système et conception base de données",
      durationDays: 10,
      priority: "High",
      category: "Design"
    },
    {
      name: "Développement MVP",
      description: "Développement des fonctionnalités core et création du prototype fonctionnel",
      durationDays: 30,
      priority: "Critical",
      category: "Development"
    },
    {
      name: "Tests et validation",
      description: "Tests unitaires, tests d'intégration et validation avec les utilisateurs finaux",
      durationDays: 14,
      priority: "High",
      category: "Testing"
    },
    {
      name: "Déploiement et mise en production",
      description: "Configuration serveurs, déploiement et formation des utilisateurs",
      durationDays: 7,
      priority: "Medium",
      category: "Deployment"
    }
  ],
  "Projet Recherche": [
    {
      name: "Revue de littérature",
      description: "Analyse approfondie de l'état de l'art et identification des lacunes scientifiques",
      durationDays: 21,
      priority: "High",
      category: "Management"
    },
    {
      name: "Méthodologie et protocole",
      description: "Définition de la méthodologie de recherche et validation du protocole expérimental",
      durationDays: 14,
      priority: "Critical",
      category: "Design"
    },
    {
      name: "Collecte de données",
      description: "Mise en œuvre du protocole et collecte systématique des données",
      durationDays: 45,
      priority: "Critical",
      category: "Development"
    },
    {
      name: "Analyse et interprétation",
      description: "Traitement statistique des données et interprétation des résultats",
      durationDays: 28,
      priority: "High",
      category: "Testing"
    },
    {
      name: "Rédaction et publication",
      description: "Rédaction du rapport final et soumission pour publication",
      durationDays: 21,
      priority: "Medium",
      category: "Management"
    }
  ],
  "Projet Marketing": [
    {
      name: "Étude de marché",
      description: "Analyse concurrentielle, segmentation cible et opportunités de marché",
      durationDays: 14,
      priority: "High",
      category: "Management"
    },
    {
      name: "Stratégie et positionnement",
      description: "Définition de la stratégie marketing et positionnement produit/service",
      durationDays: 10,
      priority: "High",
      category: "Design"
    },
    {
      name: "Création de contenu",
      description: "Production des supports marketing, visuels et contenus digitaux",
      durationDays: 21,
      priority: "Medium",
      category: "Development"
    },
    {
      name: "Campagne pilote",
      description: "Lancement test sur un segment restreint et mesure des performances",
      durationDays: 14,
      priority: "Critical",
      category: "Testing"
    },
    {
      name: "Déploiement complet",
      description: "Lancement à grande échelle et optimisation continue des campagnes",
      durationDays: 30,
      priority: "High",
      category: "Deployment"
    }
  ]
}

const categoryColors = {
  Design: "bg-purple-100 text-purple-800",
  Development: "bg-blue-100 text-blue-800",
  Testing: "bg-green-100 text-green-800",
  Deployment: "bg-orange-100 text-orange-800",
  Management: "bg-gray-100 text-gray-800"
}

const priorityIcons = {
  Low: <CheckCircle className="h-3 w-3" />,
  Medium: <Clock className="h-3 w-3" />,
  High: <AlertTriangle className="h-3 w-3" />,
  Critical: <AlertTriangle className="h-3 w-3 text-red-600" />
}

export default function JalonTemplates({ onSelectTemplates, children }: JalonTemplatesProps) {
  const [open, setOpen] = React.useState(false)
  
  const handleSelectTemplate = (templateKey: string) => {
    const templates = predefinedTemplates[templateKey]
    onSelectTemplates(templates)
    setOpen(false)
  }

  const calculateTotalDuration = (templates: JalonTemplate[]) => {
    return templates.reduce((total, template) => total + template.durationDays, 0)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Utiliser un modèle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Modèles de jalons prédéfinis
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Sélectionnez un modèle adapté à votre type de projet pour gagner du temps
          </p>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-6 p-1">
            {Object.entries(predefinedTemplates).map(([templateName, templates]) => (
              <Card key={templateName} className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{templateName}</CardTitle>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-500">
                        {templates.length} jalons • {calculateTotalDuration(templates)} jours
                      </div>
                      <Button
                        onClick={() => handleSelectTemplate(templateName)}
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Utiliser ce modèle
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {templates.map((template, index) => (
                      <div key={index} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                        <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900">{template.name}</h4>
                            <Badge className={categoryColors[template.category]}>
                              {template.category}
                            </Badge>
                            <div className="flex items-center gap-1">
                              {priorityIcons[template.priority]}
                              <span className="text-xs text-gray-500">{template.priority}</span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="h-3 w-3" />
                            <span>Durée estimée: {template.durationDays} jours</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}