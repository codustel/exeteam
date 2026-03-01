import { PrismaService } from '../prisma/prisma.service';

export type MockPrismaService = {
  [K in keyof PrismaService]: {
    [M in keyof PrismaService[K]]: ReturnType<typeof vi.fn>;
  };
};

export function createMockPrismaService(): MockPrismaService {
  return {
    client: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    employee: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    site: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    timeEntry: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    taskDeliverable: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    statusHistory: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    publicHoliday: {
      findMany: vi.fn(),
    },
    leaveRequest: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    leaveType: {
      findUnique: vi.fn(),
    },
  } as unknown as MockPrismaService;
}
