'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Edit, Briefcase, Calendar, Users, TrendingUp, Clock } from 'lucide-react';
import Link from 'next/link';
import { EmployeeFormDialog } from '../employee-form-dialog';

interface Props { employeeId: string }

const CONTRACT_LABELS: Record<string, string> = {
  cdi: 'CDI', cdd: 'CDD', stage: 'Stage', freelance: 'Freelance', alternance: 'Alternance',
};

export function EmployeeDetail({ employeeId }: Props) {
  const [editOpen, setEditOpen] = useState(false);

  const { data: employee, isLoading } = useQuery<any>({
    queryKey: ['employees', employeeId],
    queryFn: () => apiRequest<any>(`/employees/${employeeId}`),
  });

  const { data: leaves = [] } = useQuery<any>({
    queryKey: ['leaves', 'by-employee', employeeId],
    queryFn: () => apiRequest<any>(`/leaves?employeeId=${employeeId}&limit=10`).then((r: any) => r.data ?? []),
  });

  if (isLoading) return <div className="flex items-center justify-center h-48 text-muted-foreground">Chargement...</div>;
  if (!employee) return <div className="text-muted-foreground">Employé introuvable</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {employee.photoUrl ? (
            <img src={employee.photoUrl} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {employee.firstName[0]}{employee.lastName[0]}
              </span>
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold">{employee.firstName} {employee.lastName}</h2>
            <p className="text-muted-foreground">{employee.position ?? 'Sans poste défini'}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={employee.isActive ? 'default' : 'secondary'}>
                {employee.isActive ? 'Actif' : 'Inactif'}
              </Badge>
              {employee.contractType && <Badge variant="outline">{CONTRACT_LABELS[employee.contractType] ?? employee.contractType}</Badge>}
              {employee.department && <Badge variant="outline">{employee.department.name}</Badge>}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Edit className="h-4 w-4 mr-2" />
          Modifier
        </Button>
      </div>

      <Tabs defaultValue="infos">
        <TabsList>
          <TabsTrigger value="infos"><User className="h-4 w-4 mr-1" />Infos</TabsTrigger>
          <TabsTrigger value="contrat"><Briefcase className="h-4 w-4 mr-1" />Contrat</TabsTrigger>
          <TabsTrigger value="conges"><Calendar className="h-4 w-4 mr-1" />Congés</TabsTrigger>
          <TabsTrigger value="equipe"><Users className="h-4 w-4 mr-1" />Équipe</TabsTrigger>
          <TabsTrigger value="activite"><TrendingUp className="h-4 w-4 mr-1" />Activité</TabsTrigger>
          <TabsTrigger value="salaire"><Clock className="h-4 w-4 mr-1" />Salaire</TabsTrigger>
        </TabsList>

        <TabsContent value="infos" className="mt-4">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Coordonnées</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {employee.personalEmail && <p>Email perso: {employee.personalEmail}</p>}
                {employee.professionalEmail && <p>Email pro: {employee.professionalEmail}</p>}
                {employee.phone && <p>Tél: {employee.phone}</p>}
                {employee.addressLine1 && <p>{employee.addressLine1}</p>}
                {(employee.postalCode || employee.city) && <p>{employee.postalCode} {employee.city}</p>}
                {employee.country && <p>{employee.country}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Informations</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {employee.dateOfBirth && <p>Date de naissance: {new Date(employee.dateOfBirth).toLocaleDateString('fr-FR')}</p>}
                {employee.nationality && <p>Nationalité: {employee.nationality}</p>}
                {employee.user && <p>Compte: <Badge variant="default" className="ml-1">{employee.user.email}</Badge></p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contrat" className="mt-4">
          <Card>
            <CardContent className="space-y-3 text-sm pt-6">
              {employee.contractType && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type de contrat</span>
                  <span className="font-medium">{CONTRACT_LABELS[employee.contractType] ?? employee.contractType}</span>
                </div>
              )}
              {employee.entryDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date d'entrée</span>
                  <span className="font-medium">{new Date(employee.entryDate).toLocaleDateString('fr-FR')}</span>
                </div>
              )}
              {employee.endDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date de fin</span>
                  <span className="font-medium">{new Date(employee.endDate).toLocaleDateString('fr-FR')}</span>
                </div>
              )}
              {employee.weeklyHours && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Heures hebdomadaires</span>
                  <span className="font-medium">{Number(employee.weeklyHours)} h</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conges" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Demandes de congés récentes</h3>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/leaves?employeeId=${employeeId}`}>Voir tout</Link>
              </Button>
            </div>
            {leaves.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Aucune demande de congé</div>
            ) : (
              <div className="space-y-2">
                {leaves.map((leave: any) => (
                  <div key={leave.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{leave.leaveType?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(leave.startDate).toLocaleDateString('fr-FR')} → {new Date(leave.endDate).toLocaleDateString('fr-FR')}
                        {' '}({Number(leave.days)} jour(s))
                      </p>
                    </div>
                    <Badge variant={
                      leave.status === 'approuve' ? 'default' :
                      leave.status === 'refuse' ? 'destructive' :
                      leave.status === 'annule' ? 'secondary' : 'outline'
                    }>
                      {({'approuve':'Approuvé','refuse':'Refusé','annule':'Annulé','en_attente':'En attente'} as Record<string,string>)[leave.status] ?? leave.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="equipe" className="mt-4">
          <div className="grid grid-cols-2 gap-6">
            {employee.manager && (
              <Card>
                <CardHeader><CardTitle className="text-base">Responsable (N+1)</CardTitle></CardHeader>
                <CardContent>
                  <Link href={`/employees/${employee.manager.id}`} className="flex items-center gap-3 hover:text-primary">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-sm">
                      {employee.manager.firstName[0]}{employee.manager.lastName[0]}
                    </div>
                    <div>
                      <p className="font-medium">{employee.manager.firstName} {employee.manager.lastName}</p>
                      {employee.manager.position && <p className="text-xs text-muted-foreground">{employee.manager.position}</p>}
                    </div>
                  </Link>
                </CardContent>
              </Card>
            )}
            {employee.subordinates?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Subordonnés directs</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {employee.subordinates.map((sub: any) => (
                    <Link key={sub.id} href={`/employees/${sub.id}`} className="flex items-center gap-2 hover:text-primary">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {sub.firstName[0]}{sub.lastName[0]}
                      </div>
                      <span className="text-sm">{sub.firstName} {sub.lastName}</span>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activite" className="mt-4">
          <div className="text-muted-foreground text-sm">Historique d'activité disponible après Sprint 3A (Projets & Tâches)</div>
        </TabsContent>

        <TabsContent value="salaire" className="mt-4">
          <div className="text-muted-foreground text-sm">Données salariales (accès restreint — permission hr.read_salaries)</div>
        </TabsContent>
      </Tabs>

      <EmployeeFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        employeeId={employeeId}
        defaultValues={employee}
      />
    </div>
  );
}
