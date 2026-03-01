-- ExeTeam RLS Policies for multi-tenant isolation

-- Helper function to get current org_id
CREATE OR REPLACE FUNCTION current_org_id() RETURNS uuid AS $$
  SELECT current_setting('app.current_org_id', true)::uuid;
$$ LANGUAGE SQL STABLE;

-- Helper function to get current role
CREATE OR REPLACE FUNCTION current_app_role() RETURNS text AS $$
  SELECT current_setting('app.current_role', true);
$$ LANGUAGE SQL STABLE;

-- Enable RLS on all main tables
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Site" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Demand" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Quote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Salary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;

-- super_admin bypass policy (full access to all tables)
CREATE POLICY "super_admin_all" ON "Client" USING (current_app_role() = 'super_admin');
CREATE POLICY "super_admin_all" ON "Project" USING (current_app_role() = 'super_admin');
CREATE POLICY "super_admin_all" ON "Task" USING (current_app_role() = 'super_admin');
CREATE POLICY "super_admin_all" ON "Employee" USING (current_app_role() = 'super_admin');
CREATE POLICY "super_admin_all" ON "Site" USING (current_app_role() = 'super_admin');
CREATE POLICY "super_admin_all" ON "TimeEntry" USING (current_app_role() = 'super_admin');
CREATE POLICY "super_admin_all" ON "LeaveRequest" USING (current_app_role() = 'super_admin');
CREATE POLICY "super_admin_all" ON "Demand" USING (current_app_role() = 'super_admin');
CREATE POLICY "super_admin_all" ON "Invoice" USING (current_app_role() = 'super_admin');
CREATE POLICY "super_admin_all" ON "Quote" USING (current_app_role() = 'super_admin');
CREATE POLICY "super_admin_all" ON "Attachment" USING (current_app_role() = 'super_admin');
CREATE POLICY "super_admin_all" ON "Supplier" USING (current_app_role() = 'super_admin');
CREATE POLICY "super_admin_all" ON "PurchaseInvoice" USING (current_app_role() = 'super_admin');
CREATE POLICY "super_admin_all" ON "ExpenseReport" USING (current_app_role() = 'super_admin');
CREATE POLICY "super_admin_all" ON "Salary" USING (current_app_role() = 'super_admin');
CREATE POLICY "super_admin_all" ON "Conversation" USING (current_app_role() = 'super_admin');
CREATE POLICY "super_admin_all" ON "Message" USING (current_app_role() = 'super_admin');
CREATE POLICY "super_admin_all" ON "Notification" USING (current_app_role() = 'super_admin');

-- Salary table: restricted access (rh, comptable, gerant, super_admin only)
CREATE POLICY "salary_restricted" ON "Salary"
  USING (current_app_role() IN ('rh', 'comptable', 'gerant', 'super_admin'));

-- ExpenseReport: owner + comptable + gerant + super_admin
CREATE POLICY "expense_report_access" ON "ExpenseReport"
  USING (current_app_role() IN ('comptable', 'gerant', 'super_admin'));

-- General read access for gerant within org
CREATE POLICY "gerant_read_all" ON "Client" FOR SELECT USING (current_app_role() = 'gerant');
CREATE POLICY "gerant_read_all" ON "Project" FOR SELECT USING (current_app_role() = 'gerant');
CREATE POLICY "gerant_read_all" ON "Task" FOR SELECT USING (current_app_role() = 'gerant');
CREATE POLICY "gerant_read_all" ON "Employee" FOR SELECT USING (current_app_role() = 'gerant');
CREATE POLICY "gerant_read_all" ON "Site" FOR SELECT USING (current_app_role() = 'gerant');

-- Gerant write access
CREATE POLICY "gerant_write_all" ON "Client" FOR ALL USING (current_app_role() = 'gerant');
CREATE POLICY "gerant_write_all" ON "Project" FOR ALL USING (current_app_role() = 'gerant');
CREATE POLICY "gerant_write_all" ON "Task" FOR ALL USING (current_app_role() = 'gerant');

-- Chef projet: read all, write own projects/tasks
CREATE POLICY "chef_projet_read" ON "Client" FOR SELECT USING (current_app_role() = 'chef_projet');
CREATE POLICY "chef_projet_read" ON "Project" FOR SELECT USING (current_app_role() = 'chef_projet');
CREATE POLICY "chef_projet_read" ON "Task" FOR SELECT USING (current_app_role() = 'chef_projet');
CREATE POLICY "chef_projet_read" ON "Site" FOR SELECT USING (current_app_role() = 'chef_projet');
CREATE POLICY "chef_projet_read" ON "Employee" FOR SELECT USING (current_app_role() = 'chef_projet');

-- Technicien: read assigned tasks, write own time entries
CREATE POLICY "technicien_read_tasks" ON "Task" FOR SELECT USING (current_app_role() = 'technicien');
CREATE POLICY "technicien_time_entries" ON "TimeEntry" FOR ALL USING (current_app_role() = 'technicien');

-- Comptable: full access to accounting tables
CREATE POLICY "comptable_accounting" ON "Invoice" FOR ALL USING (current_app_role() = 'comptable');
CREATE POLICY "comptable_accounting" ON "Quote" FOR ALL USING (current_app_role() = 'comptable');
CREATE POLICY "comptable_accounting" ON "Supplier" FOR ALL USING (current_app_role() = 'comptable');
CREATE POLICY "comptable_accounting" ON "PurchaseInvoice" FOR ALL USING (current_app_role() = 'comptable');
CREATE POLICY "comptable_read" ON "Client" FOR SELECT USING (current_app_role() = 'comptable');
CREATE POLICY "comptable_read" ON "Project" FOR SELECT USING (current_app_role() = 'comptable');

-- RH: full access to employees/leaves
CREATE POLICY "rh_employees" ON "Employee" FOR ALL USING (current_app_role() = 'rh');
CREATE POLICY "rh_leaves" ON "LeaveRequest" FOR ALL USING (current_app_role() = 'rh');
CREATE POLICY "rh_read" ON "Client" FOR SELECT USING (current_app_role() = 'rh');
CREATE POLICY "rh_read" ON "Project" FOR SELECT USING (current_app_role() = 'rh');

-- Commercial: full access to commercial tables
CREATE POLICY "commercial_access" ON "Invoice" FOR ALL USING (current_app_role() = 'commercial');
CREATE POLICY "commercial_access" ON "Quote" FOR ALL USING (current_app_role() = 'commercial');
CREATE POLICY "commercial_access" ON "Attachment" FOR ALL USING (current_app_role() = 'commercial');
CREATE POLICY "commercial_read" ON "Client" FOR SELECT USING (current_app_role() = 'commercial');
CREATE POLICY "commercial_read" ON "Project" FOR SELECT USING (current_app_role() = 'commercial');
CREATE POLICY "commercial_read" ON "Task" FOR SELECT USING (current_app_role() = 'commercial');

-- Assistante: read all within org
CREATE POLICY "assistante_read" ON "Client" FOR SELECT USING (current_app_role() = 'assistante');
CREATE POLICY "assistante_read" ON "Project" FOR SELECT USING (current_app_role() = 'assistante');
CREATE POLICY "assistante_read" ON "Task" FOR SELECT USING (current_app_role() = 'assistante');
CREATE POLICY "assistante_read" ON "Employee" FOR SELECT USING (current_app_role() = 'assistante');
CREATE POLICY "assistante_read" ON "Site" FOR SELECT USING (current_app_role() = 'assistante');
