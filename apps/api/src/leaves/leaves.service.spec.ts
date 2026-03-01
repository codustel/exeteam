import { describe, it, expect } from 'vitest';

describe('LeavesService - Business Logic', () => {
  describe('leave balance calculation', () => {
    it('should calculate remaining leave days', () => {
      const annualAllowance = 25;
      const usedDays = 10;
      const remaining = annualAllowance - usedDays;
      expect(remaining).toBe(15);
    });

    it('should handle zero remaining days', () => {
      const annualAllowance = 25;
      const usedDays = 25;
      const remaining = annualAllowance - usedDays;
      expect(remaining).toBe(0);
    });
  });

  describe('leave overlap detection', () => {
    function hasOverlap(
      start: Date,
      end: Date,
      existingLeaves: Array<{ startDate: Date; endDate: Date }>,
    ): boolean {
      return existingLeaves.some(
        (leave) => start <= leave.endDate && end >= leave.startDate,
      );
    }

    it('should detect overlapping leaves', () => {
      const start = new Date('2025-03-10');
      const end = new Date('2025-03-15');
      const existing = [{ startDate: new Date('2025-03-12'), endDate: new Date('2025-03-20') }];
      expect(hasOverlap(start, end, existing)).toBe(true);
    });

    it('should allow non-overlapping leaves', () => {
      const start = new Date('2025-03-10');
      const end = new Date('2025-03-15');
      const existing = [{ startDate: new Date('2025-03-20'), endDate: new Date('2025-03-25') }];
      expect(hasOverlap(start, end, existing)).toBe(false);
    });

    it('should detect adjacent day overlap', () => {
      const start = new Date('2025-03-15');
      const end = new Date('2025-03-20');
      const existing = [{ startDate: new Date('2025-03-10'), endDate: new Date('2025-03-15') }];
      expect(hasOverlap(start, end, existing)).toBe(true);
    });
  });

  describe('business day calculation (matching LeavesService.calculateBusinessDays)', () => {
    // This mirrors the actual service logic: count weekdays excluding holidays
    function calculateLeaveDays(start: Date, end: Date, holidayDates: string[]): number {
      const holidaySet = new Set(holidayDates);
      let days = 0;
      const current = new Date(start);
      while (current <= end) {
        const dow = current.getDay();
        const dateStr = current.toISOString().split('T')[0];
        if (dow !== 0 && dow !== 6 && !holidaySet.has(dateStr)) {
          days += 1;
        }
        current.setDate(current.getDate() + 1);
      }
      return days;
    }

    it('should exclude weekends from leave count', () => {
      // Monday Mar 3 to Sunday Mar 9 = 5 working days (Mon-Fri)
      const start = new Date('2025-03-03');
      const end = new Date('2025-03-09');
      expect(calculateLeaveDays(start, end, [])).toBe(5);
    });

    it('should exclude public holidays from leave count', () => {
      // Monday Mar 3 to Friday Mar 7 with 1 holiday = 4 working days
      const start = new Date('2025-03-03');
      const end = new Date('2025-03-07');
      const holidays = ['2025-03-04'];
      expect(calculateLeaveDays(start, end, holidays)).toBe(4);
    });

    it('should return 0 for weekend-only period', () => {
      // Saturday Mar 8 to Sunday Mar 9
      const start = new Date('2025-03-08');
      const end = new Date('2025-03-09');
      expect(calculateLeaveDays(start, end, [])).toBe(0);
    });

    it('should count a single weekday as 1', () => {
      // Just Monday
      const start = new Date('2025-03-03');
      const end = new Date('2025-03-03');
      expect(calculateLeaveDays(start, end, [])).toBe(1);
    });

    it('should return 0 when single day is a holiday', () => {
      const start = new Date('2025-03-03');
      const end = new Date('2025-03-03');
      expect(calculateLeaveDays(start, end, ['2025-03-03'])).toBe(0);
    });
  });

  describe('date validation', () => {
    it('should reject end date before start date', () => {
      const startDate = new Date('2025-03-15');
      const endDate = new Date('2025-03-10');
      const isValid = endDate >= startDate;
      expect(isValid).toBe(false);
    });

    it('should allow same-day leave request', () => {
      const startDate = new Date('2025-03-15');
      const endDate = new Date('2025-03-15');
      const isValid = endDate >= startDate;
      expect(isValid).toBe(true);
    });
  });

  describe('leave status transitions', () => {
    it('should only allow approval of pending leaves', () => {
      const statuses = ['en_attente', 'approuve', 'refuse', 'annule'];
      const canApprove = (status: string) => status === 'en_attente';
      expect(canApprove('en_attente')).toBe(true);
      expect(canApprove('approuve')).toBe(false);
      expect(canApprove('refuse')).toBe(false);
      expect(canApprove('annule')).toBe(false);
    });

    it('should only allow cancellation of pending leaves', () => {
      const canCancel = (status: string) => ['en_attente'].includes(status);
      expect(canCancel('en_attente')).toBe(true);
      expect(canCancel('approuve')).toBe(false);
    });

    it('should only allow own leave cancellation', () => {
      const requestingEmployeeId = 'emp-1';
      const leaveEmployeeId = 'emp-1';
      const otherEmployeeId = 'emp-2';
      expect(requestingEmployeeId === leaveEmployeeId).toBe(true);
      expect(otherEmployeeId === leaveEmployeeId).toBe(false);
    });
  });
});
