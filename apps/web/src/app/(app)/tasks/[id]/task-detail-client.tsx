'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, type TaskDetail, type TaskComment, type StatusHistoryItem } from '@/lib/api/tasks';
import { timeEntriesApi } from '@/lib/api/time-entries';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Clock, Link2, MessageSquare, Plus, Trash2, CheckCircle, Activity,
  User, MapPin, Wrench, Calendar, Timer, TrendingUp, Tag, ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { TimeEntryFormDialog } from './time-entry-form-dialog';
import { AddDeliverableDialog } from './add-deliverable-dialog';

const STATUS_LABELS: Record<string, string> = {
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  en_revision: 'En révision',
  terminee: 'Terminée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const STATUS_COLORS: Record<string, string> = {
  a_traiter: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  en_cours: 'bg-blue-100 text-blue-800 border-blue-200',
  en_revision: 'bg-purple-100 text-purple-800 border-purple-200',
  terminee: 'bg-green-100 text-green-800 border-green-200',
  livree: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  annulee: 'bg-red-50 text-red-700 border-red-200',
};

const PRIORITY_COLORS: Record<string, string> = {
  basse: 'bg-slate-100 text-slate-600',
  normale: 'bg-blue-50 text-blue-700',
  haute: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
};

const DELIVERABLE_TYPE_ICONS: Record<string, string> = {
  sharepoint: 'SharePoint',
  onedrive: 'OneDrive',
  dropbox: 'Dropbox',
  gdrive: 'Google Drive',
  url: 'Lien',
};

interface TimelineEvent {
  id: string;
  type: 'comment' | 'status';
  date: string;
  actor: string;
  content: string;
  extra?: string;
}

function buildTimeline(task: TaskDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const c of task.comments) {
    events.push({
      id: `comment-${c.id}`,
      type: 'comment',
      date: c.createdAt,
      actor: c.author.email,
      content: c.content,
    });
  }

  for (const s of task.statusHistory) {
    events.push({
      id: `status-${s.id}`,
      type: 'status',
      date: s.changedAt,
      actor: s.user.email,
      content: `Statut changé de "${STATUS_LABELS[s.previousStatus] ?? s.previousStatus}" à "${STATUS_LABELS[s.newStatus] ?? s.newStatus}"`,
      extra: s.comment ?? undefined,
    });
  }

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

interface Props {
  id: string;
}

