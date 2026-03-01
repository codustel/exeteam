import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_ROLES = [
  { name: 'super_admin', description: 'Administrateur technique — accès total', isSystem: true },
  { name: 'gerant', description: 'Gérant/Directeur — accès métier complet sauf admin', isSystem: true },
  { name: 'responsable_production', description: 'Responsable BE/production', isSystem: true },
  { name: 'employe', description: 'Collaborateur standard', isSystem: true },
  { name: 'comptable', description: 'Accès module comptabilité', isSystem: true },
  { name: 'rh', description: 'Ressources humaines', isSystem: true },
  { name: 'client', description: 'Accès portail client uniquement', isSystem: true },
];

const DEFAULT_PERMISSIONS = [
  // Projects
  { module: 'projects', action: 'create' },
  { module: 'projects', action: 'read' },
  { module: 'projects', action: 'update' },
  { module: 'projects', action: 'delete' },
  { module: 'projects', action: 'assign' },
  // Tasks
  { module: 'tasks', action: 'create' },
  { module: 'tasks', action: 'read' },
  { module: 'tasks', action: 'update' },
  { module: 'tasks', action: 'delete' },
  { module: 'tasks', action: 'assign' },
  { module: 'tasks', action: 'timelog' },
  // Sites
  { module: 'sites', action: 'create' },
  { module: 'sites', action: 'read' },
  { module: 'sites', action: 'update' },
  { module: 'sites', action: 'delete' },
  // Clients
  { module: 'clients', action: 'create' },
  { module: 'clients', action: 'read' },
  { module: 'clients', action: 'update' },
  { module: 'clients', action: 'delete' },
  // Employees
  { module: 'employees', action: 'create' },
  { module: 'employees', action: 'read' },
  { module: 'employees', action: 'update' },
  // HR sensitive
  { module: 'hr', action: 'read_salaries', isMasked: true },
  { module: 'hr', action: 'update_salaries', isMasked: true },
  // Commercial (masked by default)
  { module: 'commercial', action: 'create_quotes', isMasked: true },
  { module: 'commercial', action: 'read_quotes', isMasked: true },
  { module: 'commercial', action: 'create_invoices', isMasked: true },
  { module: 'commercial', action: 'read_invoices', isMasked: true },
  { module: 'commercial', action: 'generate_pdf', isMasked: true },
  // Rentability
  { module: 'reports', action: 'read_salary_rentability', isMasked: true },
  { module: 'reports', action: 'read_financial_dashboard', isMasked: true },
  // Accounting
  { module: 'accounting', action: 'full_access', isMasked: true },
  { module: 'accounting', action: 'read', isMasked: true },
  { module: 'accounting', action: 'write', isMasked: true },
  { module: 'accounting', action: 'approve', isMasked: true },
  // Leaves
  { module: 'leaves', action: 'read' },
  { module: 'leaves', action: 'create' },
  { module: 'leaves', action: 'approve' },
  // Messaging
  { module: 'messaging', action: 'access' },
  // Tags
  { module: 'tags', action: 'create' },
  { module: 'tags', action: 'update' },
  { module: 'tags', action: 'delete' },
  // Import
  { module: 'import', action: 'excel' },
  // Users (super admin only)
  { module: 'users', action: 'create' },
  { module: 'users', action: 'update' },
  { module: 'users', action: 'deactivate' },
  { module: 'users', action: 'associate' },
  // Admin
  { module: 'admin', action: 'roles' },
  { module: 'admin', action: 'settings' },
  // Custom fields
  { module: 'custom_fields', action: 'configure' },
  { module: 'custom_fields', action: 'read' },
  { module: 'custom_fields', action: 'update' },
  // Timesheets
  { module: 'timesheets', action: 'read' },
  { module: 'timesheets', action: 'validate' },
  { module: 'timesheets', action: 'export' },
];

