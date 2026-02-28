'use client';

import { useEffect, useRef } from 'react';
import Gantt from 'frappe-gantt';
import '@/styles/frappe-gantt.css';

interface GanttTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies: string;
}

interface Props {
  tasks: GanttTask[];
}

export default function GanttWrapper({ tasks }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<InstanceType<typeof Gantt> | null>(null);

  useEffect(() => {
    if (!containerRef.current || tasks.length === 0) return;

    // Clear previous render
    containerRef.current.innerHTML = '';

    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    containerRef.current.appendChild(svgEl);

    ganttRef.current = new Gantt(svgEl, tasks, {
      view_mode: 'Week',
      date_format: 'YYYY-MM-DD',
      language: 'fr',
    });

    return () => {
      ganttRef.current = null;
    };
  }, [tasks]);

  return (
    <div ref={containerRef} className="p-4 overflow-x-auto min-h-64" />
  );
}