export function TaskDetailClient({ id }: Props) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [timeEntryOpen, setTimeEntryOpen] = useState(false);
  const [deliverableOpen, setDeliverableOpen] = useState(false);

  const { data: task, isLoading } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => tasksApi.getOne(id),
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => tasksApi.update(id, { status: newStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => tasksApi.addComment(id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
      setComment('');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => tasksApi.deleteComment(id, commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  });

  const removeDeliverableMutation = useMutation({
    mutationFn: (deliverableId: string) => tasksApi.removeDeliverable(id, deliverableId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  });

  const deleteTimeEntryMutation = useMutation({
    mutationFn: (entryId: string) => timeEntriesApi.delete(entryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Chargement...
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Tâche introuvable
      </div>
    );
  }

  const timeline = buildTimeline(task);
  const totalHours = task.timeEntries.reduce((s, e) => s + Number(e.hours), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="space-y-1">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Retour aux tâches
        </Link>
      </div>

      {/* Header bar */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground">{task.reference}</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[task.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {STATUS_LABELS[task.status] ?? task.status}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[task.priority] ?? ''}`}>
              {task.priority}
            </span>
            {task.facturable && (
              <Badge className="bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/20">
                Facturable
              </Badge>
            )}
          </div>
          <h2 className="text-xl font-semibold">{task.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={task.status}
            onValueChange={(v) => statusMutation.mutate(v)}
            disabled={statusMutation.isPending}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a_traiter">À traiter</SelectItem>
              <SelectItem value="en_cours">En cours</SelectItem>
              <SelectItem value="en_revision">En révision</SelectItem>
              <SelectItem value="terminee">Terminée</SelectItem>
              <SelectItem value="livree">Livrée</SelectItem>
              <SelectItem value="annulee">Annulée</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {statusMutation.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
          {(statusMutation.error as Error).message}
        </p>
      )}

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {task.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{task.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Custom fields data */}
          {task.customFieldsData && Object.keys(task.customFieldsData).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Champs personnalisés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(task.customFieldsData).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-1 border-b last:border-0">
                      <span className="text-sm font-medium text-muted-foreground">{key}</span>
                      <span className="text-sm">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deliverables */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Livrables ({task.deliverables.length})
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setDeliverableOpen(true)}>
                <Plus className="h-3 w-3 mr-1" />
                Ajouter
              </Button>
            </CardHeader>
            <CardContent>
              {task.deliverables.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun livrable. Ajoutez un lien pour pouvoir passer la tâche en "Terminée".
                </p>
              ) : (
                <div className="space-y-2">
                  {task.deliverables.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {d.label ?? d.url}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {d.type ? DELIVERABLE_TYPE_ICONS[d.type] ?? d.type : 'Lien'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeDeliverableMutation.mutate(d.id)}
                          disabled={removeDeliverableMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline: Status history + Comments interleaved */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Historique & Commentaires
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun événement</p>
              ) : (
                <div className="space-y-4">
                  {timeline.map((event, i) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${
                          event.type === 'comment'
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-[#FF6600]/10 text-[#FF6600]'
                        }`}>
                          {event.type === 'comment'
                            ? <MessageSquare className="h-4 w-4" />
                            : <Activity className="h-4 w-4" />}
                        </div>
                        {i < timeline.length - 1 && (
                          <div className="flex-1 w-px bg-border my-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">{event.actor}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.date).toLocaleString('fr-FR')}
                          </span>
                        </div>
                        <p className="text-sm mt-1">{event.content}</p>
                        {event.extra && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic">{event.extra}</p>
                        )}
                        {event.type === 'comment' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive h-6 px-2 mt-1 text-xs"
                            onClick={() => {
                              const commentId = event.id.replace('comment-', '');
                              deleteCommentMutation.mutate(commentId);
                            }}
                            disabled={deleteCommentMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Supprimer
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add comment form */}
              <Separator />
              <div className="space-y-2">
                <Textarea
                  placeholder="Ajouter un commentaire..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={!comment.trim() || commentMutation.isPending}
                    onClick={() => commentMutation.mutate(comment.trim())}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Commenter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time entries panel */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Saisies de temps ({task.timeEntries.length} entrées — {totalHours.toFixed(1)}h total)
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setTimeEntryOpen(true)}>
                <Plus className="h-3 w-3 mr-1" />
                Saisir du temps
              </Button>
            </CardHeader>
            <CardContent>
              {task.timeEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune saisie de temps enregistrée
                </p>
              ) : (
                <div className="divide-y">
                  {task.timeEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {entry.employee.firstName} {entry.employee.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.date).toLocaleDateString('fr-FR')}
                          </span>
                          {entry.isValidated && (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          )}
                        </div>
                        {entry.comment && (
                          <p className="text-xs text-muted-foreground mt-0.5">{entry.comment}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-[#FF6600]">
                          {Number(entry.hours).toFixed(1)}h
                        </span>
                        {!entry.isValidated && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deleteTimeEntryMutation.mutate(entry.id)}
                            disabled={deleteTimeEntryMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar (1/3) */}
        <div className="space-y-4">
          {/* Assignee & relations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Détails
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {task.employee && (
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Assigné à</p>
                    <p className="font-medium">
                      {task.employee.firstName} {task.employee.lastName}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2">
                <Activity className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Projet</p>
                  <Link
                    href={`/projects/${task.project.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {task.project.reference}
                  </Link>
                  <p className="text-xs text-muted-foreground">{task.project.title}</p>
                </div>
              </div>

              {task.site && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Site</p>
                    <p className="font-medium">{task.site.name}</p>
                  </div>
                </div>
              )}

              {task.codeProduit && (
                <div className="flex items-start gap-2">
                  <Wrench className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Code produit</p>
                    <p className="font-medium font-mono">{task.codeProduit.code}</p>
                    <p className="text-xs text-muted-foreground">{task.codeProduit.designation}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                { label: 'Réception', value: task.dateReception },
                { label: 'Début prévu', value: task.plannedStartDate },
                { label: 'Fin prévue', value: task.plannedEndDate },
                { label: 'Début réel', value: task.actualStartDate },
                { label: 'Fin réelle', value: task.actualEndDate },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">
                    {value ? new Date(value).toLocaleDateString('fr-FR') : '—'}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Hours & KPIs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Heures & KPIs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimées</span>
                <span className="font-medium">
                  {task.estimatedHours ? `${Number(task.estimatedHours).toFixed(1)}h` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Réelles</span>
                <span className="font-medium text-[#FF6600]">{totalHours.toFixed(1)}h</span>
              </div>
              {task.estimatedHours && totalHours > 0 && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Consommation</span>
                    <span>{Math.round((totalHours / Number(task.estimatedHours)) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        totalHours > Number(task.estimatedHours) ? 'bg-red-500' : 'bg-[#FF6600]'
                      }`}
                      style={{
                        width: `${Math.min(100, (totalHours / Number(task.estimatedHours)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex justify-between">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Délai R→L</span>
                </div>
                <span className={`font-medium ${task.delaiRL !== null && task.delaiRL > 10 ? 'text-red-600' : ''}`}>
                  {task.delaiRL !== null ? `${task.delaiRL} j` : '—'}
                </span>
              </div>

              <div className="flex justify-between">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Rendement</span>
                </div>
                <span className={`font-medium ${
                  task.rendement !== null
                    ? task.rendement >= 90
                      ? 'text-green-600'
                      : task.rendement >= 70
                      ? 'text-yellow-600'
                      : 'text-red-600'
                    : ''
                }`}>
                  {task.rendement !== null ? `${task.rendement}%` : '—'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          {task.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map(({ tag }) => (
                    <Badge
                      key={tag.id}
                      style={{
                        backgroundColor: tag.color + '20',
                        color: tag.color,
                        borderColor: tag.color + '40',
                      }}
                      variant="outline"
                      className="text-xs"
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <TimeEntryFormDialog
        open={timeEntryOpen}
        onOpenChange={setTimeEntryOpen}
        taskId={id}
      />
      <AddDeliverableDialog
        open={deliverableOpen}
        onOpenChange={setDeliverableOpen}
        taskId={id}
      />
    </div>
  );
}
