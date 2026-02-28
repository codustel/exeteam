-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "isMasked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "managerId" TEXT,
    "departmentId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "nationality" TEXT,
    "photoUrl" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT,
    "personalEmail" TEXT,
    "professionalEmail" TEXT,
    "phone" TEXT,
    "contractType" TEXT,
    "entryDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "trialEndDate" TIMESTAMP(3),
    "position" TEXT,
    "weeklyHours" DECIMAL(5,2),
    "grossSalary" DECIMAL(10,2),
    "netSalary" DECIMAL(10,2),
    "hourlyRate" DECIMAL(8,2),
    "currencyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salaries" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "grossSalary" DECIMAL(10,2) NOT NULL,
    "netSalary" DECIMAL(10,2),
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitments" (
    "id" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normale',
    "description" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "daysPerYear" DECIMAL(5,2),
    "isCarryOver" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "approverId" TEXT,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" DECIMAL(4,1) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "reason" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'national',
    "country" TEXT NOT NULL DEFAULT 'FR',
    "year" INTEGER NOT NULL,

    CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedules" (
    "id" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "mondayHours" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "tuesdayHours" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "wednesdayHours" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "thursdayHours" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "fridayHours" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "saturdayHours" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "sundayHours" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "weeklyHours" DECIMAL(5,2) NOT NULL DEFAULT 40,

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "logoUrl" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT,
    "vatNumber" TEXT,
    "siret" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "paymentConditions" TEXT,
    "defaultVatRate" DECIMAL(5,2),
    "notes" TEXT,
    "customFieldsConfig" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operators" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "contact" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_operators" (
    "clientId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,

    CONSTRAINT "client_operators_pkey" PRIMARY KEY ("clientId","operatorId")
);