// Role-permission matrix
const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['*'], // all permissions
  gerant: [
    'projects.*', 'tasks.*', 'sites.*', 'clients.*', 'employees.create',
    'employees.read', 'employees.update', 'hr.read_salaries',
    'commercial.*', 'reports.*', 'leaves.*', 'messaging.access',
    'tags.*', 'import.excel', 'custom_fields.*', 'accounting.*',
    'timesheets.*',
  ],
  responsable_production: [
    'projects.*', 'tasks.*', 'sites.*', 'clients.read', 'clients.create',
    'clients.update', 'employees.read', 'leaves.read', 'leaves.approve',
    'messaging.access', 'tags.*', 'import.excel', 'custom_fields.*',
    'timesheets.read', 'timesheets.validate',
  ],
  employe: [
    'tasks.read', 'tasks.update', 'tasks.timelog', 'sites.read',
    'projects.read', 'clients.read', 'leaves.create', 'leaves.read',
    'messaging.access', 'accounting.read', 'accounting.write',
    'timesheets.read',
  ],
  comptable: [
    'accounting.*', 'commercial.*', 'reports.read_financial_dashboard',
    'clients.read', 'employees.read',
    'timesheets.read', 'timesheets.export',
  ],
  rh: [
    'employees.*', 'hr.*', 'leaves.*', 'clients.read',
    'timesheets.read', 'timesheets.export',
  ],
  client: [
    'projects.read', 'tasks.read', 'sites.read',
  ],
};

async function main() {
  console.log('Seeding roles and permissions...');

  // Upsert permissions
  for (const perm of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { module_action: { module: perm.module, action: perm.action } },
      update: perm,
      create: perm,
    });
  }

  // Upsert roles
  for (const role of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: role,
      create: role,
    });
  }

  // Assign permissions to roles
  for (const [roleName, permPatterns] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;

    // Determine which permissions apply
    let permsToAssign: { module: string; action: string }[] = [];

    if (permPatterns.includes('*')) {
      permsToAssign = DEFAULT_PERMISSIONS.map(({ module, action }) => ({ module, action }));
    } else {
      for (const pattern of permPatterns) {
        const [mod, act] = pattern.split('.');
        if (act === '*') {
          permsToAssign.push(...DEFAULT_PERMISSIONS.filter((p) => p.module === mod).map(({ module, action }) => ({ module, action })));
        } else {
          permsToAssign.push({ module: mod, action: act });
        }
      }
    }

    for (const { module, action } of permsToAssign) {
      const perm = await prisma.permission.findUnique({
        where: { module_action: { module, action } },
      });
      if (!perm) continue;

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  // Upsert default currency (EUR)
  await prisma.currency.upsert({
    where: { code: 'EUR' },
    update: {},
    create: { code: 'EUR', symbol: '€', name: 'Euro', isDefault: true },
  });

  // Upsert company settings singleton
  await prisma.companySettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', country: 'FR', quotePrefix: 'DEV', invoicePrefix: 'FAC', projectPrefix: 'PRJ', taskPrefix: 'TSK' },
  });

  // Upsert site typologies
  const typologies = [
    { name: 'Pylône', slug: 'pylone', order: 1 },
    { name: 'Terrasse Technique (TT)', slug: 'terrasse_technique', order: 2 },
    { name: 'Tour', slug: 'tour', order: 3 },
    { name: "Château d'eau", slug: 'chateau_eau', order: 4 },
    { name: 'Shelter', slug: 'shelter', order: 5 },
    { name: 'Local technique', slug: 'local_technique', order: 6 },
    { name: 'Autre', slug: 'autre', order: 7 },
  ];
  for (const typo of typologies) {
    await prisma.siteTypology.upsert({
      where: { slug: typo.slug },
      update: typo,
      create: typo,
    });
  }

  // Upsert work schedule defaults
  await prisma.workSchedule.upsert({
    where: { contractType: 'cdi' },
    update: {},
    create: {
      contractType: 'cdi',
      mondayHours: 8, tuesdayHours: 8, wednesdayHours: 8,
      thursdayHours: 8, fridayHours: 8, saturdayHours: 0, sundayHours: 0,
      weeklyHours: 40,
    },
  });

  // Seed leave types
  const leaveTypes = [
    { name: 'Congés payés', daysPerYear: 25, isCarryOver: true },
    { name: 'RTT', daysPerYear: 10, isCarryOver: false },
    { name: 'Maladie', daysPerYear: null, isCarryOver: false },
    { name: 'Exceptionnel familial', daysPerYear: null, isCarryOver: false },
    { name: 'Formation', daysPerYear: null, isCarryOver: false },
  ];
  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { name: lt.name },
      update: lt,
      create: lt,
    });
  }

  // NOTE: Run POST /public-holidays/sync/2025?country=FR and /2026?country=FR after first deploy
  // to populate public holidays from Nager.Date API.

  console.log('✅ Seed complete');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
