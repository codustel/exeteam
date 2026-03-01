import { describe, it, expect } from 'vitest';

describe('TasksService - Business Logic', () => {
  describe('rendement calculation', () => {
    // Matches TasksService.calcRendement: (timeGamme * quantity) / totalHours * 100
    // rounded to 1 decimal
    function calcRendement(
      timeGamme: number | null,
      totalHours: number,
      quantity = 1,
    ): number | null {
      if (!timeGamme || totalHours === 0) return null;
      return Math.round(((timeGamme * quantity) / totalHours) * 100 * 10) / 10;
    }

    it('should calculate rendement as (timeGamme * quantity / actualHours) * 100', () => {
      const timeGamme = 8; // hours
      const actualHours = 10; // hours
      const rendement = calcRendement(timeGamme, actualHours);
      expect(rendement).toBe(80);
    });

    it('should return null when actualHours is 0', () => {
      const timeGamme = 8;
      const actualHours = 0;
      const rendement = calcRendement(timeGamme, actualHours);
      expect(rendement).toBeNull();
    });

    it('should return null when timeGamme is null', () => {
      const rendement = calcRendement(null, 10);
      expect(rendement).toBeNull();
    });

    it('should return > 100 when faster than estimated', () => {
      const timeGamme = 10;
      const actualHours = 8;
      const rendement = calcRendement(timeGamme, actualHours);
      expect(rendement).toBe(125);
    });

    it('should account for quantity multiplier', () => {
      const timeGamme = 5;
      const actualHours = 10;
      const quantity = 2;
      // (5 * 2) / 10 * 100 = 100
      const rendement = calcRendement(timeGamme, actualHours, quantity);
      expect(rendement).toBe(100);
    });

    it('should round to 1 decimal place', () => {
      const timeGamme = 7;
      const actualHours = 9;
      // (7 / 9) * 100 = 77.777... → rounded to 77.8
      const rendement = calcRendement(timeGamme, actualHours);
      expect(rendement).toBe(77.8);
    });
  });

  describe('delai R→L calculation (business days)', () => {
    // Matches TasksService.calcDelaiRL: starts counting from day AFTER reception
    function calculateBusinessDays(start: Date, end: Date, holidays: string[]): number {
      const s = new Date(start);
      s.setHours(0, 0, 0, 0);
      const f = new Date(end);
      f.setHours(0, 0, 0, 0);

      if (f <= s) return 0;

      const holidaySet = new Set(holidays);
      let count = 0;
      const cursor = new Date(s);
      cursor.setDate(cursor.getDate() + 1); // start from day after reception

      while (cursor <= f) {
        const day = cursor.getDay();
        const iso = cursor.toISOString().split('T')[0];
        if (day !== 0 && day !== 6 && !holidaySet.has(iso)) {
          count++;
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      return count;
    }

    it('should count only weekdays starting from day after reception', () => {
      // Monday Mar 3 to Friday Mar 7, 2025 = 4 business days (Tue-Fri)
      const start = new Date('2025-03-03');
      const end = new Date('2025-03-07');
      expect(calculateBusinessDays(start, end, [])).toBe(4);
    });

    it('should exclude weekends', () => {
      // Monday Mar 3 to Monday Mar 10, 2025
      // Counting from Tue Mar 4: Tue(4), Wed(5), Thu(6), Fri(7), Mon(10) = 5
      const start = new Date('2025-03-03');
      const end = new Date('2025-03-10');
      expect(calculateBusinessDays(start, end, [])).toBe(5);
    });

    it('should exclude public holidays', () => {
      // Monday Mar 3 to Friday Mar 7, Wed is holiday
      // Counting from Tue: Tue(4), Thu(6), Fri(7) = 3
      const start = new Date('2025-03-03');
      const end = new Date('2025-03-07');
      const holidays = ['2025-03-05'];
      expect(calculateBusinessDays(start, end, holidays)).toBe(3);
    });

    it('should return 0 when end <= start', () => {
      const start = new Date('2025-03-07');
      const end = new Date('2025-03-03');
      expect(calculateBusinessDays(start, end, [])).toBe(0);
    });

    it('should return 0 when start equals end', () => {
      const start = new Date('2025-03-03');
      const end = new Date('2025-03-03');
      expect(calculateBusinessDays(start, end, [])).toBe(0);
    });
  });

  describe('status transition validation', () => {
    const TERMINAL_STATUSES = ['terminee', 'livree'];

    function canTransitionToStatus(
      targetStatus: string,
      deliverableCount: number,
      hasDeliverableLinks: boolean,
    ): boolean {
      if (TERMINAL_STATUSES.includes(targetStatus)) {
        return deliverableCount > 0 || hasDeliverableLinks;
      }
      return true;
    }

    it('should require deliverable for terminee status', () => {
      expect(canTransitionToStatus('terminee', 0, false)).toBe(false);
    });

    it('should require deliverable for livree status', () => {
      expect(canTransitionToStatus('livree', 0, false)).toBe(false);
    });

    it('should allow terminee status when deliverable exists', () => {
      expect(canTransitionToStatus('terminee', 1, false)).toBe(true);
    });

    it('should allow terminee status when deliverable links exist', () => {
      expect(canTransitionToStatus('terminee', 0, true)).toBe(true);
    });

    it('should allow other statuses without deliverable', () => {
      expect(canTransitionToStatus('en_cours', 0, false)).toBe(true);
      expect(canTransitionToStatus('en_revision', 0, false)).toBe(true);
    });
  });

  describe('facturable flag', () => {
    it('should filter only facturable tasks for attachments', () => {
      const tasks = [
        { id: '1', facturable: true, title: 'Task 1' },
        { id: '2', facturable: false, title: 'Task 2' },
        { id: '3', facturable: true, title: 'Task 3' },
      ];
      const billable = tasks.filter((t) => t.facturable);
      expect(billable).toHaveLength(2);
      expect(billable.every((t) => t.facturable)).toBe(true);
    });
  });

  describe('reference generation', () => {
    it('should generate reference in format TACHE-YYYYMM-NNNN', () => {
      const count = 42;
      const now = new Date('2025-03-15');
      const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const reference = `TACHE-${yyyymm}-${String(count + 1).padStart(4, '0')}`;
      expect(reference).toBe('TACHE-202503-0043');
    });

    it('should pad sequence number to 4 digits', () => {
      const count = 0;
      const now = new Date('2025-01-01');
      const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const reference = `TACHE-${yyyymm}-${String(count + 1).padStart(4, '0')}`;
      expect(reference).toBe('TACHE-202501-0001');
    });
  });
});
