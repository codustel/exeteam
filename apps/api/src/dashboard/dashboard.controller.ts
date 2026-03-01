import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { DashboardService } from './dashboard.service';
import { ProductionQueryDto } from './dto/production-query.dto';
import { FinancierQueryDto } from './dto/financier-query.dto';
import { ExportQueryDto } from './dto/export-query.dto';
import type { AuthUser } from '../auth/supabase.strategy';

interface RequestWithUser {
  user: AuthUser;
}

const RESTRICTED_ROLES = new Set(['gerant', 'comptable', 'super_admin']);

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('general')
  @RequirePermissions('dashboard.read')
  getGeneral() {
    return this.dashboardService.getGeneral();
  }

  @Get('production')
  @RequirePermissions('dashboard.read')
  getProduction(@Query() dto: ProductionQueryDto) {
    return this.dashboardService.getProduction(dto);
  }

  @Get('financier')
  @RequirePermissions('dashboard.read')
  async getFinancier(@Query() dto: FinancierQueryDto, @Req() req: RequestWithUser) {
    if (!RESTRICTED_ROLES.has(req.user.roleName)) {
      throw new ForbiddenException('Accès réservé au gérant et au comptable.');
    }
    return this.dashboardService.getFinancier(dto);
  }

  @Get('client/:clientId')
  @RequirePermissions('dashboard.read')
  getClient(@Param('clientId') clientId: string) {
    return this.dashboardService.getClient(clientId);
  }

  @Get('employe/:employeeId')
  @RequirePermissions('dashboard.read')
  getEmployee(@Param('employeeId') employeeId: string) {
    return this.dashboardService.getEmployee(employeeId);
  }

  @Get('rentabilite-salariale')
  @RequirePermissions('dashboard.read')
  async getRentabilite(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Req() req?: RequestWithUser,
  ) {
    if (req && !RESTRICTED_ROLES.has(req.user.roleName)) {
      throw new ForbiddenException('Accès réservé au gérant et au comptable.');
    }
    return this.dashboardService.getRentabilite(
      year ? parseInt(year, 10) : undefined,
      month ? parseInt(month, 10) : undefined,
    );
  }

  @Get('export')
  @RequirePermissions('dashboard.read')
  async export(
    @Query() dto: ExportQueryDto,
    @Res() res: Response,
    @Req() req: RequestWithUser,
  ) {
    if (
      (dto.type === 'financier' || dto.type === 'rentabilite') &&
      !RESTRICTED_ROLES.has(req.user.roleName)
    ) {
      throw new ForbiddenException('Export réservé au gérant et au comptable.');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ExeTeam';
    workbook.created = new Date();

    if (dto.type === 'general') {
      const data = await this.dashboardService.getGeneral();
      const sheet = workbook.addWorksheet('Dashboard Général');
      sheet.columns = [
        { header: 'Indicateur', key: 'label', width: 30 },
        { header: 'Valeur', key: 'value', width: 20 },
      ];
      sheet.addRows([
        { label: 'Clients total', value: data.clients.total },
        { label: 'Clients nouveaux ce mois', value: data.clients.nouveauxCeMois },
        { label: 'Projets total', value: data.projects.total },
        { label: 'Projets en cours', value: data.projects.enCours },
        { label: 'Projets terminés', value: data.projects.termines },
        { label: 'Tâches total', value: data.tasks.total },
        { label: 'Tâches en cours', value: data.tasks.enCours },
        { label: 'Tâches terminées', value: data.tasks.terminees },
        { label: 'Tâches en retard', value: data.tasks.enRetard },
        { label: 'Employés actifs', value: data.employees.actifs },
        { label: 'Employés en congé', value: data.employees.enConge },
        { label: 'CA HT émis (mois)', value: data.revenue.factureEmisHT },
        { label: 'CA encaissé (mois)', value: data.revenue.encaisse },
        { label: 'CA en attente (mois)', value: data.revenue.enAttente },
        { label: 'Rendement moyen (%)', value: data.rendementMoyen },
      ]);
      const statusSheet = workbook.addWorksheet('Tâches par statut');
      statusSheet.columns = [
        { header: 'Statut', key: 'status', width: 20 },
        { header: 'Nombre', key: 'count', width: 15 },
      ];
      statusSheet.addRows(data.tasksByStatus);
    }

    if (dto.type === 'production') {
      const data = await this.dashboardService.getProduction({
        startDate: dto.startDate,
        endDate: dto.endDate,
      });
      const sheet = workbook.addWorksheet('Production');
      sheet.columns = [
        { header: 'Indicateur', key: 'label', width: 35 },
        { header: 'Valeur', key: 'value', width: 20 },
      ];
      sheet.addRows([
        { label: 'Tâches en retard', value: data.tasksOverdue },
        { label: 'Tâches terminées dans les délais', value: data.tasksCompletedOnTime },
        { label: 'Délai R→L moyen (jours ouvrés)', value: data.delaiRLMoyen },
      ]);
      const rendSheet = workbook.addWorksheet('Rendement opérateurs');
      rendSheet.columns = [
        { header: 'Opérateur', key: 'operatorName', width: 30 },
        { header: 'Rendement (%)', key: 'rendement', width: 15 },
      ];
      rendSheet.addRows(data.rendementParOperateur);
      const codesSheet = workbook.addWorksheet('Top codes produits');
      codesSheet.columns = [
        { header: 'Code produit', key: 'codeProduit', width: 20 },
        { header: 'Nb tâches', key: 'count', width: 12 },
        { header: 'Rendement moyen (%)', key: 'rendementMoyen', width: 20 },
      ];
      codesSheet.addRows(data.topCodes);
    }

    if (dto.type === 'financier') {
      const now = new Date();
      const data = await this.dashboardService.getFinancier({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      });
      const sheet = workbook.addWorksheet('Financier');
      sheet.columns = [
        { header: 'Indicateur', key: 'label', width: 30 },
        { header: 'Valeur (€)', key: 'value', width: 20 },
      ];
      sheet.addRows([
        { label: 'CA HT', value: data.chiffreAffaireHT },
        { label: 'CA TTC', value: data.chiffreAffaireTTC },
        { label: 'Achats HT', value: data.totalAchatsHT },
        { label: 'Marge brute', value: data.margeGrossiere },
      ]);
      const pendingSheet = workbook.addWorksheet('Factures en retard');
      pendingSheet.columns = [
        { header: 'Client', key: 'clientName', width: 30 },
        { header: 'Montant (€)', key: 'amount', width: 15 },
        { header: 'Échéance', key: 'dueDate', width: 15 },
      ];
      pendingSheet.addRows(data.pendingInvoices);
    }

    if (dto.type === 'rentabilite') {
      const now = new Date();
      const data = await this.dashboardService.getRentabilite(
        now.getFullYear(),
        now.getMonth() + 1,
      );
      const sheet = workbook.addWorksheet('Rentabilité salariale');
      sheet.columns = [
        { header: 'Employé', key: 'employeeName', width: 30 },
        { header: 'Salaire chargé (€)', key: 'salaireCharge', width: 20 },
        { header: 'Revenu généré (€)', key: 'revenueGenere', width: 20 },
        { header: 'Ratio', key: 'ratio', width: 10 },
        { header: 'Heures', key: 'hoursLogged', width: 10 },
        { header: "Taux d'occupation (%)", key: 'tauxOccupation', width: 20 },
      ];
      sheet.addRows(data.employees);
      sheet.addRow({});
      sheet.addRow({
        employeeName: 'TOTAL',
        salaireCharge: data.totals.masseSalariale,
        revenueGenere: data.totals.revenueTotal,
        ratio: data.totals.ratioGlobal,
      });
    }

    const filename = `dashboard-${dto.type}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  }
}