-- CreateTable
CREATE TABLE "interlocuteurs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "clientId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "fonction" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "interlocuteurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_typologies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_typologies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "postalCode" TEXT,
    "commune" TEXT,
    "departement" TEXT,
    "country" TEXT NOT NULL DEFAULT 'FR',
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "typologieId" TEXT,
    "clientId" TEXT NOT NULL,
    "operatorId" TEXT,
    "customFieldsData" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "clientId" TEXT NOT NULL,
    "operatorId" TEXT,
    "responsibleId" TEXT,
    "contactId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'brouillon',
    "priority" TEXT NOT NULL DEFAULT 'normale',
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "budgetHours" DECIMAL(8,2),
    "customFieldsConfig" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "codeProduitId" TEXT NOT NULL,
    "employeeId" TEXT,
    "demandId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'a_traiter',
    "priority" TEXT NOT NULL DEFAULT 'normale',
    "dateReception" TIMESTAMP(3),
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "dateLastStatus" TIMESTAMP(3),
    "estimatedHours" DECIMAL(6,2),
    "budgetHours" DECIMAL(6,2),
    "facturable" BOOLEAN NOT NULL DEFAULT true,
    "deliverableLinks" TEXT[],
    "customFieldsData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_history" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,

    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_deliverables" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hours" DECIMAL(4,2) NOT NULL,
    "comment" TEXT,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codes_produits" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "productType" TEXT,
    "unitType" TEXT,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "timeGamme" DECIMAL(6,2),
    "clientId" TEXT NOT NULL,
    "currencyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "codes_produits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demands" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "codeProduitId" TEXT,
    "siteId" TEXT,
    "demandeurId" TEXT,
    "createdById" TEXT NOT NULL,
    "employeeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dataLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'nouvelle',
    "priority" TEXT NOT NULL DEFAULT 'normale',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "desiredDelivery" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'genere',
    "totalHt" DECIMAL(10,2) NOT NULL,
    "currencyId" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment_lines" (
    "id" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "codeProduitId" TEXT NOT NULL,
    "siteId" TEXT,
    "quantity" DECIMAL(8,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalHt" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "attachment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "quoteDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'brouillon',
    "totalHt" DECIMAL(10,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "vatAmount" DECIMAL(10,2) NOT NULL,
    "totalTtc" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(5,2),
    "currencyId" TEXT,
    "conditions" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_lines" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "codeProduitId" TEXT,
    "designation" TEXT NOT NULL,
    "quantity" DECIMAL(8,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalHt" DECIMAL(10,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "quoteId" TEXT,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "orderId" TEXT,
    "attachmentId" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'brouillon',
    "totalHt" DECIMAL(10,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "vatAmount" DECIMAL(10,2) NOT NULL,
    "totalTtc" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currencyId" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "codeProduitId" TEXT,
    "designation" TEXT NOT NULL,
    "quantity" DECIMAL(8,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalHt" DECIMAL(10,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "vatNumber" TEXT,
    "siret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "totalHt" DECIMAL(10,2) NOT NULL,
    "vatAmount" DECIMAL(10,2) NOT NULL,
    "totalTtc" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fileUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_reports" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "approverId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(8,2) NOT NULL,
    "vatAmount" DECIMAL(8,2),
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "receiptUrl" TEXT,
    "currencyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#FF6600',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_tags" (
    "tagId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,

    CONSTRAINT "entity_tags_pkey" PRIMARY KEY ("tagId","entityType","entityId")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_members" (
    "conversationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("conversationId","employeeId")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT,
    "mapping" JSONB NOT NULL,
    "dedupeRules" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_logs" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "ignored" INTEGER NOT NULL DEFAULT 0,
    "errorDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "legalName" TEXT,
    "tradeName" TEXT,
    "addressLine1" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'FR',
    "siret" TEXT,
    "siren" TEXT,
    "vatNumber" TEXT,
    "rcs" TEXT,
    "capital" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "logoUrl" TEXT,
    "legalMentions" TEXT,
    "defaultCurrencyId" TEXT,
    "quotePrefix" TEXT NOT NULL DEFAULT 'DEV',
    "invoicePrefix" TEXT NOT NULL DEFAULT 'FAC',
    "projectPrefix" TEXT NOT NULL DEFAULT 'PRJ',
    "taskPrefix" TEXT NOT NULL DEFAULT 'TSK',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "changes" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_module_action_key" ON "permissions"("module", "action");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "public_holidays_date_country_key" ON "public_holidays"("date", "country");

-- CreateIndex
CREATE UNIQUE INDEX "work_schedules_contractType_key" ON "work_schedules"("contractType");

-- CreateIndex
CREATE UNIQUE INDEX "interlocuteurs_userId_key" ON "interlocuteurs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "site_typologies_name_key" ON "site_typologies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "site_typologies_slug_key" ON "site_typologies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "sites_clientId_reference_key" ON "sites"("clientId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "projects_reference_key" ON "projects"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_reference_key" ON "tasks"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_demandId_key" ON "tasks"("demandId");

-- CreateIndex
CREATE UNIQUE INDEX "codes_produits_code_key" ON "codes_produits"("code");

-- CreateIndex
CREATE UNIQUE INDEX "demands_reference_key" ON "demands"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_reference_key" ON "attachments"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_reference_key" ON "quotes"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "orders_reference_key" ON "orders"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_reference_key" ON "invoices"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_reference_key" ON "purchase_invoices"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_operators" ADD CONSTRAINT "client_operators_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_operators" ADD CONSTRAINT "client_operators_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interlocuteurs" ADD CONSTRAINT "interlocuteurs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interlocuteurs" ADD CONSTRAINT "interlocuteurs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_typologieId_fkey" FOREIGN KEY ("typologieId") REFERENCES "site_typologies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "interlocuteurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_codeProduitId_fkey" FOREIGN KEY ("codeProduitId") REFERENCES "codes_produits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "demands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_deliverables" ADD CONSTRAINT "task_deliverables_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codes_produits" ADD CONSTRAINT "codes_produits_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codes_produits" ADD CONSTRAINT "codes_produits_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_codeProduitId_fkey" FOREIGN KEY ("codeProduitId") REFERENCES "codes_produits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_demandeurId_fkey" FOREIGN KEY ("demandeurId") REFERENCES "interlocuteurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment_lines" ADD CONSTRAINT "attachment_lines_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment_lines" ADD CONSTRAINT "attachment_lines_codeProduitId_fkey" FOREIGN KEY ("codeProduitId") REFERENCES "codes_produits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_codeProduitId_fkey" FOREIGN KEY ("codeProduitId") REFERENCES "codes_produits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_codeProduitId_fkey" FOREIGN KEY ("codeProduitId") REFERENCES "codes_produits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tag_client" FOREIGN KEY ("entityId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tag_project" FOREIGN KEY ("entityId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tag_task" FOREIGN KEY ("entityId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_logs" ADD CONSTRAINT "import_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "import_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_logs" ADD CONSTRAINT "import_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_defaultCurrencyId_fkey" FOREIGN KEY ("defaultCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
